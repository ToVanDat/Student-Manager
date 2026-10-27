'use strict';

const crypto = require('crypto');
const pool = require('../src/config/database.js');
const { redisClient } = require('../src/config/redis.js');

const CHALLENGE_TTL_SECONDS = 180;

function token(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function challengeKey(kind, id) {
    return `face-auth:${kind}:${id}`;
}

async function saveChallenge(kind, id, payload) {
    if (!redisClient.isReady) {
        const error = new Error('Dịch vụ challenge Face Login chưa sẵn sàng');
        error.code = 'FACE_AUTH_UNAVAILABLE';
        throw error;
    }
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

function inferenceNotReady() {
    const error = new Error(
        'Face Login chưa được bật: cần hoàn thiện inference và PAD xác minh phía server trước khi cho phép đăng ký hoặc đăng nhập.'
    );
    error.code = 'FACE_SERVER_INFERENCE_NOT_READY';
    throw error;
}

async function getStatus(userId) {
    const result = await pool.query(
        `SELECT id, model_id, model_version, enrolled_at, last_used_at, disabled_at
         FROM user_face_credentials WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );
    const credential = result.rows[0] || null;
    return {
        configured: Boolean(credential && !credential.disabled_at),
        credential: credential ? {
            id: credential.id,
            modelId: credential.model_id,
            modelVersion: credential.model_version,
            enrolledAt: credential.enrolled_at,
            lastUsedAt: credential.last_used_at,
            disabledAt: credential.disabled_at
        } : null,
        enrollmentAvailable: false,
        loginAvailable: false,
        reason: 'SERVER_SIDE_INFERENCE_REQUIRED'
    };
}

async function beginEnrollment(userId) {
    const id = token(18);
    const challenge = token(32);
    await saveChallenge('enrollment', id, {
        userId: String(userId),
        challenge,
        createdAt: Date.now()
    });
    return { challengeId: id, challenge, expiresIn: CHALLENGE_TTL_SECONDS };
}

async function finishEnrollment(userId, challengeId) {
    const state = await consumeChallenge('enrollment', challengeId);
    if (!state || state.userId !== String(userId) || Date.now() - state.createdAt > CHALLENGE_TTL_SECONDS * 1000) {
        throw new Error('Face enrollment challenge đã hết hạn hoặc đã được sử dụng');
    }
    inferenceNotReady();
}

async function beginLogin(username) {
    const normalized = typeof username === 'string' ? username.trim() : '';
    const found = normalized
        ? await pool.query(
            `SELECT u.id FROM users u
             JOIN user_face_credentials f ON f.user_id = u.id AND f.disabled_at IS NULL
             WHERE u.username = $1 AND u.is_active = TRUE LIMIT 1`,
            [normalized]
        )
        : { rows: [] };
    const id = token(18);
    const challenge = token(32);
    await saveChallenge('login', id, {
        userId: found.rows[0] ? String(found.rows[0].id) : null,
        challenge,
        createdAt: Date.now()
    });
    // Do not disclose whether a username has an enrolled face credential.
    return { challengeId: id, challenge, expiresIn: CHALLENGE_TTL_SECONDS };
}

async function finishLogin(challengeId) {
    const state = await consumeChallenge('login', challengeId);
    if (!state || Date.now() - state.createdAt > CHALLENGE_TTL_SECONDS * 1000) {
        throw new Error('Face login challenge đã hết hạn hoặc đã được sử dụng');
    }
    inferenceNotReady();
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
    beginLogin,
    finishLogin,
    disable
};
