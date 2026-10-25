const test = require('node:test');
const assert = require('node:assert/strict');

const { redisClient } = require('../src/config/redis');
const RedisRateLimitStore = require('../middleware/redisRateLimitStore');

test('Redis rate-limit store increments atomically and returns reset time', async () => {
    const originalEval = redisClient.eval;
    const calls = [];
    redisClient.eval = async (script, options) => {
        calls.push({ script, options });
        return [3, 45000];
    };

    try {
        const store = new RedisRateLimitStore({ prefix: 'test:auth:' });
        store.init({ windowMs: 60000 });

        const before = Date.now();
        const result = await store.increment('client-key');

        assert.equal(result.totalHits, 3);
        assert.ok(result.resetTime instanceof Date);
        assert.ok(result.resetTime.getTime() >= before + 44900);
        assert.ok(result.resetTime.getTime() <= Date.now() + 45100);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].options.keys, ['test:auth:client-key']);
        assert.deepEqual(calls[0].options.arguments, ['60000']);
        assert.match(calls[0].script, /INCR/);
        assert.match(calls[0].script, /PEXPIRE/);
    } finally {
        redisClient.eval = originalEval;
    }
});

test('Redis rate-limit store rejects invalid Redis responses', async () => {
    const originalEval = redisClient.eval;
    redisClient.eval = async () => [NaN, 'invalid'];

    try {
        const store = new RedisRateLimitStore();
        store.init({ windowMs: 60000 });
        await assert.rejects(store.increment('client-key'), /invalid increment result/);
    } finally {
        redisClient.eval = originalEval;
    }
});

test('Redis rate-limit store propagates Redis outages instead of silently disabling limits', async () => {
    const originalEval = redisClient.eval;
    const outage = new Error('Redis unavailable');
    redisClient.eval = async () => { throw outage; };

    try {
        const store = new RedisRateLimitStore();
        await assert.rejects(store.increment('client-key'), error => error === outage);
    } finally {
        redisClient.eval = originalEval;
    }
});

test('Redis rate-limit store decrements and resets only the requested key', async () => {
    const originalEval = redisClient.eval;
    const originalDel = redisClient.del;
    const evalCalls = [];
    const delCalls = [];
    redisClient.eval = async (script, options) => {
        evalCalls.push({ script, options });
        return 2;
    };
    redisClient.del = async (...keys) => {
        delCalls.push(keys);
        return 1;
    };

    try {
        const store = new RedisRateLimitStore({ prefix: 'test:' });
        await store.decrement('one');
        await store.resetKey('two');

        assert.equal(evalCalls.length, 1);
        assert.deepEqual(evalCalls[0].options.keys, ['test:one']);
        assert.match(evalCalls[0].script, /DECR/);
        assert.deepEqual(delCalls, [['test:two']]);
    } finally {
        redisClient.eval = originalEval;
        redisClient.del = originalDel;
    }
});
