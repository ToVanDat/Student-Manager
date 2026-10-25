const { redisClient } = require('../src/config/redis.js');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;

module.exports = async function chatbotRateLimiter(req, res, next) {
    if (!redisClient.isReady) {
        return res.status(503).json({ message: 'Dịch vụ giới hạn truy cập hiện chưa sẵn sàng' });
    }

    try {
        const key = `rate-limit:assistant:user:${String(req.user.sub)}`;
        const count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, WINDOW_SECONDS);

        if (count > MAX_REQUESTS) {
            res.setHeader('Retry-After', String(WINDOW_SECONDS));
            return res.status(429).json({ message: 'Bạn đã gửi quá nhiều yêu cầu tới trợ lý. Vui lòng thử lại sau một phút.' });
        }

        return next();
    } catch (error) {
        console.error('[CHATBOT RATE LIMIT]', { code: error?.code || 'REDIS_ERROR' });
        return res.status(503).json({ message: 'Không thể kiểm tra giới hạn truy cập. Vui lòng thử lại.' });
    }
};
