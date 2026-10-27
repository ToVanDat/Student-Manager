const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

// Count failed password-login attempts only. Successful logins are released
// from the counter, and unrelated auth endpoints use their own limiter.
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:password-login:' }),
    message: {
        code: 'LOGIN_RATE_LIMITED',
        message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
    }
});

module.exports = loginRateLimiter;