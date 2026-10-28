'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Face enrollment cancellation cannot release a lock after finish has consumed its challenge', async t => {
    const { redisClient } = require('../src/config/redis.js');
    const pool = require('../src/config/database.js');
    const faceAuth = require('../service/faceAuthService.js');

    if (!redisClient.isOpen) await redisClient.connect();

    const challengeId = 'c'.repeat(24);
    const userId = '987654321';
    const challengeKey = `face-auth:enrollment:${challengeId}`;
    const lockKey = `face-auth:enrollment-lock:${userId}`;

    t.after(async () => {
        await redisClient.del([challengeKey, lockKey]);
        await redisClient.quit();
        await pool.end();
    });

    await t.test('cancels an unconsumed challenge owned by the caller', async () => {
        await redisClient.set(challengeKey, JSON.stringify({ userId }), { EX: 180 });
        await redisClient.set(lockKey, challengeId, { EX: 180 });

        const result = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(result, { cancelled: true });
        assert.equal(await redisClient.get(challengeKey), null);
        assert.equal(await redisClient.get(lockKey), null);
    });

    await t.test('does not release the lock after the challenge has been consumed', async () => {
        await redisClient.del(challengeKey);
        await redisClient.set(lockKey, challengeId, { EX: 180 });

        const result = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(result, { cancelled: false });
        assert.equal(await redisClient.get(lockKey), challengeId);
    });

    await t.test('does not cancel another account challenge', async () => {
        await redisClient.set(challengeKey, JSON.stringify({ userId: 'different-user' }), { EX: 180 });
        await redisClient.set(lockKey, challengeId, { EX: 180 });

        const result = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(result, { cancelled: false });
        assert.notEqual(await redisClient.get(challengeKey), null);
        assert.equal(await redisClient.get(lockKey), challengeId);
    });
});
