const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {
    redisClient
} = require('../src/config/redis.js');

const authRepository =
    require('../repository/authRepository.js');


const authMiddleware = async (
    req,
    res,
    next
) => {

    try {

        // ==================================================
        // 1. CHECK REDIS
        // ==================================================

        if (!redisClient.isReady) {

            console.error(
                'Redis chưa sẵn sàng'
            );

            return res.status(503).json({
                message:
                    'Authentication service chưa sẵn sàng'
            });
        }


        // ==================================================
        // 2. GET AUTHORIZATION HEADER
        // ==================================================

        const authHeader =
            req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({
                message:
                    'Không có Access Token'
            });
        }


        // ==================================================
        // 3. CHECK BEARER
        // ==================================================

        const parts =
            authHeader.split(' ');


        if (
            parts.length !== 2 ||
            parts[0] !== 'Bearer'
        ) {

            return res.status(401).json({
                message:
                    'Authorization không hợp lệ'
            });
        }


        const token =
            parts[1];


        if (!token) {

            return res.status(401).json({
                message:
                    'Access Token không tồn tại'
            });
        }


        // ==================================================
        // 4. VERIFY JWT
        // ==================================================

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET,
                {
                    issuer:
                        'student-management-api',

                    audience:
                        'student-management-client'
                }
            );


        // ==================================================
        // 5. CHECK JWT PAYLOAD
        // ==================================================

        if (!decoded.sub) {

            return res.status(401).json({
                message:
                    'Access Token không chứa User ID'
            });
        }


        if (!decoded.sessionId) {

            return res.status(401).json({
                message:
                    'Access Token không chứa Session ID'
            });
        }


        // ==================================================
        // 6. HASH ACCESS TOKEN
        // ==================================================

        const accessTokenHash =
            crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');


        const redisKey =
            `access_token:${accessTokenHash}`;


        // ==================================================
        // 7. CHECK ACCESS TOKEN IN REDIS
        // ==================================================

        const redisUserId =
            await redisClient.get(
                redisKey
            );


        if (!redisUserId) {

            return res.status(401).json({
                message:
                    'Access Token đã bị thu hồi hoặc không tồn tại'
            });
        }


        // ==================================================
        // 8. CHECK USER ID
        // ==================================================

        if (
            String(redisUserId) !==
            String(decoded.sub)
        ) {

            return res.status(401).json({
                message:
                    'Access Token không hợp lệ'
            });
        }


        // ==================================================
        // 9. CHECK SESSION
        // ==================================================

        const session =
            await authRepository
                .findSessionByIdAndUserId(
                    decoded.sessionId,
                    decoded.sub
                );


        if (!session) {

            return res.status(401).json({
                message:
                    'Session không tồn tại'
            });
        }


        // ==================================================
        // 10. CHECK SESSION REVOKED
        // ==================================================

        if (
            session.revoked_at !== null
        ) {

            return res.status(401).json({
                message:
                    'Session đã bị thu hồi'
            });
        }


        // ==================================================
        // 11. LOAD CURRENT USER STATE
        // Never authorize from a potentially stale JWT role.
        // ==================================================

        const currentUser =
            await authRepository.findUserById(decoded.sub);

        if (!currentUser) {
            return res.status(401).json({
                message: 'Tài khoản không còn tồn tại'
            });
        }

        if (!currentUser.is_active) {
            return res.status(403).json({
                message: 'Tài khoản đã bị khóa'
            });
        }

        // ==================================================
        // 12. SAVE CURRENT USER INTO REQUEST
        // ==================================================

        req.user = {
            id: currentUser.id,
            sub: currentUser.id,
            username: currentUser.username,
            role: currentUser.role,
            sessionId: decoded.sessionId
        };


        // ==================================================
        // 13. NEXT
        // ==================================================

        next();


    } catch (error) {

        console.error(
            'JWT AUTH ERROR:',
            error.message
        );


        return res.status(401).json({

            message:
                'Access Token không hợp lệ hoặc đã hết hạn'

        });
    }
};


module.exports =
    authMiddleware;