const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

// Keep the legacy biometric-login (WebAuthn passkey) routes isolated from unrelated auth operations
// (refresh, Google, QR, password login, registration, etc.).
const biometricAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:biometric-auth:' }),
    message: {
        code: 'BIOMETRIC_RATE_LIMITED',
        message: 'Quá nhiều lần thử đăng nhập bằng Passkey. Vui lòng thử lại sau.'
    }
});

module.exports = biometricAuthRateLimiter;
