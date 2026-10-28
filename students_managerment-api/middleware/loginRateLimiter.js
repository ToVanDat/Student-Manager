const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

// IP-level safety net: count failed password-login attempts only.
// Account/IP progressive cooldown is enforced separately by passwordLoginProtection.
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:password-login:' }),
    message: {
        code: 'LOGIN_IP_RATE_LIMITED',
        message: 'Bạn đang thực hiện quá nhiều yêu cầu đăng nhập từ mạng này. Vui lòng chờ một lúc rồi thử lại.'
    }
});

module.exports = loginRateLimiter;
