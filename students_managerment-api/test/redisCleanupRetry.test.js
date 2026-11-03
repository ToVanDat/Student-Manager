const test = require('node:test');
const assert = require('node:assert/strict');

const { retryRedisCleanup } = require('../service/redisCleanupRetry');

test('Redis cleanup retry succeeds after a transient failure', async () => {
    let calls = 0;
    const warnings = [];
    const result = await retryRedisCleanup(async () => {
        calls += 1;
        if (calls < 2) throw new Error('temporary Redis outage');
    }, {
        attempts: 3,
        baseDelayMs: 0,
        logger: { warn: (...args) => warnings.push(args) }
    });

    assert.deepEqual(result, { succeeded: true, attempts: 2 });
    assert.equal(calls, 2);
    assert.equal(warnings.length, 0);
});

test('Redis cleanup retry is bounded and reports failure without throwing', async () => {
    let calls = 0;
    const warnings = [];
    const result = await retryRedisCleanup(async () => {
        calls += 1;
        throw new Error('Redis unavailable');
    }, {
        operation: 'test cleanup',
        attempts: 3,
        baseDelayMs: 0,
        logger: { warn: (...args) => warnings.push(args) }
    });

    assert.deepEqual(result, { succeeded: false, attempts: 3 });
    assert.equal(calls, 3);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][0], /test cleanup failed after 3 attempts/);
});

test('Redis cleanup retry validates its callback', async () => {
    await assert.rejects(
        retryRedisCleanup(null),
        /cleanup must be a function/
    );
});
