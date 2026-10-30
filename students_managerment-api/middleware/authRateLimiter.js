const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

// Keep the safety quota scoped to one authentication endpoint. Sharing one
// IP bucket across Google, Passkey, QR, refresh, registration and recovery
// makes unrelated auth actions consume each other's allowance.
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
        const ip = ipKeyGenerator(req.ip);
        const route = req.route?.path || req.path;
        return `${ip}:${req.method}:${route}`;
    },
    store: new RedisRateLimitStore({ prefix: 'rate-limit:auth:' }),
    message: {
        code: 'AUTH_ENDPOINT_RATE_LIMITED',
        message: 'Quá nhiều yêu cầu cho chức năng xác thực này. Vui lòng thử lại sau.'
    }
});

module.exports = authRateLimiter;
