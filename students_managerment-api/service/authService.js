const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { redisClient } = require('../src/config/redis.js');
const authRepository = require('../repository/authRepository');
const emailService = require('./emailService.js');

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


// =====================================================
// HASH ACCESS TOKEN
// =====================================================

const hashAccessToken = (token) => {

    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
};


// =====================================================
// HASH REFRESH TOKEN
// =====================================================

const hashRefreshToken = (token) => {

    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
};


// =====================================================
// GENERATE ACCESS TOKEN
// =====================================================

const generateAccessToken = (
    user,
    sessionId
) => {

    return jwt.sign(

        {
            sub: user.id,
            username: user.username,
            role: user.role,
            sessionId: sessionId
        },

        process.env.JWT_SECRET,

        {
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        }
    );
};


// =====================================================
// SAVE ACCESS TOKEN TO REDIS
// =====================================================

const saveAccessTokenToRedis = async (
    accessToken,
    userId
) => {

    const tokenHash =
        hashAccessToken(accessToken);

    const key =
        `access_token:${tokenHash}`;

    const decoded =
        jwt.decode(accessToken);

    if (!decoded || !decoded.exp) {

        throw new Error(
            'Access token không hợp lệ'
        );
    }

    const currentTime =
        Math.floor(Date.now() / 1000);

    const ttl =
        decoded.exp - currentTime;

    if (ttl <= 0) {

        throw new Error(
            'Access token đã hết hạn'
        );
    }

    await redisClient.set(
        key,
        String(userId),
        {
            EX: ttl
        }
    );

    return key;
};


// =====================================================
// REMOVE ACCESS TOKEN FROM REDIS
// =====================================================

const removeAccessTokenFromRedis = async (
    accessToken
) => {

    if (!accessToken) {
        return;
    }

    const tokenHash =
        hashAccessToken(accessToken);

    const key =
        `access_token:${tokenHash}`;

    await redisClient.del(key);
};


// =====================================================
// EMIT SESSION REVOKED
// =====================================================

const emitSessionRevoked = (
    sessionId,
    reason
) => {

    try {

        const { getIO } =
            require('../socket/socket');

        const io = getIO();

        if (!io) {
            return;
        }

        io.to(`session:${sessionId}`)
            .emit(
                'session:revoked',
                {
                    sessionId,
                    reason
                }
            );

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

    const updatedUser =
        await authRepository
            .updateUserPassword(
                userId,
                newPasswordHash
            );

    if (!updatedUser) {

        throw new Error(
            'Không thể cập nhật mật khẩu'
        );
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

        throw new Error(
            'Username hoặc password không đúng'
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
    // CHECK PASSWORD
    // =================================================

    const isPasswordCorrect =
        await bcrypt.compare(
            password,
            user.password_hash
        );

    if (!isPasswordCorrect) {

        throw new Error(
            'Username hoặc password không đúng'
        );
    }


    // =================================================
    // CREATE SESSION
    // =================================================

    const session =
        await authRepository
            .createSession(
                user.id,
                deviceName,
                userAgent,
                ipAddress
            );


    // =================================================
    // GENERATE ACCESS TOKEN
    // =================================================

    const accessToken =
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
            role: user.role
        },

        sessionId: session.id,

        accessToken,

        refreshToken
    };
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
                        audience: JWT_AUDIENCE
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


        // =============================================
        // SOCKET NOTIFICATION
        // =============================================

        emitSessionRevoked(
            sessionId,
            'LOGOUT'
        );


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

        throw new Error(
            'Refresh token không hợp lệ'
        );
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
    // REVOKE OLD REFRESH TOKEN
    // =================================================

    await authRepository
        .revokeRefreshToken(
            tokenRecord.id
        );


    // =================================================
    // SAVE NEW REFRESH TOKEN
    //
    // IMPORTANT:
    //
    // userId
    // sessionId
    // tokenHash
    // expiresAt
    // =================================================

    await authRepository
        .saveRefreshToken(
            user.id,
            session.id,
            newRefreshTokenHash,
            newRefreshTokenExpiresAt
        );


    // =================================================
    // UPDATE SESSION LAST USED
    // =================================================

    await authRepository
        .updateSessionLastUsed(
            session.id
        );


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

        await authRepository
            .incrementPasswordResetAttempt(
                resetToken.id
            );

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

// Lưu hash của reset token
await authRepository.saveResetTokenHash(
    resetToken.id,
    resetTokenHash
);

// Đánh dấu OTP đã được xác thực
await authRepository.markPasswordResetVerified(
    resetToken.id
);

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


    // =============================================
    // UPDATE PASSWORD
    // =============================================

    const user =
        await authRepository.updateUserPassword(
            resetRequest.user_id,
            passwordHash
        );


    if (!user) {

        throw new Error(
            'Không thể cập nhật mật khẩu'
        );
    }


    // =============================================
    // MARK RESET TOKEN USED
    // =============================================

    await authRepository.markPasswordResetUsed(
        resetRequest.id
    );


    // =============================================
    // REVOKE ALL SESSIONS
    // =============================================

    await authRepository.revokeAllSessions(
        resetRequest.user_id
    );


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