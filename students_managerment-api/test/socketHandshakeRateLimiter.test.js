const test = require('node:test');
const assert = require('node:assert/strict');

const { redisClient } = require('../src/config/redis');
const {
    HANDSHAKE_RATE_LIMIT,
    readTrustedProxyHops,
    getSocketClientAddress,
    consumeSocketHandshakeRateLimit
} = require('../middleware/socketHandshakeRateLimiter');

const request = (remoteAddress, forwardedFor) => ({
    socket: { remoteAddress },
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor }
});

const withRedis = async (ready, evalImpl, callback) => {
    const originalReady = Object.getOwnPropertyDescriptor(redisClient, 'isReady');
    const originalEval = redisClient.eval;
    Object.defineProperty(redisClient, 'isReady', {
        configurable: true,
        value: ready
    });
    redisClient.eval = evalImpl;
    try {
        await callback();
    } finally {
        if (originalReady) Object.defineProperty(redisClient, 'isReady', originalReady);
        else delete redisClient.isReady;
        redisClient.eval = originalEval;
    }
};

test('proxy hop configuration accepts only a safe positive integer or unset', () => {
    assert.equal(readTrustedProxyHops(''), 0);
    assert.equal(readTrustedProxyHops('1'), 1);
    assert.throws(() => readTrustedProxyHops('true'), /positive integer/);
    assert.throws(() => readTrustedProxyHops('1.5'), /positive integer/);
    assert.throws(() => readTrustedProxyHops('9007199254740992'), /safe positive integer/);
});

test('uses the direct peer address unless trusted proxy hops are explicitly configured', () => {
    const req = request('127.0.0.1', '198.51.100.8');
    assert.equal(getSocketClientAddress(req, 0), '127.0.0.1');
    assert.equal(getSocketClientAddress(req, 1), '198.51.100.8');
});

test('selects the address before the configured proxy chain and rejects malformed chains', () => {
    const req = request('127.0.0.1', '198.51.100.8, 192.0.2.10');
    assert.equal(getSocketClientAddress(req, 2), '198.51.100.8');
    assert.equal(getSocketClientAddress(req, 3), null);
    assert.equal(getSocketClientAddress(request('127.0.0.1'), 1), null);
    assert.equal(getSocketClientAddress(request('not-an-ip'), 0), null);
    assert.equal(getSocketClientAddress(request('127.0.0.1', 'spoofed'), 1), null);
});

test('handshake rate limit uses a hashed IP key and atomic Redis window', async () => {
    let captured;
    await withRedis(true, async (script, options) => {
        captured = { script, options };
        return [12, 30_000];
    }, async () => {
        const result = await consumeSocketHandshakeRateLimit('198.51.100.8');
        assert.deepEqual(result, {
            allowed: true,
            totalHits: 12,
            retryAfterMs: 30_000
        });
    });

    assert.equal(captured.options.keys.length, 1);
    assert.match(captured.options.keys[0], /^rate-limit:socket:handshake:[a-f0-9]{64}$/);
    assert.deepEqual(captured.options.arguments, [String(HANDSHAKE_RATE_LIMIT.windowMs)]);
    assert.match(captured.script, /INCR/);
    assert.match(captured.script, /PEXPIRE/);
});

test('handshake rate limit rejects excess attempts and fails closed on Redis outage', async () => {
    await withRedis(true, async () => [61, 10_000], async () => {
        const result = await consumeSocketHandshakeRateLimit('198.51.100.8');
        assert.equal(result.allowed, false);
        assert.equal(result.totalHits, 61);
    });

    await withRedis(false, async () => [1, 60_000], async () => {
        await assert.rejects(
            consumeSocketHandshakeRateLimit('198.51.100.8'),
            /Redis is not ready/
        );
    });
});

test('handshake limiter rejects invalid addresses and malformed Redis results', async () => {
    await assert.rejects(
        consumeSocketHandshakeRateLimit('spoofed'),
        /invalid socket handshake client address/
    );

    await withRedis(true, async () => [NaN, 'bad'], async () => {
        await assert.rejects(
            consumeSocketHandshakeRateLimit('198.51.100.8'),
            /invalid socket handshake rate-limit result/
        );
    });
});
