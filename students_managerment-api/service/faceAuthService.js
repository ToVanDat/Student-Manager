const crypto = require('crypto');
const pool = require('../src/config/database.js');
const { redisClient } = require('../src/config/redis.js');

const CHALLENGE_TTL_SECONDS = 180;
const EMBEDDING_DIMENSIONS = Number.parseInt(process.env.FACE_EMBEDDING_DIMENSIONS || '512', 10);
const EMBEDDING_MODEL = process.env.FACE_EMBEDDING_MODEL || 'unselected';
const EMBEDDING_MODEL_VERSION = process.env.FACE_EMBEDDING_MODEL_VERSION || 'unselected';

function encryptionKey() {
    const encoded = process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
    if (!encoded) throw new Error('FACE_TEMPLATE_ENCRYPTION_KEY chưa được cấu hình');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('FACE_TEMPLATE_ENCRYPTION_KEY phải là khóa base64 32 byte');
    return key;
}
function encryptTemplate(embedding) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const plaintext = Buffer.from(JSON.stringify(embedding), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from('FCE1'), iv, tag, ciphertext]);
}
function validateEmbedding(value) {
    if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Embedding phải có đúng ${EMBEDDING_DIMENSIONS} chiều theo cấu hình hiện tại`);
    }
    if (!value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10)) {
        throw new Error('Embedding chứa giá trị không hợp lệ');
    }
    const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
    if (norm < 0.5 || norm > 1.5) throw new Error('Embedding chưa được chuẩn hóa hoặc không hợp lệ');
    return value;
}
async function createEnrollmentChallenge(userId) {
    const challengeId = crypto.randomUUID();
    const nonce = crypto.randomBytes(32).toString('base64url');
    await redisClient.set(
        `face-enrollment:${challengeId}`,
        JSON.stringify({ userId: String(userId), nonce }),
        { EX: CHALLENGE_TTL_SECONDS, NX: true }
    );
    return { challengeId, nonce, expiresInSeconds: CHALLENGE_TTL_SECONDS };
}
async function consumeChallenge(challengeId, userId) {
    if (typeof challengeId !== 'string' || challengeId.length > 100) throw new Error('Challenge không hợp lệ');
    const key = `face-enrollment:${challengeId}`;
    const raw = await redisClient.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        { keys: [key], arguments: [] }
    );
    if (!raw) throw new Error('Challenge đã hết hạn hoặc đã sử dụng');
    let state;
    try { state = JSON.parse(raw); } catch { throw new Error('Challenge không hợp lệ'); }
    if (state.userId !== String(userId)) throw new Error('Challenge không thuộc tài khoản hiện tại');
    return state;
}
async function completeEnrollment(userId, challengeId, embeddingInput) {
    await consumeChallenge(challengeId, userId);
    const embedding = validateEmbedding(embeddingInput);
    if (EMBEDDING_MODEL === 'unselected' || EMBEDDING_MODEL_VERSION === 'unselected') {
        throw new Error('Mô hình embedding chưa được lựa chọn; cấu hình FACE_EMBEDDING_MODEL và FACE_EMBEDDING_MODEL_VERSION trước khi đăng ký');
    }
    const encrypted = encryptTemplate(embedding);
    const keyVersion = process.env.FACE_TEMPLATE_ENCRYPTION_KEY_VERSION || 'v1';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            "UPDATE user_face_credentials SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'",
            [userId]
        );
        const result = await client.query(
            `INSERT INTO user_face_credentials
                (user_id, template_ciphertext, encryption_key_version, embedding_model, embedding_model_version, status)
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING id, embedding_model, embedding_model_version, status, enrolled_at`,
            [userId, encrypted, keyVersion, EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
async function getCredential(userId) {
    const result = await pool.query(
        "SELECT id, embedding_model, embedding_model_version, status, enrolled_at, last_used_at, revoked_at FROM user_face_credentials WHERE user_id = $1 AND status = 'active' LIMIT 1",
        [userId]
    );
    return result.rows[0] || null;
}
async function revokeCredential(userId) {
    await pool.query(
        "UPDATE user_face_credentials SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'",
        [userId]
    );
}
module.exports = { createEnrollmentChallenge, completeEnrollment, getCredential, revokeCredential };
