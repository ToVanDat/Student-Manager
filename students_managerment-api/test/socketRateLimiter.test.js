const test = require('node:test');
const assert = require('node:assert/strict');

const { redisClient } = require('../src/config/redis');
const {
    SOCKET_EVENT_LIMITS,
    consumeSocketRateLimit
} = require('../middleware/socketRateLimiter');

const withRedisReady = async (ready, callback) => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(redisClient, 'isReady');
    Object.defineProperty(redisClient, 'isReady', {
        configurable: true,
        value: ready
    });
    try {
        await callback();
    } finally {
        if (originalDescriptor) {
            Object.defineProperty(redisClient, 'isReady', originalDescriptor);
        } else {
            delete redisClient.isReady;
        }
    }
};

test('socket event policies use distinct limits for chat, typing and WebRTC signaling', () => {
    assert.deepEqual(SOCKET_EVENT_LIMITS['message:send'], {
        limit: 15,
        windowMs: 10_000
    });
    assert.deepEqual(SOCKET_EVENT_LIMITS['typing:start'], {
        limit: 8,
        windowMs: 5_000
    });
    assert.deepEqual(SOCKET_EVENT_LIMITS['call:ice-candidate'], {
        limit: 120,
        windowMs: 10_000
    });
    assert.deepEqual(SOCKET_EVENT_LIMITS['call:start'], {
        limit: 3,
        windowMs: 60_000
    });
});

test('socket rate limiter uses a user-and-event scoped atomic Redis counter', async () => {
    const originalEval = redisClient.eval;
    const calls = [];
    redisClient.eval = async (script, options) => {
        calls.push({ script, options });
        return [4, 2500];
    };

    try {
        await withRedisReady(true, async () => {
            const result = await consumeSocketRateLimit({
                userId: 42,
                eventName: 'message:send',
                limit: 15,
                windowMs: 10_000
            });

            assert.deepEqual(result, {
                allowed: true,
                totalHits: 4,
                retryAfterMs: 2500
            });
        });

        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].options.keys, ['rate-limit:socket:42:message:send']);
        assert.deepEqual(calls[0].options.arguments, ['10000']);
        assert.match(calls[0].script, /INCR/);
        assert.match(calls[0].script, /PEXPIRE/);
    } finally {
        redisClient.eval = originalEval;
    }
});

test('socket rate limiter rejects events over the configured limit', async () => {
    const originalEval = redisClient.eval;
    redisClient.eval = async () => [16, 3200];

    try {
        await withRedisReady(true, async () => {
            const result = await consumeSocketRateLimit({
                userId: 42,
                eventName: 'message:send',
                limit: 15,
                windowMs: 10_000
            });
            assert.equal(result.allowed, false);
            assert.equal(result.totalHits, 16);
            assert.equal(result.retryAfterMs, 3200);
        });
    } finally {
        redisClient.eval = originalEval;
    }
});

test('socket rate limiter fails closed when Redis is unavailable', async () => {
    await withRedisReady(false, async () => {
        await assert.rejects(
            consumeSocketRateLimit({
                userId: 42,
                eventName: 'message:send',
                limit: 15,
                windowMs: 10_000
            }),
            /Redis is not ready/
        );
    });
});

test('socket rate limiter propagates Redis errors and rejects invalid responses', async () => {
    const originalEval = redisClient.eval;
    try {
        const outage = new Error('Redis unavailable');
        redisClient.eval = async () => { throw outage; };
        await withRedisReady(true, async () => {
            await assert.rejects(
                consumeSocketRateLimit({
                    userId: 42,
                    eventName: 'call:start',
                    limit: 3,
                    windowMs: 60_000
                }),
                error => error === outage
            );
        });

        redisClient.eval = async () => [NaN, 'invalid'];
        await withRedisReady(true, async () => {
            await assert.rejects(
                consumeSocketRateLimit({
                    userId: 42,
                    eventName: 'call:start',
                    limit: 3,
                    windowMs: 60_000
                }),
                /invalid realtime rate-limit result/
            );
        });
    } finally {
        redisClient.eval = originalEval;
    }
});
