'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('Face enrollment cancellation preserves a lock after challenge consumption and rejects foreign ownership', async () => {
    const { redisClient } = require('../src/config/redis.js');
    const faceAuth = require('../service/faceAuthService.js');

    if (!redisClient.isOpen) await redisClient.connect();

    const challengeId = crypto.randomBytes(12).toString('hex');
    const userId = '987654321';
    const challengeKey = `face-auth:enrollment:${challengeId}`;
    const lockKey = `face-auth:enrollment-lock:${userId}`;

    try {
        await redisClient.del([challengeKey, lockKey]);

        // A challenge still owned by this account can be cancelled.
        await redisClient.set(challengeKey, JSON.stringify({ userId }), { EX: 180 });
        await redisClient.set(lockKey, challengeId, { EX: 180 });
        const cancelled = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(cancelled, { cancelled: true });
        assert.equal(await redisClient.get(challengeKey), null);
        assert.equal(await redisClient.get(lockKey), null);

        // A consumed challenge must not release the lock held by finishEnrollment.
        await redisClient.set(lockKey, challengeId, { EX: 180 });
        const consumed = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(consumed, { cancelled: false });
        assert.equal(await redisClient.get(lockKey), challengeId);

        // A challenge belonging to another account cannot be cancelled.
        await redisClient.set(challengeKey, JSON.stringify({ userId: 'different-user' }), { EX: 180 });
        const foreign = await faceAuth.cancelEnrollment(userId, challengeId);
        assert.deepEqual(foreign, { cancelled: false });
        assert.notEqual(await redisClient.get(challengeKey), null);
        assert.equal(await redisClient.get(lockKey), challengeId);
    } finally {
        await redisClient.del([challengeKey, lockKey]);
        if (redisClient.isOpen) await redisClient.quit();
    }
});
