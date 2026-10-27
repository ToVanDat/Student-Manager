'use strict';

const crypto = require('crypto');
const pool = require('../src/config/database.js');
const { redisClient } = require('../src/config/redis.js');
const { encryptFaceTemplate, decryptFaceTemplate, validateEmbedding } = require('./faceTemplateCrypto.js');
const { verifySensitiveAction, issueSession } = require('./advancedAuthService.js');
const { createLivenessChallenge, verifyLivenessSequence } = require('./faceLivenessChallenge.js');
const { inferFaceImage, ensureFaceInferenceReady } = require('./faceInferenceService.js');
const { verifyCapturePayload } = require('./faceCaptureValidation.js');

const CHALLENGE_TTL_SECONDS = 180;
const MAX_CAPTURE_FRAMES = 40;
const MIN_CAPTURE_FRAMES = 6;

function token(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function challengeKey(kind, id) {
    return `face-auth:${kind}:${id}`;
}

function pipelineError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function requirePipelineConfig() {
    if (process.env.FACE_AUTH_PIPELINE_ENABLED !== 'true' || process.env.FACE_AUTH_PIPELINE_VALIDATED !== 'true') {
        throw pipelineError('FACE_SERVER_INFERENCE_NOT_READY', 'Face Login vẫn đang khóa cho đến khi hoàn tất kiểm định mô hình và pipeline.');
    }
    const padThreshold = Number(process.env.FACE_PAD_MIN_SCORE);
    const consistencyThreshold = Number(process.env.FACE_FRAME_CONSISTENCY_THRESHOLD);
    const matchThreshold = Number(process.env.FACE_MATCH_THRESHOLD);
    let templateKey;
    try {
        if (process.env.FACE_TEMPLATE_ENCRYPTION_KEYS) {
            const keyring = JSON.parse(process.env.FACE_TEMPLATE_ENCRYPTION_KEYS);
            templateKey = keyring?.[String(Number(process.env.FACE_TEMPLATE_KEY_VERSION || 1))];
        } else {
            templateKey = process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
        }
    } catch {
        throw pipelineError('FACE_AUTH_CONFIG_NOT_READY', 'FACE_TEMPLATE_ENCRYPTION_KEYS không hợp lệ.');
    }
    if (typeof templateKey !== 'string' || Buffer.from(templateKey, 'base64').length !== 32) {
        throw pipelineError('FACE_AUTH_CONFIG_NOT_READY', 'Thiếu khóa AES-256-GCM hợp lệ cho face template.');
    }
    if (![padThreshold, consistencyThreshold, matchThreshold].every(Number.isFinite) ||
        padThreshold <= 0 || padThreshold > 1 ||
        consistencyThreshold <= 0 || consistencyThreshold > 1 ||
        matchThreshold <= 0 || matchThreshold > 1) {
        throw pipelineError('FACE_AUTH_CONFIG_NOT_READY', 'Face PAD, frame consistency và match threshold phải được hiệu chuẩn và cấu hình hợp lệ.');
    }
    return { padThreshold, consistencyThreshold };
}

async function saveChallenge(kind, id, payload) {
    if (!redisClient.isReady) throw pipelineError('FACE_AUTH_UNAVAILABLE', 'Redis Face Login chưa sẵn sàng');
    await redisClient.set(challengeKey(kind, id), JSON.stringify(payload), { EX: CHALLENGE_TTL_SECONDS });
}

async function consumeChallenge(kind, id) {
    const key = challengeKey(kind, id);
    const raw = await redisClient.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        { keys: [key], arguments: [] }
    );
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

async function appendCaptureFrame(kind, id, livenessNonce, imageBuffer, expectedUserId = null) {
    requirePipelineConfig();
    const key = challengeKey(kind, id);
    const rawState = await redisClient.get(key);
    if (!rawState) throw pipelineError('FACE_CHALLENGE_EXPIRED', 'Face challenge đã hết hạn hoặc đã được sử dụng');
    let state;
    try { state = JSON.parse(rawState); } catch { throw pipelineError('FACE_CHALLENGE_INVALID', 'Face challenge không hợp lệ'); }
    if (kind === 'enrollment' && state.userId !== String(expectedUserId)) {
        throw pipelineError('FACE_CHALLENGE_INVALID', 'Face enrollment challenge không thuộc tài khoản hiện tại.');
    }
    if (!state.liveness || Date.now() > state.liveness.expiresAt) {
        throw pipelineError('FACE_CHALLENGE_EXPIRED', 'Face challenge đã hết hạn');
    }

    if (typeof livenessNonce !== 'string' || livenessNonce.length !== state.liveness.nonce.length ||
        !crypto.timingSafeEqual(Buffer.from(livenessNonce), Buffer.from(state.liveness.nonce))) {
        throw pipelineError('FACE_CHALLENGE_INVALID', 'Liveness nonce không hợp lệ.');
    }

    // Inference is performed only by the trusted Node/Python server-side pipeline.
    const inference = await inferFaceImage(imageBuffer);
    const receivedAt = Date.now(); // Never accept client-provided timestamps.
    const frame = {
        receivedAt,
        liveness: inference.liveness,
        padScore: inference.pad.score,
        embedding: inference.embedding
    };

    const script = `
        local raw = redis.call('GET', KEYS[1])
        if not raw then return -1 end
        local state = cjson.decode(raw)
        if not state.liveness or tonumber(ARGV[2]) > tonumber(state.liveness.expiresAt) then return -2 end
        state.capture = state.capture or { frames = {} }
        local frames = state.capture.frames
        if #frames >= tonumber(ARGV[3]) then return -3 end
        if #frames > 0 then
            local previous = tonumber(frames[#frames].receivedAt)
            local current = tonumber(ARGV[2])
            if current <= previous or current - previous > tonumber(ARGV[4]) then return -4 end
        end
        table.insert(frames, cjson.decode(ARGV[1]))
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', tonumber(ARGV[5]))
        return #frames
    `;
    const appended = await redisClient.eval(script, {
        keys: [key],
        arguments: [JSON.stringify(frame), String(receivedAt), String(MAX_CAPTURE_FRAMES), '3000', String(CHALLENGE_TTL_SECONDS)]
    });
    if (appended < 1) {
        const codes = { '-1': 'FACE_CHALLENGE_EXPIRED', '-2': 'FACE_CHALLENGE_EXPIRED', '-3': 'FACE_CAPTURE_LIMIT', '-4': 'FACE_FRAME_SEQUENCE_INVALID' };
        throw pipelineError(codes[String(appended)] || 'FACE_CAPTURE_FAILED', 'Không thể tiếp nhận frame Face Login.');
    }
    return { accepted: true, frameCount: appended, remainingFrames: Math.max(0, MAX_CAPTURE_FRAMES - appended) };
}

function validateCapture(state) {
    const { padThreshold, consistencyThreshold } = requirePipelineConfig();
    return verifyCapturePayload(state, { padThreshold, consistencyThreshold });
}

function createCaptureState() {
    const liveness = createLivenessChallenge();
    return {
        challenge: token(32),
        createdAt: Date.now(),
        liveness: {
            id: liveness.id,
            nonce: liveness.nonce,
            actions: liveness.actions,
            issuedAt: liveness.issuedAt,
            expiresAt: liveness.expiresAt
        },
        capture: { frames: [] }
    };
}

function cosineSimilarity(left, right) {
    const a = validateEmbedding(left);
    const b = validateEmbedding(right);
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

async function storeVerifiedTemplate(userId, embedding, modelId, modelVersion) {
    const envelope = encryptFaceTemplate({ userId, embedding, modelId, modelVersion });
    const result = await pool.query(
        `INSERT INTO user_face_credentials (
            user_id, ciphertext, nonce, auth_tag, key_version,
            model_id, model_version, template_format, enrolled_at,
            last_used_at, disabled_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
            ciphertext = EXCLUDED.ciphertext, nonce = EXCLUDED.nonce,
            auth_tag = EXCLUDED.auth_tag, key_version = EXCLUDED.key_version,
            model_id = EXCLUDED.model_id, model_version = EXCLUDED.model_version,
            template_format = EXCLUDED.template_format, enrolled_at = CURRENT_TIMESTAMP,
            last_used_at = NULL, disabled_at = NULL, updated_at = CURRENT_TIMESTAMP
         RETURNING id, enrolled_at`,
        [userId, envelope.ciphertext, envelope.nonce, envelope.authTag,
            envelope.keyVersion, envelope.modelId, envelope.modelVersion, envelope.templateFormat]
    );
    return result.rows[0];
}

async function compareVerifiedTemplate(userId, liveEmbedding) {
    const result = await pool.query(
        `SELECT ciphertext, nonce, auth_tag, key_version, model_id, model_version
         FROM user_face_credentials WHERE user_id = $1 AND disabled_at IS NULL LIMIT 1`,
        [userId]
    );
    const stored = result.rows[0];
    if (!stored) return { matched: false, reason: 'NO_ACTIVE_CREDENTIAL' };
    const template = decryptFaceTemplate({
        userId, ciphertext: stored.ciphertext, nonce: stored.nonce, authTag: stored.auth_tag,
        keyVersion: stored.key_version, modelId: stored.model_id, modelVersion: stored.model_version
    });
    const similarity = cosineSimilarity(template, liveEmbedding);
    const threshold = Number(process.env.FACE_MATCH_THRESHOLD);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
        throw pipelineError('FACE_AUTH_CONFIG_NOT_READY', 'FACE_MATCH_THRESHOLD chưa được hiệu chuẩn.');
    }
    const matched = similarity >= threshold;
    if (matched) {
        await pool.query(
            'UPDATE user_face_credentials SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND disabled_at IS NULL',
            [userId]
        );
    }
    return { matched, similarity };
}

async function getStatus(userId) {
    const result = await pool.query(
        `SELECT id, model_id, model_version, enrolled_at, last_used_at, disabled_at
         FROM user_face_credentials WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );
    const credential = result.rows[0] || null;
    let pipelineReady = false;
    if (process.env.FACE_AUTH_PIPELINE_ENABLED === 'true' && process.env.FACE_AUTH_PIPELINE_VALIDATED === 'true') {
        try {
            requirePipelineConfig();
            await ensureFaceInferenceReady();
            pipelineReady = true;
        } catch {
            pipelineReady = false;
        }
    }
    return {
        configured: Boolean(credential && !credential.disabled_at),
        credential: credential ? {
            id: credential.id, modelId: credential.model_id, modelVersion: credential.model_version,
            enrolledAt: credential.enrolled_at, lastUsedAt: credential.last_used_at, disabledAt: credential.disabled_at
        } : null,
        enrollmentAvailable: pipelineReady,
        loginAvailable: pipelineReady,
        reason: pipelineReady ? null : 'SERVER_SIDE_INFERENCE_REQUIRED'
    };
}

async function beginEnrollment(userId, verificationToken) {
    await verifySensitiveAction(userId, null, verificationToken, 'face-enroll');
    const id = token(18);
    const state = createCaptureState();
    await saveChallenge('enrollment', id, { ...state, userId: String(userId) });
    return {
        challengeId: id, challenge: state.challenge, expiresIn: CHALLENGE_TTL_SECONDS,
        actions: state.liveness.actions, livenessNonce: state.liveness.nonce, livenessExpiresAt: state.liveness.expiresAt
    };
}

async function finishEnrollment(userId, challengeId) {
    const state = await consumeChallenge('enrollment', challengeId);
    if (!state || state.userId !== String(userId) || Date.now() - state.createdAt > CHALLENGE_TTL_SECONDS * 1000) {
        throw pipelineError('FACE_CHALLENGE_EXPIRED', 'Face enrollment challenge đã hết hạn hoặc đã được sử dụng');
    }
    const embedding = validateCapture(state);
    const stored = await storeVerifiedTemplate(userId, embedding, 'mobilefacenet+minifasnet-v2', 'supplied-bundle-v1');
    return { enrolled: true, credentialId: stored.id, enrolledAt: stored.enrolled_at };
}

async function beginLogin(username) {
    const normalized = typeof username === 'string' ? username.trim() : '';
    const found = normalized ? await pool.query(
        `SELECT u.id FROM users u
         JOIN user_face_credentials f ON f.user_id = u.id AND f.disabled_at IS NULL
         WHERE u.username = $1 AND u.is_active = TRUE LIMIT 1`, [normalized]
    ) : { rows: [] };
    const id = token(18);
    const state = createCaptureState();
    await saveChallenge('login', id, { ...state, userId: found.rows[0] ? String(found.rows[0].id) : null });
    return {
        challengeId: id, challenge: state.challenge, expiresIn: CHALLENGE_TTL_SECONDS,
        actions: state.liveness.actions, livenessExpiresAt: state.liveness.expiresAt
    };
}

async function finishLogin(challengeId, req) {
    const state = await consumeChallenge('login', challengeId);
    if (!state || Date.now() - state.createdAt > CHALLENGE_TTL_SECONDS * 1000) {
        throw pipelineError('FACE_CHALLENGE_EXPIRED', 'Face login challenge đã hết hạn hoặc đã được sử dụng');
    }
    const embedding = validateCapture(state);
    if (!state.userId) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    const userResult = await pool.query(
        `SELECT id, username, email, role, avatar_url, is_active FROM users WHERE id = $1 LIMIT 1`,
        [state.userId]
    );
    const user = userResult.rows[0];
    if (!user?.is_active) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    const comparison = await compareVerifiedTemplate(state.userId, embedding);
    if (!comparison.matched) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    return issueSession(user, req);
}

async function completeLoginAfterTrustedInference(challengeId, liveEmbedding, req) {
    const state = await consumeChallenge('login', challengeId);
    if (!state || Date.now() - state.createdAt > CHALLENGE_TTL_SECONDS * 1000) {
        throw pipelineError('FACE_CHALLENGE_EXPIRED', 'Face login challenge đã hết hạn hoặc đã được sử dụng');
    }
    if (!state.userId) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    const userResult = await pool.query(
        `SELECT id, username, email, role, avatar_url, is_active FROM users WHERE id = $1 LIMIT 1`,
        [state.userId]
    );
    const user = userResult.rows[0];
    if (!user?.is_active) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    const comparison = await compareVerifiedTemplate(state.userId, liveEmbedding);
    if (!comparison.matched) throw pipelineError('FACE_LOGIN_FAILED', 'Không thể đăng nhập bằng Face Login.');
    return issueSession(user, req);
}

async function disable(userId) {
    const result = await pool.query(
        `UPDATE user_face_credentials
         SET disabled_at = COALESCE(disabled_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND disabled_at IS NULL
         RETURNING id`,
        [userId]
    );
    return { disabled: result.rowCount > 0 };
}

module.exports = {
    getStatus,
    beginEnrollment,
    finishEnrollment,
    appendCaptureFrame,
    beginLogin,
    finishLogin,
    completeLoginAfterTrustedInference,
    disable,
    storeVerifiedTemplate,
    compareVerifiedTemplate
};
