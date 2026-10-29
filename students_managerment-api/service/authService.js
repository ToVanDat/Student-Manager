const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const authRepository = require('../repository/authRepository');
const emailService = require('./emailService.js');
const { resetAccountState } = require('./passwordLoginProtection.js');
const { retryRedisCleanup } = require('./redisCleanupRetry.js');

// =====================================================
// CONFIG
// =====================================================

const ACCESS_TOKEN_EXPIRES_IN = '30m';

const REFRESH_TOKEN_EXPIRES_MS =
    7 * 24 * 60 * 60 * 1000;

const JWT_ISSUER =
    'student-management-api';

const JWT_AUDIENCE =
    'student-management-client';


const {
    saveAccessTokenToRedis,
    removeAccessTokenFromRedis,
    removeAccessTokensForSession,
} = require('./accessTokenStore.js');


// =====================================================
// EMIT SESSION REVOKED
// =====================================================

const emitSessionRevoked = (
    sessionId,
    reason
) => {

    try {

        const { emitSessionRevoked: revokeSocketSession } =
            require('../src/socket/socket.js');

        revokeSocketSession(sessionId, reason);

    } catch (error) {

        console.error(
            'Socket emit session revoked error:',
            error.message
        );
    }
};


// =====================================================
// GET CURRENT USER
// =====================================================

// Revoke all sessions after a credential change and disconnect their sockets.
const revokeUserSessions = async (userId, reason = 'CREDENTIALS_CHANGED') => {
    const sessions = await authRepository.revokeAllSessions(userId);

    for (const session of sessions || []) {
        await authRepository.revokeRefreshTokensBySessionId(session.id);
        try {
            await removeAccessTokensForSession(session.id);
        } catch (error) {
            console.warn('[AUTH] Could not clear revoked session access tokens:', error.message);
        }
        emitSessionRevoked(session.id, reason);
    }
};

const getMe = async (userId) => {

    if (!userId) {

        throw new Error(
            'User ID không hợp lệ'
        );
    }

    const user =
        await authRepository.findUserById(
            userId
        );

    if (!user) {

        throw new Error(
            'Không tìm thấy user'
        );
    }

    return user;
};


// =====================================================
// UPDATE PROFILE
// username + email
// =====================================================

const updateProfile = async (
    userId,
    username,
    email
) => {

    if (!userId) {

        throw new Error(
            'User ID không hợp lệ'
        );
    }


    // =================================================
    // VALIDATE USERNAME
    // =================================================

    if (
        !username ||
        !String(username).trim()
    ) {

        throw new Error(
            'Username là bắt buộc'
        );
    }


    // =================================================
    // VALIDATE EMAIL
    // =================================================

    if (
        !email ||
        !String(email).trim()
    ) {

        throw new Error(
            'Email là bắt buộc'
        );
    }


    username =
        String(username).trim();

    email =
        String(email)
            .trim()
            .toLowerCase();


    // =================================================
    // CHECK DUPLICATE USERNAME
    // =================================================

    const existingUsername =
        await authRepository
            .findUserByUsernameExceptId(
                username,
                userId
            );

    if (existingUsername) {

        throw new Error(
            'Username đã tồn tại'
        );
    }


    // =================================================
    // CHECK DUPLICATE EMAIL
    // =================================================

    const existingEmail =
        await authRepository
            .findUserByEmailExceptId(
                email,
                userId
            );

    if (existingEmail) {

        throw new Error(
            'Email đã tồn tại'
        );
    }


    // =================================================
    // UPDATE DATABASE
    // =================================================

    const updatedUser =
        await authRepository
            .updateUserProfile(
                userId,
                username,
                email
            );

    if (!updatedUser) {

        throw new Error(
            'Không tìm thấy user'
        );
    }

    return updatedUser;
};


// =====================================================
// CHANGE PASSWORD
// =====================================================

const changePassword = async (
    userId,
    currentPassword,
    newPassword
) => {

    if (!userId) {

        throw new Error(
            'User ID không hợp lệ'
        );
    }


    if (!currentPassword) {

        throw new Error(
            'Mật khẩu hiện tại là bắt buộc'
        );
    }


    if (!newPassword) {

        throw new Error(
            'Mật khẩu mới là bắt buộc'
        );
    }


    if (newPassword.length < 8) {

        throw new Error(
            'Mật khẩu mới phải có ít nhất 8 ký tự'
        );
    }


    if (newPassword === currentPassword) {

        throw new Error(
            'Mật khẩu mới phải khác mật khẩu hiện tại'
        );
    }


    // =================================================
    // GET USER WITH PASSWORD HASH
    // =================================================

    const user =
        await authRepository
            .findUserByIdWithPassword(
                userId
            );

    if (!user) {

        throw new Error(
            'Không tìm thấy user'
        );
    }


    // =================================================
    // CHECK ACCOUNT
    // =================================================

    if (!user.is_active) {

        throw new Error(
            'Tài khoản đã bị khóa'
        );
    }


    // =================================================
    // VERIFY CURRENT PASSWORD
    // =================================================

    const isPasswordCorrect =
        await bcrypt.compare(
            currentPassword,
            user.password_hash
        );

    if (!isPasswordCorrect) {

        throw new Error(
            'Mật khẩu hiện tại không đúng'
        );
    }


    // =================================================
    // HASH NEW PASSWORD
    // =================================================

    const newPasswordHash =
        await bcrypt.hash(
            newPassword,
            10
        );


    // =================================================
    // UPDATE PASSWORD
    // =================================================

    const result =
        await authRepository.updatePasswordAndRevokeSessions(
            userId,
            newPasswordHash
        );

    if (!result) {
        throw new Error('Không thể cập nhật mật khẩu');
    }

    // PostgreSQL is already committed. Retry Redis cleanup briefly without
    // turning a successful password change into a failed HTTP response.
    await retryRedisCleanup(
        () => resetAccountState(user.username),
        { operation: 'password-change cooldown cleanup' }
    );

    // Database revocation is already committed atomically. Socket notification
    // is best-effort and must not turn a successful credential change into 500.
    for (const sessionId of result.revokedSessionIds || []) {
        try {
            await removeAccessTokensForSession(sessionId);
        } catch (error) {
            console.warn('[AUTH] Could not clear password-change access tokens:', error.message);
        }
        try {
            emitSessionRevoked(sessionId, 'PASSWORD_CHANGED');
        } catch (error) {
            console.warn('[AUTH] Không thể gửi thông báo revoke socket:', error.message);
        }
    }

    return true;
};

//forgot password
const forgotPassword = async (email) => {

    const normalizedEmail =
        email.trim().toLowerCase();

    const user =
        await authRepository.findUserByEmail(
            normalizedEmail
        );

    /*
     * Không tiết lộ email có tồn tại
     */
    if (!user) {
        return;
    }

    /*
     * Không gửi OTP cho account bị khóa
     */
    if (!user.is_active) {
        return;
    }

    /*
     * Vô hiệu hóa OTP cũ
     */
    await authRepository
        .invalidatePasswordResetTokens(
            user.id
        );

    /*
     * Tạo OTP 6 số
     */
    const otp =
        crypto
            .randomInt(
                100000,
                1000000
            )
            .toString();

    /*
     * Hash OTP
     */
    const otpHash =
        crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

    /*
     * OTP hết hạn sau 5 phút
     */
    const expiresAt =
        new Date(
            Date.now() +
            5 * 60 * 1000
        );

    /*
     * Lưu hash vào PostgreSQL
     */
    await authRepository
        .createPasswordResetToken(
            user.id,
            otpHash,
            expiresAt
        );

    /*
     * Gửi OTP qua Resend
     */
    try {

        await emailService
            .sendPasswordResetOtp(
                normalizedEmail,
                otp
            );

    } catch (error) {

        console.error(
            'PASSWORD RESET EMAIL ERROR:',
            error
        );

        throw new Error(
            'Không thể gửi email OTP'
        );
    }
};

// =====================================================
// REGISTER
// =====================================================

const register = async (
    username,
    email,
    password
) => {

    // =================================================
    // VALIDATION
    // =================================================

    if (!username) {

        throw new Error(
            'Username là bắt buộc'
        );
    }

    if (!email) {

        throw new Error(
            'Email là bắt buộc'
        );
    }

    if (!password) {

        throw new Error(
            'Password là bắt buộc'
        );
    }

    if (password.length < 8) {

        throw new Error(
            'Mật khẩu phải có ít nhất 8 ký tự'
        );
    }


    // =================================================
    // CHECK USERNAME
    // =================================================

    const existingUsername =
        await authRepository
            .findUserByUsername(
                username
            );

    if (existingUsername) {

        throw new Error(
            'Username đã tồn tại'
        );
    }


    // =================================================
    // CHECK EMAIL
    // =================================================

    const existingEmail =
        await authRepository
            .findUserByEmail(
                email
            );

    if (existingEmail) {

        throw new Error(
            'Email đã tồn tại'
        );
    }


    // =================================================
    // HASH PASSWORD
    // =================================================

    const passwordHash =
        await bcrypt.hash(
            password,
            10
        );


    // =================================================
    // CREATE USER
    // =================================================

    const user =
        await authRepository
            .createUser(
                username,
                email,
                passwordHash
            );


    return user;
};


// =====================================================
// LOGIN
// =====================================================

const login = async (
    username,
    password,
    deviceName,
    userAgent,
    ipAddress
) => {

    // =================================================
    // VALIDATION
    // =================================================

    if (!username) {

        throw new Error(
            'Username là bắt buộc'
        );
    }

    if (!password) {

        throw new Error(
            'Password là bắt buộc'
        );
    }


    // =================================================
    // FIND USER
    // =================================================

    const user =
        await authRepository
            .findUserByUsername(
                username
            );

    if (!user) {
        const error = new Error('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại và thử lại.');
        error.code = 'AUTH_INVALID_CREDENTIALS';
        throw error;
    }


    // =================================================
    // CHECK ACCOUNT
    // =================================================

    if (!user.is_active) {
        const error = new Error('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại và thử lại.');
        error.code = 'AUTH_INVALID_CREDENTIALS';
        throw error;
    }


    // =================================================
    // CHECK PASSWORD
    // =================================================

    const isPasswordCorrect =
        await bcrypt.compare(
            password,
            user.password_hash
        );

    if (!isPasswordCorrect) {
        const error = new Error('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại và thử lại.');
        error.code = 'AUTH_INVALID_CREDENTIALS';
        throw error;
    }


    // =================================================
    // MULTIPLE ACTIVE SESSIONS PER USER
    // =================================================
    // Keep existing sessions active when the same account signs in on another
    // browser or device. Each login receives its own session ID and refresh
    // token; explicit session revocation and credential changes still revoke
    // sessions through the dedicated session/security flows.

    // =================================================
    // CREATE SESSION
    // =================================================

    let session = null;
    let accessToken = null;

    try {
    session = await authRepository.createSessionForActiveUser(
        user.id,
        deviceName,
        userAgent,
        ipAddress
    );

    // The account may have been disabled after password verification.
    // Re-check under a row lock before issuing any session credentials.
    if (!session) {
        const error = new Error('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra và thử lại.');
        error.code = 'AUTH_INVALID_CREDENTIALS';
        throw error;
    }

    // =================================================
    // GENERATE ACCESS TOKEN
    // =================================================

    accessToken =
        generateAccessToken(
            user,
            session.id
        );


    // =================================================
    // SAVE ACCESS TOKEN TO REDIS
    // =================================================

    await saveAccessTokenToRedis(
        accessToken,
        user.id
    );


    // =================================================
    // GENERATE REFRESH TOKEN
    // =================================================

    const refreshToken =
        crypto
            .randomBytes(64)
            .toString('hex');


    // =================================================
    // HASH REFRESH TOKEN
    // =================================================

    const refreshTokenHash =
        hashRefreshToken(
            refreshToken
        );


    // =================================================
    // REFRESH TOKEN EXPIRATION
    // =================================================

    const refreshTokenExpiresAt =
        new Date(
            Date.now() +
            REFRESH_TOKEN_EXPIRES_MS
        );


    // =================================================
    // SAVE REFRESH TOKEN
    // IMPORTANT:
    //
    // repository signature:
    // saveRefreshToken(
    //     userId,
    //     sessionId,
    //     tokenHash,
    //     expiresAt
    // )
    // =================================================

    await authRepository
        .saveRefreshToken(
            user.id,
            session.id,
            refreshTokenHash,
            refreshTokenExpiresAt
        );


    // =================================================
    // RETURN
    // =================================================

    return {

        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url || null
        },

        sessionId: session.id,

        accessToken,

        refreshToken
    };
    } catch (error) {
        // Password login spans PostgreSQL and Redis. Compensate partial writes
        // so a failed login cannot leave an active orphan session.
        if (accessToken) {
            try {
                await removeAccessTokenFromRedis(accessToken);
            } catch (cleanupError) {
                console.error('Login access-token cleanup failed:', cleanupError.code || cleanupError.message);
            }
        }

        if (session?.id) {
            try {
                await authRepository.revokeSessionForUserAndRefreshTokens(session.id, user.id);
            } catch (cleanupError) {
                console.error('Login session cleanup failed:', cleanupError.code || cleanupError.message);
            }
        }

        throw error;
    }
};


// =====================================================
// LOGOUT
// =====================================================

const logout = async (
    accessToken,
    refreshToken
) => {

    let sessionId = null;

    let refreshTokenRecord = null;


    // =================================================
    // GET SESSION FROM ACCESS TOKEN
    // =================================================

    if (accessToken) {

        try {

            const decoded =
                jwt.verify(
                    accessToken,
                    process.env.JWT_SECRET,
                    {
                        issuer: JWT_ISSUER,
                        audience: JWT_AUDIENCE,
                        algorithms: ['HS256']
                    }
                );

            sessionId =
                decoded.sessionId;

        } catch (error) {

            console.log(
                'Access token verify failed during logout'
            );
        }
    }


    // =================================================
    // FALLBACK:
    // GET SESSION FROM REFRESH TOKEN
    // =================================================

    if (
        !sessionId &&
        refreshToken
    ) {

        const refreshTokenHash =
            hashRefreshToken(
                refreshToken
            );

        refreshTokenRecord =
            await authRepository
                .findRefreshToken(
                    refreshTokenHash
                );

        if (refreshTokenRecord) {

            sessionId =
                refreshTokenRecord.session_id;
        }
    }


    // =================================================
    // REMOVE ACCESS TOKEN FROM REDIS
    // =================================================

    if (accessToken) {

        await removeAccessTokenFromRedis(
            accessToken
        );
    }


    // =================================================
    // REVOKE SESSION
    // =================================================

    if (sessionId) {

        await authRepository
            .revokeSession(
                sessionId
            );


        // =============================================
        // REVOKE ALL REFRESH TOKENS OF SESSION
        // =============================================

        await authRepository
            .revokeRefreshTokensBySessionId(
                sessionId
            );

        try {
            await removeAccessTokensForSession(sessionId);
        } catch (cleanupError) {
            console.warn('[AUTH] Could not clear logout access tokens:', cleanupError.message);
        }

        // Notify every tab/socket in this session and disconnect it. The
        // frontend treats LOGOUT as a silent local cleanup, not a forced-login
        // warning. E2EE identity material remains in the browser keystore.
        try {
            const { emitSessionRevoked } = require('../src/socket/socket.js');
            emitSessionRevoked(sessionId, 'LOGOUT');
        } catch (socketError) {
            // Database revocation is authoritative. Socket notification is
            // best-effort and must not turn a successful logout into HTTP 500.
            console.error('[AUTH][logout socket notification failed]', socketError.message);
        }

        return {
            success: true
        };
    }


    // =================================================
    // FALLBACK:
    // REVOKE REFRESH TOKEN
    // =================================================

    if (refreshTokenRecord) {

        await authRepository
            .revokeRefreshToken(
                refreshTokenRecord.id
            );
    }


    return {
        success: true
    };
};


// =====================================================
// REFRESH ACCESS TOKEN
// =====================================================

const refresh = async (
    refreshToken
) => {

    if (!refreshToken) {

        throw new Error(
            'Refresh token không tồn tại'
        );
    }


    // =================================================
    // HASH REFRESH TOKEN
    // =================================================

    const refreshTokenHash =
        hashRefreshToken(
            refreshToken
        );


    // =================================================
    // FIND REFRESH TOKEN
    // =================================================

    const tokenRecord =
        await authRepository
            .findRefreshToken(
                refreshTokenHash
            );


    if (!tokenRecord) {
        // A known, revoked, unexpired token may be a replay of a token that
        // was already rotated. Treat the session as the token family and
        // revoke it atomically; unknown and expired tokens remain generic 401s.
        const historicalToken = await authRepository.findRefreshTokenByHash(
            refreshTokenHash
        );

        if (
            historicalToken?.revoked_at &&
            new Date(historicalToken.expires_at) > new Date()
        ) {
            const revokedSession = await authRepository.revokeSessionOnRefreshTokenReuse(
                refreshTokenHash,
                historicalToken.user_id,
                historicalToken.session_id
            );

            if (revokedSession) {
                try {
                    await removeAccessTokensForSession(revokedSession.id);
                } catch (cleanupError) {
                    console.warn('[AUTH] Could not clear replayed session access tokens:', cleanupError.message);
                }

                try {
                    emitSessionRevoked(
                        revokedSession.id,
                        'REFRESH_TOKEN_REUSE'
                    );
                } catch (socketError) {
                    // The refresh-token family is already revoked in PostgreSQL.
                    // Socket delivery is only an acceleration of client cleanup.
                    console.warn('[AUTH] Could not notify refresh-token replay revocation:', socketError.message);
                }
            }
        }

        throw new Error('Refresh token không hợp lệ');
    }


    // =================================================
    // CHECK REVOKED
    // =================================================

    if (tokenRecord.revoked_at) {

        throw new Error(
            'Refresh token đã bị revoke'
        );
    }


    // =================================================
    // CHECK EXPIRATION
    // =================================================

    if (
        new Date(tokenRecord.expires_at)
            <= new Date()
    ) {

        throw new Error(
            'Refresh token đã hết hạn'
        );
    }


    // =================================================
    // FIND SESSION
    // =================================================

    const session =
        await authRepository
            .findSessionByIdAndUserId(
                tokenRecord.session_id,
                tokenRecord.user_id
            );


    if (!session) {

        throw new Error(
            'Session không tồn tại'
        );
    }


    // =================================================
    // CHECK SESSION REVOKED
    // =================================================

    if (session.revoked_at) {

        throw new Error(
            'Session đã bị revoke'
        );
    }


    // =================================================
    // FIND USER
    // =================================================

    const user =
        await authRepository
            .findUserById(
                tokenRecord.user_id
            );


    if (!user) {

        throw new Error(
            'Không tìm thấy user'
        );
    }


    // =================================================
    // CHECK ACCOUNT
    // =================================================

    if (!user.is_active) {

        throw new Error(
            'Tài khoản đã bị khóa'
        );
    }


    // =================================================
    // GENERATE NEW ACCESS TOKEN
    // =================================================

    const newAccessToken =
        generateAccessToken(
            user,
            session.id
        );


    // =================================================
    // SAVE NEW ACCESS TOKEN TO REDIS
    // =================================================

    await saveAccessTokenToRedis(
        newAccessToken,
        user.id
    );


    // =================================================
    // GENERATE NEW REFRESH TOKEN
    // =================================================

    const newRefreshToken =
        crypto
            .randomBytes(64)
            .toString('hex');


    // =================================================
    // HASH NEW REFRESH TOKEN
    // =================================================

    const newRefreshTokenHash =
        hashRefreshToken(
            newRefreshToken
        );


    // =================================================
    // NEW REFRESH TOKEN EXPIRATION
    // =================================================

    const newRefreshTokenExpiresAt =
        new Date(
            Date.now() +
            REFRESH_TOKEN_EXPIRES_MS
        );


    // =================================================
    // ATOMIC ROTATION
    // Only one concurrent request can consume this token.
    // =================================================

    let rotatedToken;

    try {
        rotatedToken = await authRepository.rotateRefreshToken(
            tokenRecord.id,
            user.id,
            session.id,
            newRefreshTokenHash,
            newRefreshTokenExpiresAt
        );
    } catch (error) {
        // The Redis access-token entry is not useful if DB rotation failed.
        await removeAccessTokenFromRedis(newAccessToken).catch(() => {});
        throw error;
    }

    if (!rotatedToken) {
        // This request observed an active token before attempting rotation.
        // A competing tab/request may have consumed it in the meantime.
        // Do not classify this race as replay: doing so would revoke the
        // legitimate session when two refreshes overlap. A later request
        // presenting the already-revoked token is handled by the historical
        // lookup above and triggers replay response.
        await removeAccessTokenFromRedis(newAccessToken);

        throw new Error(
            'Refresh token đã được sử dụng, hết hạn hoặc session đã bị thu hồi'
        );
    }


    // =================================================
    // RETURN
    // =================================================

    return {

        accessToken:
            newAccessToken,

        refreshToken:
            newRefreshToken,

        sessionId:
            session.id
    };
};

// =====================================================
// VERIFY RESET OTP
// =====================================================

const verifyResetOtp = async (
    email,
    otp
) => {

    // =================================================
    // VALIDATION
    // =================================================

    if (!email) {
        throw new Error(
            'Email là bắt buộc'
        );
    }

    if (!otp) {
        throw new Error(
            'OTP là bắt buộc'
        );
    }

    const normalizedEmail =
        String(email)
            .trim()
            .toLowerCase();

    const normalizedOtp =
        String(otp).trim();

    // OTP phải có đúng 6 số
    if (!/^\d{6}$/.test(normalizedOtp)) {
        throw new Error(
            'OTP phải gồm 6 chữ số'
        );
    }


    // =================================================
    // FIND USER
    // =================================================

    const user =
        await authRepository.findUserByEmail(
            normalizedEmail
        );

    if (!user) {
        throw new Error(
            'OTP không hợp lệ'
        );
    }


    // =================================================
    // FIND ACTIVE RESET TOKEN
    // =================================================

    const resetToken =
        await authRepository
            .findActivePasswordResetToken(
                user.id
            );

    if (!resetToken) {
        throw new Error(
            'OTP không tồn tại hoặc đã hết hạn'
        );
    }


    // =================================================
    // CHECK ATTEMPTS
    // =================================================

    if (resetToken.attempt_count >= 5) {
        throw new Error(
            'OTP đã vượt quá số lần thử'
        );
    }


    // =================================================
    // HASH OTP
    // =================================================

    const otpHash =
        crypto
            .createHash('sha256')
            .update(normalizedOtp)
            .digest('hex');


    // =================================================
    // COMPARE OTP
    // =================================================

    if (otpHash !== resetToken.token_hash) {

        const attempt = await authRepository
            .incrementPasswordResetAttempt(
                resetToken.id
            );

        if (!attempt || attempt.attempt_count >= 5) {
            throw new Error('OTP đã vượt quá số lần thử');
        }

        throw new Error(
            'OTP không đúng'
        );
    }

   // =================================================
// OTP CORRECT
// =================================================

// Tạo reset token bí mật
const newResetToken =
    crypto.randomBytes(32).toString('hex');

// Hash reset token trước khi lưu database
const resetTokenHash =
    crypto
        .createHash('sha256')
        .update(newResetToken)
        .digest('hex');

// Atomically save the reset-token hash and consume OTP verification.
// This prevents parallel valid-OTP requests from overwriting each other's token.
const verifiedReset = await authRepository.saveVerifiedPasswordResetToken(
    resetToken.id,
    resetTokenHash
);
if (!verifiedReset) {
    throw new Error('OTP đã hết hạn, đã được xác thực hoặc vượt quá số lần thử');
}

// Trả reset token gốc cho client
return {
    resetToken: newResetToken,
    userId: user.id
};
};

const resetPassword = async (
    resetToken,
    newPassword
) => {

    if (!resetToken) {
        throw new Error(
            'Reset token là bắt buộc'
        );
    }


    if (!newPassword) {
        throw new Error(
            'Mật khẩu mới là bắt buộc'
        );
    }


    if (newPassword.length < 8) {
        throw new Error(
            'Mật khẩu mới phải có ít nhất 8 ký tự'
        );
    }


    // =============================================
    // HASH RESET TOKEN
    // =============================================

    const resetTokenHash =
        crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');


    // =============================================
    // TÌM RESET REQUEST
    // =============================================

    const resetRequest =
        await authRepository.findPasswordResetByHash(
            resetTokenHash
        );


    if (!resetRequest) {

        throw new Error(
            'Reset token không hợp lệ'
        );
    }


    // =============================================
    // ĐÃ SỬ DỤNG
    // =============================================

    if (resetRequest.used_at !== null) {

        throw new Error(
            'Reset token đã được sử dụng'
        );
    }


    // =============================================
    // ĐÃ HẾT HẠN
    // =============================================

    if (
        new Date(resetRequest.expires_at)
        <= new Date()
    ) {

        throw new Error(
            'Reset token đã hết hạn'
        );
    }


    // =============================================
    // PHẢI VERIFY OTP TRƯỚC
    // =============================================

    if (resetRequest.verified_at === null) {

        throw new Error(
            'OTP chưa được xác thực'
        );
    }


    // =============================================
    // HASH PASSWORD
    // =============================================

    const passwordHash =
        await bcrypt.hash(
            newPassword,
            10
        );


    // Consume the one-time token, update the password, and revoke every
    // existing session/refresh token atomically in PostgreSQL.
    const result = await authRepository.completePasswordResetAndRevokeSessions(
        resetRequest.id,
        resetRequest.user_id,
        passwordHash
    );

    if (!result) {
        throw new Error('Reset token không hợp lệ, đã được sử dụng hoặc tài khoản không hoạt động');
    }

    // PostgreSQL is already committed. Resolve the account and retry Redis
    // cleanup briefly; Redis failure must not undo the completed password reset.
    try {
        const resetUser = await authRepository.findUserById(resetRequest.user_id);
        if (resetUser?.username) {
            await retryRedisCleanup(
                () => resetAccountState(resetUser.username),
                { operation: 'password-reset cooldown cleanup' }
            );
        }
    } catch (error) {
        console.warn('[AUTH] Could not resolve account for password-reset cooldown cleanup:', error.code || error.message);
    }

    // Session revocation is already committed. Socket delivery is best-effort.
    for (const sessionId of result.revokedSessionIds || []) {
        try {
            await removeAccessTokensForSession(sessionId);
        } catch (error) {
            console.warn('[AUTH] Could not clear password-reset access tokens:', error.message);
        }
        try {
            emitSessionRevoked(sessionId, 'PASSWORD_RESET');
        } catch (error) {
            console.warn('[AUTH] Không thể gửi thông báo revoke socket:', error.message);
        }
    }

    return {
        message:
            'Đặt lại mật khẩu thành công'
    };
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {

    register,

    login,

    getMe,

    updateProfile,

    changePassword,

    forgotPassword,
    
    logout,

    refresh,

    verifyResetOtp,

    resetPassword,



    
};