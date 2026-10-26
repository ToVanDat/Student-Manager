const { redisClient } = require('../src/config/redis');

const WINDOW_SECONDS = 60;
const PAIR_LIMIT = 8;
const REQUESTER_LIMIT = 60;

// Increment both counters atomically so concurrent API requests cannot bypass
// the fixed-window limits. Redis is shared by every API instance.
const INCREMENT_SCRIPT = `
local pairCount = redis.call('INCR', KEYS[1])
if pairCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local requesterCount = redis.call('INCR', KEYS[2])
if requesterCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
return {
  pairCount,
  redis.call('TTL', KEYS[1]),
  requesterCount,
  redis.call('TTL', KEYS[2])
}
`;

module.exports = async (req, res, next) => {
    const requesterId = Number(req.user?.id);
    const targetUserId = Number(req.params?.userId);

    // Let the controller return the canonical validation error for malformed IDs.
    if (!Number.isSafeInteger(requesterId) || requesterId <= 0 ||
        !Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
        return next();
    }

    // Own-device bundle reads do not consume another account's prekeys.
    if (requesterId === targetUserId) return next();

    try {
        const result = await redisClient.eval(INCREMENT_SCRIPT, {
            keys: [
                `e2ee:prekey-bundle:pair:${requesterId}:${targetUserId}`,
                `e2ee:prekey-bundle:requester:${requesterId}`
            ],
            arguments: [String(WINDOW_SECONDS)]
        });
        const [pairCount, pairTtl, requesterCount, requesterTtl] = result.map(Number);
        if (pairCount > PAIR_LIMIT || requesterCount > REQUESTER_LIMIT) {
            const retryAfter = Math.max(1, Math.min(
                Number.isFinite(pairTtl) && pairTtl > 0 ? pairTtl : WINDOW_SECONDS,
                Number.isFinite(requesterTtl) && requesterTtl > 0 ? requesterTtl : WINDOW_SECONDS
            ));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                code: 'E2EE_PREKEY_RATE_LIMITED',
                message: 'Quá nhiều yêu cầu lấy prekey bundle; vui lòng thử lại sau.'
            });
        }
        return next();
    } catch (error) {
        // Do not silently fall back to a per-process memory counter: doing so
        // would make the abuse limit inconsistent across API replicas.
        console.error('[E2EE][prekey-rate-limit] Redis unavailable:', error.message);
        return res.status(503).json({
            code: 'E2EE_RATE_LIMIT_UNAVAILABLE',
            message: 'Dịch vụ bảo vệ E2EE tạm thời chưa sẵn sàng.'
        });
    }
};

module.exports.WINDOW_SECONDS = WINDOW_SECONDS;
module.exports.PAIR_LIMIT = PAIR_LIMIT;
module.exports.REQUESTER_LIMIT = REQUESTER_LIMIT;
