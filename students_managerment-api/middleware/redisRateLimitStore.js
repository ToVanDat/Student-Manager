const { redisClient } = require('../src/config/redis');

const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = ARGV[1]
end
return { hits, ttl }
`;

const DECREMENT_SCRIPT = `
local hits = redis.call('DECR', KEYS[1])
if hits <= 0 then
    redis.call('DEL', KEYS[1])
    return 0
end
return hits
`;

class RedisRateLimitStore {
    constructor({ prefix = 'rate-limit:' } = {}) {
        this.prefix = prefix;
        this.windowMs = 15 * 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        const redisKey = this.prefix + key;
        const result = await redisClient.eval(INCREMENT_SCRIPT, {
            keys: [redisKey],
            arguments: [String(this.windowMs)]
        });

        const totalHits = Number(result?.[0]);
        const ttl = Number(result?.[1]);

        if (!Number.isFinite(totalHits) || !Number.isFinite(ttl)) {
            throw new Error('Redis rate-limit store returned an invalid increment result');
        }

        return {
            totalHits,
            resetTime: new Date(Date.now() + Math.max(0, ttl))
        };
    }

    async decrement(key) {
        await redisClient.eval(DECREMENT_SCRIPT, {
            keys: [this.prefix + key],
            arguments: []
        });
    }

    async resetKey(key) {
        await redisClient.del(this.prefix + key);
    }
}

module.exports = RedisRateLimitStore;
