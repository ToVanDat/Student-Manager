const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getCooldownMs,
    normalizeAccountIdentifier
} = require('../service/passwordLoginProtection');

test('progressive cooldown follows the configured starting tiers', () => {
    assert.equal(getCooldownMs(1), 0);
    assert.equal(getCooldownMs(3), 0);
    assert.equal(getCooldownMs(4), 30_000);
    assert.equal(getCooldownMs(5), 30_000);
    assert.equal(getCooldownMs(6), 60_000);
    assert.equal(getCooldownMs(7), 60_000);
    assert.equal(getCooldownMs(8), 300_000);
    assert.equal(getCooldownMs(9), 300_000);
    assert.equal(getCooldownMs(10), 900_000);
    assert.equal(getCooldownMs(11), 900_000);
    assert.equal(getCooldownMs(12), 1_800_000);
    assert.equal(getCooldownMs(100), 1_800_000);
});

test('invalid attempt counts never produce a cooldown', () => {
    assert.equal(getCooldownMs(0), 0);
    assert.equal(getCooldownMs(-1), 0);
    assert.equal(getCooldownMs(Number.NaN), 0);
    assert.equal(getCooldownMs('not-a-number'), 0);
});

test('account identifiers are normalized consistently before hashing', () => {
    assert.equal(
        normalizeAccountIdentifier('  student.User  '),
        normalizeAccountIdentifier('student.User')
    );
    assert.notEqual(normalizeAccountIdentifier('student.User'), normalizeAccountIdentifier('student.user'));
    assert.equal(normalizeAccountIdentifier('  '), '');
});


test('Redis protection records pair failures atomically without exposing identifiers in keys', async () => {
    const { redisClient } = require('../src/config/redis');
    const { recordFailure } = require('../service/passwordLoginProtection');
    const originalEval = redisClient.eval;
    const calls = [];
    const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';
    redisClient.eval = async (script, options) => {
        calls.push({ script, options });
        return [4, 4, 30000];
    };

    try {
        const result = await recordFailure('student@example.test', '203.0.113.10');
        assert.deepEqual(result, {
            failedAttempts: 4,
            accountRiskSignals: 4,
            cooldownMs: 30000
        });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].options.keys.length, 4);
        assert.ok(calls[0].options.keys.every((key) => !key.includes('student@example.test')));
        assert.ok(calls[0].options.keys.every((key) => !key.includes('203.0.113.10')));
        assert.deepEqual(calls[0].options.arguments, ['86400', calls[0].options.keys[0].split(':')[3]]);
        assert.match(calls[0].script, /INCR/);
        assert.match(calls[0].script, /PSETEX/);
    } finally {
        redisClient.eval = originalEval;
        if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
        else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
    }
});

test('Redis protection reads cooldown using Redis PTTL and rounds retry-after upward', async () => {
    const { redisClient } = require('../src/config/redis');
    const { getCooldownState } = require('../service/passwordLoginProtection');
    const originalEval = redisClient.eval;
    const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';
    redisClient.eval = async (script, options) => {
        assert.match(script, /PTTL/);
        assert.equal(options.keys.length, 1);
        return 1001;
    };

    try {
        assert.deepEqual(await getCooldownState('student@example.test', '203.0.113.10'), {
            active: true,
            retryAfterSeconds: 2
        });
    } finally {
        redisClient.eval = originalEval;
        if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
        else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
    }
});

test('successful login reset deletes only the current account/IP pair keys', async () => {
    const { redisClient } = require('../src/config/redis');
    const { clearAccountIpState } = require('../service/passwordLoginProtection');
    const originalDel = redisClient.del;
    const calls = [];
    const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';
    redisClient.del = async (keys) => {
        calls.push(keys);
        return 2;
    };

    try {
        await clearAccountIpState('student@example.test', '203.0.113.10');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].length, 2);
        assert.ok(calls[0].every((key) => key.startsWith('auth:password:')));
        assert.ok(calls[0].every((key) => !key.includes('student@example.test')));
        assert.ok(calls[0].every((key) => !key.includes('203.0.113.10')));
    } finally {
        redisClient.del = originalDel;
        if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
        else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
    }
});

test('password reset clears account pair index and aggregate risk atomically', async () => {
    const { redisClient } = require('../src/config/redis');
    const { resetAccountState } = require('../service/passwordLoginProtection');
    const originalEval = redisClient.eval;
    const calls = [];
    const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';
    redisClient.eval = async (script, options) => {
        calls.push({ script, options });
        return 2;
    };

    try {
        assert.equal(await resetAccountState('student@example.test'), 2);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].options.keys.length, 2);
        assert.deepEqual(calls[0].options.arguments, [
            'auth:password:',
            calls[0].options.keys[0].replace('auth:password:ip-index:', '')
        ]);
        assert.match(calls[0].script, /SMEMBERS/);
        assert.match(calls[0].script, /DEL/);
    } finally {
        redisClient.eval = originalEval;
        if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
        else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
    }
});
