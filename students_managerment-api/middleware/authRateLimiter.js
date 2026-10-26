const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:auth:' }),
    message: {
        message: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.'
    }
});

module.exports = authRateLimiter;
