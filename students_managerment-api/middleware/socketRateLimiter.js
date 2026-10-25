const { redisClient } = require('../src/config/redis.js');

const SOCKET_EVENT_LIMITS = {
    'auth:token-refresh': { limit: 5, windowMs: 60_000 },
    'e2ee:subscribe': { limit: 10, windowMs: 60_000 },
    'call:sync-pending': { limit: 5, windowMs: 30_000 },
    'presence:sync': { limit: 10, windowMs: 10_000 },
    'conversation:join': { limit: 20, windowMs: 10_000 },
    'message:send': { limit: 15, windowMs: 10_000 },
    'message:edit': { limit: 10, windowMs: 10_000 },
    'message:recall': { limit: 10, windowMs: 10_000 },
    'message:delete:me': { limit: 10, windowMs: 10_000 },
    'message:delete:everyone': { limit: 10, windowMs: 10_000 },
    'message:reaction:add': { limit: 20, windowMs: 10_000 },
    'message:reaction:remove': { limit: 20, windowMs: 10_000 },
    'message:read': { limit: 30, windowMs: 10_000 },
    'typing:start': { limit: 8, windowMs: 5_000 },
    'typing:stop': { limit: 15, windowMs: 5_000 },
    'call:start': { limit: 3, windowMs: 60_000 },
    'call:accept': { limit: 10, windowMs: 10_000 },
    'call:reject': { limit: 10, windowMs: 10_000 },
    'call:offer': { limit: 30, windowMs: 10_000 },
    'call:answer': { limit: 30, windowMs: 10_000 },
    'call:reconnect-request': { limit: 5, windowMs: 10_000 },
    'call:connected': { limit: 10, windowMs: 10_000 },
    'call:connection-failed': { limit: 10, windowMs: 10_000 },
    'call:ice-candidate': { limit: 120, windowMs: 10_000 },
    'call:end': { limit: 10, windowMs: 10_000 }
};


const consumeSocketRateLimit = async ({ userId, eventName, limit, windowMs }) => {
    if (!redisClient.isReady) {
        throw new Error('Redis is not ready; realtime rate limiting is unavailable');
    }

    const script = `
        local hits = redis.call('INCR', KEYS[1])
        local ttl = redis.call('PTTL', KEYS[1])
        if ttl < 0 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
            ttl = ARGV[1]
        end
        return { hits, ttl }
    `;
    const key = `rate-limit:socket:${userId}:${eventName}`;
    const result = await redisClient.eval(script, {
        keys: [key],
        arguments: [String(windowMs)]
    });
    const totalHits = Number(result?.[0]);
    const ttl = Number(result?.[1]);

    if (!Number.isSafeInteger(totalHits) || totalHits < 1 || !Number.isFinite(ttl) || ttl < 0) {
        throw new Error('Redis returned an invalid realtime rate-limit result');
    }

    return {
        allowed: totalHits <= limit,
        totalHits,
        retryAfterMs: Math.max(1, ttl)
    };
};

module.exports = {
    SOCKET_EVENT_LIMITS,
    consumeSocketRateLimit
};
