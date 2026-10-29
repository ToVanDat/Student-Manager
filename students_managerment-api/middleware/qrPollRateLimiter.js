'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

const QR_WINDOW_MS = 2 * 60 * 1000;

// The browser polls once every 2 seconds while a QR request lives for 120s.
// Allow slightly more than the expected 60 polls per challenge, with a
// separate IP-wide ceiling to prevent bypass by rotating arbitrary request IDs.
const qrPollIpRateLimiter = rateLimit({
    windowMs: QR_WINDOW_MS,
    limit: 600,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:qr-poll-ip:' }),
    message: {
        code: 'QR_POLL_IP_RATE_LIMITED',
        message: 'Quá nhiều yêu cầu kiểm tra đăng nhập QR từ mạng này. Vui lòng thử lại sau.'
    }
});

const qrPollChallengeRateLimiter = rateLimit({
    windowMs: QR_WINDOW_MS,
    limit: 70,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = ipKeyGenerator(req.ip || '0.0.0.0');
        const requestId = typeof req.body?.requestId === 'string' && req.body.requestId.length <= 128
            ? req.body.requestId
            : 'missing';
        return ip + ':' + requestId;
    },
    store: new RedisRateLimitStore({ prefix: 'rate-limit:qr-poll-challenge:' }),
    message: {
        code: 'QR_POLL_CHALLENGE_RATE_LIMITED',
        message: 'Yêu cầu đăng nhập QR đã kiểm tra quá nhiều lần. Hãy tạo mã QR mới.'
    }
});

module.exports = {
    qrPollIpRateLimiter,
    qrPollChallengeRateLimiter
};
