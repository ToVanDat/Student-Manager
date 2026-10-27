'use strict';

const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('./redisRateLimitStore');

module.exports = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 80,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore({ prefix: 'rate-limit:face-frames:' }),
    message: {
        code: 'FACE_FRAME_RATE_LIMITED',
        message: 'Quá nhiều frame Face Login. Vui lòng thử lại sau.'
    }
});
