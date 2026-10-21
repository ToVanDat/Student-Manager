const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const pool = require('../src/config/database.js');
const { redisClient } = require('../src/config/redis.js');
const authRepository = require('../repository/authRepository.js');

const googleClient = new OAuth2Client();
const CHALLENGE_TTL_SECONDS = 300;
const QR_TTL_MS = 120000;
const ACCESS_TTL_SECONDS = 30 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function rpConfig() {
    const origin = process.env.WEBAUTHN_ORIGIN || process.env.FRONTEND_URL;
    if (!origin) throw new Error('WEBAUTHN_ORIGIN chưa được cấu hình');
    const url = new URL(origin);
    return {
        expectedOrigin: url.origin,
        rpID: process.env.WEBAUTHN_RP_ID || url.hostname,
        rpName: process.env.WEBAUTHN_RP_NAME || 'Student Manager'
    };
}

function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
function challengeKey(kind, id) {
    return `advanced-auth:${kind}:${id}`;
}
async function saveChallenge(kind, id, payload) {
    await redisClient.set(challengeKey(kind, id), JSON.stringify(payload), { EX: CHALLENGE_TTL_SECONDS });
}
async function consumeChallenge(kind, id) {
    const key = challengeKey(kind, id);
    const raw = typeof redisClient.getDel === 'function'
        ? await redisClient.getDel(key)
        : await redisClient.get(key);
    if (!raw) return null;
    if (typeof redisClient.getDel !== 'function') {
        // Redis deployments without GETDEL must be upgraded before relying on strict one-time challenge consumption.
        await redisClient.del(key);
    }
    try { return JSON.parse(raw); } catch { return null; }
}
function publicUser(user) {
    return { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url || null };
}

async function issueSession(user, req) {
    if (!user || !user.is_active) throw new Error('Tài khoản đã bị khóa hoặc không tồn tại');
    const session = await authRepository.createSession(
        user.id,
        req.get('user-agent')?.slice(0, 500) || 'Passkey/Google/QR',
        req.get('user-agent') || null,
        req.ip || null
    );
    const accessToken = jwt.sign({
        sub: user.id, username: user.username, role: user.role, sessionId: session.id
    }, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TTL_SECONDS,
        issuer: 'student-management-api',
        audience: 'student-management-client'
    });
    const accessHash = hash(accessToken);
    await redisClient.set(`access_token:${accessHash}`, String(user.id), { EX: ACCESS_TTL_SECONDS });
    const refreshToken = randomToken(64);
    await authRepository.saveRefreshToken(
        user.id, session.id, hash(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)
    );
    return { user: publicUser(user), accessToken, refreshToken, sessionId: session.id };
}

async function verifyGoogleIdToken(idToken) {
    if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID chưa được cấu hình');
    if (typeof idToken !== 'string' || idToken.length > 10000) throw new Error('Google ID token không hợp lệ');
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Google chưa xác minh email của tài khoản này');
    }
    return payload;
}

async function linkGoogle(userId, idToken) {
    const google = await verifyGoogleIdToken(idToken);
    const userResult = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [userId]);
    if (!userResult.rows[0]?.is_active) throw new Error('Tài khoản không hoạt động');
    const existing = await pool.query(
        'SELECT user_id FROM user_oauth_accounts WHERE provider = $1 AND provider_subject = $2',
        ['google', google.sub]
    );
    if (existing.rows[0] && String(existing.rows[0].user_id) !== String(userId)) {
        throw new Error('Tài khoản Google này đã liên kết với tài khoản khác');
    }
    await pool.query(
        `INSERT INTO user_oauth_accounts (user_id, provider, provider_subject, provider_email)
         VALUES ($1, 'google', $2, $3)
         ON CONFLICT (user_id, provider) DO UPDATE
         SET provider_subject = EXCLUDED.provider_subject, provider_email = EXCLUDED.provider_email, linked_at = CURRENT_TIMESTAMP`,
        [userId, google.sub, google.email]
    );
    return { provider: 'google', email: google.email };
}

async function loginGoogle(idToken, req) {
    const google = await verifyGoogleIdToken(idToken);
    const result = await pool.query(
        `SELECT u.id, u.username, u.email, u.role, u.avatar_url, u.is_active
         FROM user_oauth_accounts a JOIN users u ON u.id = a.user_id
         WHERE a.provider = 'google' AND a.provider_subject = $1`,
        [google.sub]
    );
    if (!result.rows[0]) throw new Error('Google chưa được liên kết. Hãy đăng nhập bằng mật khẩu rồi liên kết Google trong cài đặt bảo mật.');
    return issueSession(result.rows[0], req);
}

async function beginPasskeyRegistration(userId) {
    const userResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
    const user = userResult.rows[0];
    if (!user) throw new Error('Không tìm thấy tài khoản đang hoạt động');
    const { rpID, rpName } = rpConfig();
    const credentials = await pool.query('SELECT credential_id, transports FROM user_webauthn_credentials WHERE user_id = $1', [userId]);
    const options = await generateRegistrationOptions({
        rpName, rpID, userName: user.username || user.email,
        userID: Buffer.from(String(user.id)),
        attestationType: 'none',
        excludeCredentials: credentials.rows.map(row => ({ id: row.credential_id, transports: row.transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
    });
    const challengeId = randomToken(18);
    await saveChallenge('passkey-register', challengeId, { userId: String(userId), challenge: options.challenge });
    return { challengeId, options };
}

async function finishPasskeyRegistration(userId, challengeId, response, deviceName) {
    const state = await consumeChallenge('passkey-register', challengeId);
    if (!state || state.userId !== String(userId)) throw new Error('Challenge đăng ký đã hết hạn hoặc không hợp lệ');
    const { expectedOrigin, rpID } = rpConfig();
    const verification = await verifyRegistrationResponse({
        response, expectedChallenge: state.challenge, expectedOrigin, expectedRPID: rpID,
        requireUserVerification: false
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error('Không xác minh được passkey');
    const info = verification.registrationInfo;
    const credential = info.credential || {
        id: info.credentialID ? Buffer.from(info.credentialID).toString('base64url') : response.id,
        publicKey: info.credentialPublicKey,
        counter: info.counter,
        transports: response.response?.transports || []
    };
    await pool.query(
        `INSERT INTO user_webauthn_credentials
         (user_id, credential_id, public_key, counter, transports, device_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, credential.id, Buffer.from(credential.publicKey), credential.counter || 0, credential.transports || [], String(deviceName || 'Passkey').slice(0, 120)]
    );
    return { verified: true };
}

async function beginPasskeyLogin(username) {
    if (typeof username !== 'string' || !username.trim()) throw new Error('Nhập username trước khi dùng passkey');
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1 AND is_active = TRUE', [username.trim()]);
    if (!userResult.rows[0]) throw new Error('Không tìm thấy tài khoản đang hoạt động');
    const userId = userResult.rows[0].id;
    const rows = await pool.query('SELECT credential_id, transports FROM user_webauthn_credentials WHERE user_id = $1', [userId]);
    if (!rows.rows.length) throw new Error('Tài khoản chưa đăng ký passkey');
    const { rpID } = rpConfig();
    const options = await generateAuthenticationOptions({
        rpID, allowCredentials: rows.rows.map(row => ({ id: row.credential_id, transports: row.transports })),
        userVerification: 'preferred'
    });
    const challengeId = randomToken(18);
    await saveChallenge('passkey-login', challengeId, { userId: String(userId), challenge: options.challenge });
    return { challengeId, options };
}

async function finishPasskeyLogin(challengeId, response, req) {
    const state = await consumeChallenge('passkey-login', challengeId);
    if (!state) throw new Error('Challenge đăng nhập đã hết hạn hoặc đã được sử dụng');
    const credentialResult = await pool.query(
        'SELECT * FROM user_webauthn_credentials WHERE user_id = $1 AND credential_id = $2',
        [state.userId, response?.id]
    );
    const stored = credentialResult.rows[0];
    if (!stored) throw new Error('Passkey không thuộc tài khoản này');
    const { expectedOrigin, rpID } = rpConfig();
    const verification = await verifyAuthenticationResponse({
        response, expectedChallenge: state.challenge, expectedOrigin, expectedRPID: rpID,
        credential: {
            id: stored.credential_id,
            publicKey: new Uint8Array(stored.public_key),
            counter: Number(stored.counter),
            transports: stored.transports || []
        },
        requireUserVerification: false
    });
    if (!verification.verified) throw new Error('Xác minh passkey thất bại');
    await pool.query(
        'UPDATE user_webauthn_credentials SET counter = $1, last_used_at = CURRENT_TIMESTAMP WHERE id = $2',
        [verification.authenticationInfo.newCounter, stored.id]
    );
    const user = await pool.query(
        'SELECT id, username, email, role, avatar_url, is_active FROM users WHERE id = $1',
        [state.userId]
    );
    return issueSession(user.rows[0], req);
}

async function listPasskeys(userId) {
    const result = await pool.query(
        'SELECT id, device_name, created_at, last_used_at FROM user_webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}
async function deletePasskey(userId, id) {
    const result = await pool.query('DELETE FROM user_webauthn_credentials WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    if (!result.rows[0]) throw new Error('Không tìm thấy passkey');
    return true;
}

async function createQrLogin() {
    const id = crypto.randomUUID();
    const secret = randomToken(32);
    const expiresAt = new Date(Date.now() + QR_TTL_MS);
    await pool.query(
        'INSERT INTO qr_login_requests (id, request_secret_hash, expires_at) VALUES ($1, $2, $3)',
        [id, hash(secret), expiresAt]
    );
    return { requestId: id, secret, expiresAt: expiresAt.toISOString() };
}
async function approveQrLogin(userId, requestId, secret, sessionId) {
    const result = await pool.query(
        `UPDATE qr_login_requests SET status = 'approved', approved_user_id = $1,
             approved_session_id = $2, approved_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND request_secret_hash = $4 AND status = 'pending'
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING id`,
        [userId, sessionId || null, requestId, hash(secret || '')]
    );
    if (!result.rows[0]) throw new Error('Yêu cầu QR hết hạn, đã xử lý hoặc không hợp lệ');
    return { approved: true };
}
async function denyQrLogin(requestId, secret, status = 'denied') {
    if (!['denied', 'cancelled'].includes(status)) throw new Error('Trạng thái không hợp lệ');
    const result = await pool.query(
        `UPDATE qr_login_requests SET status = $1
         WHERE id = $2 AND request_secret_hash = $3 AND status = 'pending'
           AND expires_at > CURRENT_TIMESTAMP RETURNING status`,
        [status, requestId, hash(secret || '')]
    );
    if (!result.rows[0]) throw new Error('Yêu cầu QR hết hạn hoặc đã xử lý');
    return { status: result.rows[0].status };
}
async function pollQrLogin(requestId, secret, req) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query(
            'SELECT * FROM qr_login_requests WHERE id = $1 AND request_secret_hash = $2 FOR UPDATE',
            [requestId, hash(secret || '')]
        );
        const request = found.rows[0];
        if (!request) throw new Error('Yêu cầu QR không hợp lệ');
        if (request.expires_at <= new Date() && ['pending', 'approved'].includes(request.status)) {
            await client.query("UPDATE qr_login_requests SET status = 'expired' WHERE id = $1", [requestId]);
            await client.query('COMMIT');
            return { status: 'expired' };
        }
        if (request.status !== 'approved') {
            await client.query('COMMIT');
            return { status: request.status };
        }
        const consumed = await client.query(
            `UPDATE qr_login_requests SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'approved' RETURNING approved_user_id`,
            [requestId]
        );
        await client.query('COMMIT');
        const userResult = await pool.query(
            'SELECT id, username, email, role, avatar_url, is_active FROM users WHERE id = $1',
            [consumed.rows[0].approved_user_id]
        );
        const session = await issueSession(userResult.rows[0], req);
        return { status: 'consumed', ...session };
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    linkGoogle, loginGoogle,
    beginPasskeyRegistration, finishPasskeyRegistration,
    beginPasskeyLogin, finishPasskeyLogin, listPasskeys, deletePasskey,
    createQrLogin, approveQrLogin, denyQrLogin, pollQrLogin
};
