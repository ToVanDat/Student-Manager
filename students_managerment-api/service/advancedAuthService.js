const crypto = require('crypto');
const bcrypt = require('bcrypt');
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
const { saveAccessTokenToRedis, removeAccessTokenFromRedis } = require('./accessTokenStore.js');

const googleClient = new OAuth2Client();
const CHALLENGE_TTL_SECONDS = 300;
const QR_TTL_MS = 120000;
const ACCESS_TTL_SECONDS = 30 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function rpConfig() {
    const origin = process.env.WEBAUTHN_ORIGIN || process.env.FRONTEND_URL;
    const configError = message => {
        const error = new Error(message);
        error.code = 'WEBAUTHN_CONFIG_NOT_READY';
        throw error;
    };
    if (!origin) configError('WebAuthn origin chưa được cấu hình');
    let url;
    try { url = new URL(origin); } catch { configError('WebAuthn origin không hợp lệ'); }
    const rpID = process.env.WEBAUTHN_RP_ID || url.hostname;
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const secure = url.protocol === 'https:' || (url.protocol === 'http:' && local);
    const matches = url.hostname === rpID || url.hostname.endsWith('.' + rpID);
    if (!secure || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !matches) {
        configError('WebAuthn origin hoặc RP ID không khớp cấu hình trình duyệt');
    }
    return { expectedOrigin: url.origin, rpID, rpName: process.env.WEBAUTHN_RP_NAME || 'Student Manager' };
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
    // Atomic one-time read/delete: concurrent verification requests cannot both consume the same challenge.
    const raw = await redisClient.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        { keys: [key], arguments: [] }
    );
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}
function publicUser(user) {
    return { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url || null };
}

async function issueSession(user, req, options = {}) {
    if (!user || !user.is_active) throw new Error('Tài khoản đã bị khóa hoặc không tồn tại');

    // sessions.device_name is VARCHAR(100), while user_agent is TEXT.
    // Keep the display name within the database limit and preserve the full
    // User-Agent in the dedicated TEXT column.
    const userAgent = req.get('user-agent') || null;
    const deviceName = userAgent ? userAgent.slice(0, 100) : 'Passkey/Google/QR';
    let session = null;
    let accessToken = null;

    try {
        const createSession = options.requireFaceCredential
            ? authRepository.createSessionForActiveFaceUser
            : authRepository.createSessionForActiveUser;
        session = await createSession(
            user.id,
            deviceName,
            userAgent,
            req.ip || null,
            options.requireFaceCredential ? options.faceCredentialId : undefined
        );
        if (!session) {
            const inactiveError = new Error('Tài khoản đã bị khóa hoặc không tồn tại');
            inactiveError.code = 'ACCOUNT_INACTIVE';
            throw inactiveError;
        }
        accessToken = jwt.sign({
            sub: user.id, username: user.username, role: user.role, sessionId: session.id
        }, process.env.JWT_SECRET, {
            expiresIn: ACCESS_TTL_SECONDS,
            issuer: 'student-management-api',
            audience: 'student-management-client',
            algorithm: 'HS256'
        });

        await saveAccessTokenToRedis(accessToken, user.id);

        const refreshToken = randomToken(64);
        await authRepository.saveRefreshToken(
            user.id, session.id, hash(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)
        );

        return { user: publicUser(user), accessToken, refreshToken, sessionId: session.id };
    } catch (error) {
        // Session creation spans PostgreSQL and Redis. If either token write
        // fails, compensate so an incomplete login cannot leave an orphaned
        // active session or a usable access-token entry behind.
        if (accessToken) {
            try {
                await removeAccessTokenFromRedis(accessToken);
            } catch (cleanupError) {
                console.error('[AdvancedAuth] Failed to clean partial access token', {
                    code: cleanupError.code || 'ACCESS_TOKEN_CLEANUP_FAILED'
                });
            }
        }

        if (session?.id) {
            try {
                await authRepository.revokeRefreshTokensBySessionId(session.id);
            } catch (cleanupError) {
                console.error('[AdvancedAuth] Failed to revoke partial refresh tokens', {
                    code: cleanupError.code || 'REFRESH_TOKEN_CLEANUP_FAILED',
                    sessionId: session.id
                });
            }
            try {
                await authRepository.revokeSession(session.id);
            } catch (cleanupError) {
                console.error('[AdvancedAuth] Failed to revoke incomplete session', {
                    code: cleanupError.code || 'SESSION_CLEANUP_FAILED',
                    sessionId: session.id
                });
            }
        }

        throw error;
    }
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

async function verifySensitiveAction(userId, currentPassword, verificationToken, purpose) {
    if (typeof currentPassword === 'string' && currentPassword) {
        const userResult = await pool.query('SELECT password_hash, is_active FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        if (!user?.is_active) throw new Error('Tài khoản không hoạt động');
        if (user.password_hash && await bcrypt.compare(currentPassword, user.password_hash)) return true;
        throw new Error('Mật khẩu Student Manager không đúng');
    }
    if (typeof verificationToken !== 'string' || !verificationToken) {
        throw new Error('Hãy xác minh bằng mật khẩu Student Manager hoặc passkey trước khi tiếp tục');
    }
    const key = `advanced-auth:sensitive-verify:${hash(verificationToken)}`;
    const raw = await redisClient.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        { keys: [key], arguments: [] }
    );
    if (!raw || raw !== `${userId}:${purpose}`) throw new Error('Xác minh đã hết hạn, không đúng thao tác hoặc đã được sử dụng. Hãy xác minh lại.');
    return true;
}

async function beginSensitiveReauth(userId, purpose) {
    if (!['google-link', 'google-unlink', 'face-enroll', 'face-disable'].includes(purpose)) throw new Error('Mục đích xác minh không hợp lệ');
    const userResult = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [userId]);
    if (!userResult.rows[0]?.is_active) throw new Error('Tài khoản không hoạt động');
    const rows = await pool.query('SELECT credential_id, transports FROM user_webauthn_credentials WHERE user_id = $1', [userId]);
    if (!rows.rows.length) throw new Error('Tài khoản chưa đăng ký passkey. Hãy thiết lập mật khẩu hoặc đăng ký passkey trước.');
    const { rpID } = rpConfig();
    const options = await generateAuthenticationOptions({
        rpID, allowCredentials: rows.rows.map(row => ({ id: row.credential_id, transports: row.transports })),
        userVerification: 'required'
    });
    const challengeId = randomToken(18);
    await saveChallenge('sensitive-reauth', challengeId, { userId: String(userId), purpose, challenge: options.challenge });
    return { challengeId, options };
}

async function finishSensitiveReauth(userId, challengeId, response, purpose) {
    const state = await consumeChallenge('sensitive-reauth', challengeId);
    if (!state || state.userId !== String(userId) || state.purpose !== purpose) throw new Error('Challenge xác minh đã hết hạn hoặc không hợp lệ');
    const storedResult = await pool.query('SELECT * FROM user_webauthn_credentials WHERE user_id = $1 AND credential_id = $2', [userId, response?.id]);
    const stored = storedResult.rows[0];
    if (!stored) throw new Error('Passkey không thuộc tài khoản này');
    const { expectedOrigin, rpID } = rpConfig();
    const verification = await verifyAuthenticationResponse({
        response, expectedChallenge: state.challenge, expectedOrigin, expectedRPID: rpID,
        credential: { id: stored.credential_id, publicKey: new Uint8Array(stored.public_key), counter: Number(stored.counter), transports: stored.transports || [] },
        requireUserVerification: true
    });
    if (!verification.verified) throw new Error('Xác minh passkey thất bại');
    await pool.query('UPDATE user_webauthn_credentials SET counter = $1, last_used_at = CURRENT_TIMESTAMP WHERE id = $2', [verification.authenticationInfo.newCounter, stored.id]);
    const verificationToken = randomToken(32);
    await redisClient.set(`advanced-auth:sensitive-verify:${hash(verificationToken)}`, `${userId}:${purpose}`, { EX: 300 });
    return { verificationToken, expiresIn: 300 };
}

async function linkGoogle(userId, idToken, currentPassword, verificationToken) {
    await verifySensitiveAction(userId, currentPassword, verificationToken, 'google-link');
    const google = await verifyGoogleIdToken(idToken);
    const userResult = await pool.query(
        'SELECT id, is_active FROM users WHERE id = $1',
        [userId]
    );
    const user = userResult.rows[0];
    if (!user?.is_active) throw new Error('Tài khoản không hoạt động');

    const bySubject = await pool.query(
        'SELECT user_id FROM user_oauth_accounts WHERE provider = $1 AND provider_subject = $2',
        ['google', google.sub]
    );
    if (bySubject.rows[0] && String(bySubject.rows[0].user_id) !== String(userId)) {
        throw new Error('Tài khoản Google này đã liên kết với tài khoản khác');
    }

    const byUser = await pool.query(
        'SELECT provider_subject, provider_email FROM user_oauth_accounts WHERE user_id = $1 AND provider = $2',
        [userId, 'google']
    );
    if (byUser.rows[0]) {
        if (byUser.rows[0].provider_subject !== google.sub) {
            throw new Error('Tài khoản này đã liên kết Google khác. Hãy gỡ liên kết trước khi thay đổi.');
        }
        return { provider: 'google', email: byUser.rows[0].provider_email || google.email, linked: true };
    }

    await pool.query(
        `INSERT INTO user_oauth_accounts (user_id, provider, provider_subject, provider_email)
         VALUES ($1, 'google', $2, $3)`,
        [userId, google.sub, google.email]
    );
    return { provider: 'google', email: google.email, linked: true };
}

async function getGoogleLink(userId) {
    const result = await pool.query(
        'SELECT provider, provider_email, linked_at FROM user_oauth_accounts WHERE user_id = $1 AND provider = $2',
        [userId, 'google']
    );
    return result.rows[0] || null;
}

async function unlinkGoogle(userId, currentPassword, verificationToken) {
    await verifySensitiveAction(userId, currentPassword, verificationToken, 'google-unlink');
    const result = await pool.query(
        'DELETE FROM user_oauth_accounts WHERE user_id = $1 AND provider = $2 RETURNING id',
        [userId, 'google']
    );
    if (!result.rows[0]) throw new Error('Tài khoản chưa liên kết Google');
    return true;
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
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }
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
        requireUserVerification: true
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
    if (!userResult.rows[0]) throw new Error('Không thể đăng nhập bằng passkey. Kiểm tra thông tin hoặc sử dụng mật khẩu.');
    const userId = userResult.rows[0].id;
    const rows = await pool.query('SELECT credential_id, transports FROM user_webauthn_credentials WHERE user_id = $1', [userId]);
    if (!rows.rows.length) throw new Error('Không thể đăng nhập bằng passkey. Kiểm tra thông tin hoặc sử dụng mật khẩu.');
    const { rpID } = rpConfig();
    const options = await generateAuthenticationOptions({
        rpID, allowCredentials: rows.rows.map(row => ({ id: row.credential_id, transports: row.transports })),
        userVerification: 'required'
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
        requireUserVerification: true
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
    let issuedSession = null;
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
        // Keep the request row locked until session issuance succeeds. If issuing the
        // session fails, ROLLBACK leaves the QR request approved so the client can retry.
        const userResult = await pool.query(
            'SELECT id, username, email, role, avatar_url, is_active FROM users WHERE id = $1',
            [request.approved_user_id]
        );
        const session = await issueSession(userResult.rows[0], req);
        issuedSession = session;
        const consumed = await client.query(
            `UPDATE qr_login_requests SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'approved' RETURNING id`,
            [requestId]
        );
        if (!consumed.rows[0]) throw new Error('Yêu cầu QR đã được xử lý đồng thời');
        await client.query('COMMIT');
        return { status: 'consumed', ...session };
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        // Session issuance uses the shared auth repository/Redis rather than this
        // PostgreSQL transaction. Compensate if QR consumption/COMMIT then fails,
        // so a retry cannot leave multiple live sessions from one QR request.
        if (issuedSession?.sessionId) {
            try {
                await authRepository.revokeSession(issuedSession.sessionId);
            } catch {
                console.error('[AdvancedAuth] QR session revocation failed', {
                    code: 'QR_SESSION_REVOCATION_FAILED',
                    sessionId: issuedSession.sessionId
                });
            }
            try {
                await authRepository.revokeRefreshTokensBySessionId(issuedSession.sessionId);
            } catch {
                console.error('[AdvancedAuth] QR refresh-token cleanup failed', {
                    code: 'QR_REFRESH_TOKEN_CLEANUP_FAILED',
                    sessionId: issuedSession.sessionId
                });
            }
            try {
                if (issuedSession.accessToken) {
                    await redisClient.del(`access_token:${hash(issuedSession.accessToken)}`);
                }
            } catch {
                console.error('[AdvancedAuth] QR access-token cleanup failed', {
                    code: 'QR_ACCESS_TOKEN_CLEANUP_FAILED',
                    sessionId: issuedSession.sessionId
                });
            }
        }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    linkGoogle, getGoogleLink, unlinkGoogle, loginGoogle,
    beginSensitiveReauth, finishSensitiveReauth,
    beginPasskeyRegistration, finishPasskeyRegistration,
    beginPasskeyLogin, finishPasskeyLogin, listPasskeys, deletePasskey,
    createQrLogin, approveQrLogin, denyQrLogin, pollQrLogin,
    // Reused only by trusted server-side authentication flows; never expose directly as an HTTP endpoint.
    issueSession, verifySensitiveAction
};
