const { redisClient } = require('../src/config/redis.js');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;

// Increment and set expiry atomically. If the process crashes between INCR
// and EXPIRE, a split-command limiter could otherwise leave a permanent key.
const RATE_LIMIT_SCRIPT = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('TTL', KEYS[1])",
    "return { count, ttl }"
].join('\n');

function createChatbotRateLimiter({
    redis = redisClient,
    windowSeconds = WINDOW_SECONDS,
    maxRequests = MAX_REQUESTS
} = {}) {
    return async function chatbotRateLimiter(req, res, next) {
        if (!redis.isReady) {
            return res.status(503).json({ message: 'Dịch vụ giới hạn truy cập hiện chưa sẵn sàng' });
        }

        try {
            const key = `rate-limit:assistant:user:${String(req.user.sub)}`;
            const result = await redis.eval(RATE_LIMIT_SCRIPT, {
                keys: [key],
                arguments: [String(windowSeconds)]
            });
            const count = Number(result?.[0]);
            const ttl = Number(result?.[1]);

            if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttl)) {
                throw new Error('Invalid chatbot rate-limit response');
            }

            if (count > maxRequests) {
                res.setHeader('Retry-After', String(Math.max(1, ttl)));
                return res.status(429).json({ message: 'Bạn đã gửi quá nhiều yêu cầu tới trợ lý. Vui lòng thử lại sau.' });
            }

            return next();
        } catch (error) {
            console.error('[CHATBOT RATE LIMIT]', { code: error?.code || 'REDIS_ERROR' });
            return res.status(503).json({ message: 'Không thể kiểm tra giới hạn truy cập. Vui lòng thử lại.' });
        }
    };
}

module.exports = createChatbotRateLimiter();
module.exports.createChatbotRateLimiter = createChatbotRateLimiter;
module.exports.RATE_LIMIT_SCRIPT = RATE_LIMIT_SCRIPT;
