const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

const faceAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:face-auth:' }),
    message: {
        code: 'FACE_AUTH_RATE_LIMITED',
        message: 'Quá nhiều lần thử Face Login. Vui lòng thử lại sau.'
    }
});

module.exports = faceAuthRateLimiter;
