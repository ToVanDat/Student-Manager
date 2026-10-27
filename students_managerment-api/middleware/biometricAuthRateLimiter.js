const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

// Keep device-biometric login traffic isolated from unrelated auth operations
// (refresh, Google, QR, password login, registration, etc.).
const biometricAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:biometric-auth:' }),
    message: {
        code: 'BIOMETRIC_RATE_LIMITED',
        message: 'Quá nhiều lần thử đăng nhập sinh trắc học. Vui lòng thử lại sau.'
    }
});

module.exports = biometricAuthRateLimiter;
