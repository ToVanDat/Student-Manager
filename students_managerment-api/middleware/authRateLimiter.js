const rateLimit =
    require('express-rate-limit');

const authRateLimiter =
    rateLimit({
        windowMs: 15 * 60 * 1000,

        max: 20,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            message:
                'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.'
        }
    });

module.exports = authRateLimiter;