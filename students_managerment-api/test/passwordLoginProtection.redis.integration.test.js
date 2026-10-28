const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { redisClient } = require('../src/config/redis');
const {
    recordFailure,
    getCooldownState,
    clearAccountIpState,
    resetAccountState,
    normalizeAccountIdentifier
} = require('../service/passwordLoginProtection');

const enabled = process.env.REDIS_INTEGRATION === '1';

test('progressive cooldown Redis integration: atomic counters, pair isolation, TTL and account reset', {
    skip: !enabled
}, async () => {
    const secret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    assert.ok(secret && secret.length >= 32, 'integration test requires AUTH_RATE_LIMIT_HASH_SECRET');

    if (!redisClient.isOpen) await redisClient.connect();

    const username = `redis-integration-${crypto.randomUUID()}`;
    const ipA = '192.0.2.10';
    const ipB = '192.0.2.11';
    const accountHash = crypto.createHmac('sha256', secret)
        .update(normalizeAccountIdentifier(username))
        .digest('hex');
    const ipHashA = crypto.createHmac('sha256', secret).update(ipA).digest('hex');
    const failureKeyA = `auth:password:${accountHash}:${ipHashA}:failures`;

    try {
        assert.deepEqual(await getCooldownState(username, ipA), {
            active: false,
            retryAfterSeconds: 0
        });

        const parallelFailures = await Promise.all(
            Array.from({ length: 4 }, () => recordFailure(username, ipA))
        );
        assert.equal(Math.max(...parallelFailures.map((item) => item.failedAttempts)), 4);
        assert.equal(await redisClient.ttl(failureKeyA) > 0, true);
        assert.equal(await redisClient.ttl(failureKeyA) <= 86400, true);
        assert.equal((await getCooldownState(username, ipA)).active, true);

        for (let attempt = 0; attempt < 4; attempt += 1) {
            await recordFailure(username, ipB);
        }
        assert.equal((await getCooldownState(username, ipB)).active, true);

        await clearAccountIpState(username, ipA);
        assert.equal((await getCooldownState(username, ipA)).active, false);
        assert.equal((await getCooldownState(username, ipB)).active, true);

        const clearedPairs = await resetAccountState(username);
        assert.equal(clearedPairs, 2);
        assert.equal((await getCooldownState(username, ipB)).active, false);
    } finally {
        await resetAccountState(username);
        if (redisClient.isOpen) await redisClient.quit();
    }
});
