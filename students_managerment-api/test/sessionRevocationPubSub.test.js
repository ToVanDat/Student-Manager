const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { redisClient } = require('../src/config/redis');
const {
    SESSION_REVOCATION_CHANNEL,
    createSessionRevocationEvent,
    parseSessionRevocationEvent,
    publishSessionRevocation
} = require('../service/sessionRevocationPubSub');

test('session revocation event rejects invalid session IDs and normalizes unsafe reasons', () => {
    assert.throws(() => createSessionRevocationEvent(''), /session ID/i);
    assert.throws(() => createSessionRevocationEvent(null), /session ID/i);
    assert.deepEqual(createSessionRevocationEvent('session-1', 'bad reason'), {
        event: 'session:revoked',
        payload: { sessionId: 'session-1', reason: 'SESSION_REVOKED' }
    });
});

test('session revocation parser ignores malformed and unrelated pubsub messages', () => {
    assert.equal(parseSessionRevocationEvent('{broken'), null);
    assert.equal(parseSessionRevocationEvent({ event: 'presence:online', payload: {} }), null);
    assert.equal(parseSessionRevocationEvent({
        event: 'session:revoked',
        payload: { sessionId: '', reason: 'LOGOUT' }
    }), null);
    assert.deepEqual(parseSessionRevocationEvent(JSON.stringify({
        event: 'session:revoked',
        payload: { sessionId: 'session-1', reason: 'LOGOUT' }
    })), { sessionId: 'session-1', reason: 'LOGOUT' });
});

test('Redis Pub/Sub delivers revocation events to a separate backend-node subscriber', {
    skip: process.env.REDIS_INTEGRATION !== '1'
}, async () => {
    const subscriber = redisClient.duplicate();
    const sessionId = `redis-session-${crypto.randomUUID()}`;
    let resolveMessage;
    const received = new Promise(resolve => { resolveMessage = resolve; });
    let timeout;

    try {
        if (!redisClient.isOpen) await redisClient.connect();
        await subscriber.connect();
        await subscriber.subscribe(SESSION_REVOCATION_CHANNEL, raw => {
            const parsed = parseSessionRevocationEvent(raw);
            if (parsed?.sessionId === sessionId) resolveMessage(parsed);
        });

        await publishSessionRevocation(redisClient, sessionId, 'ACCOUNT_ACCESS_CHANGED');
        const message = await Promise.race([
            received,
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('session revocation Pub/Sub delivery timed out')), 3000);
            })
        ]);

        assert.deepEqual(message, {
            sessionId,
            reason: 'ACCOUNT_ACCESS_CHANGED'
        });
    } finally {
        if (timeout) clearTimeout(timeout);
        if (subscriber.isOpen) await subscriber.quit();
        if (redisClient.isOpen) await redisClient.quit();
    }
});
