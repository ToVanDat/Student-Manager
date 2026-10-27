const test = require('node:test');
const assert = require('node:assert/strict');
const { getReadiness } = require('../service/healthService');

test('readiness is healthy when PostgreSQL and Redis are ready', async () => {
    const result = await getReadiness({
        pool: { query: async (sql) => { assert.equal(sql, 'SELECT 1'); return { rows: [{ '?column?': 1 }] }; } },
        redisClient: { isReady: true, ping: async () => 'PONG' }
    });

    assert.deepEqual(result, {
        ready: true,
        checks: { database: 'ok', redis: 'ok' }
    });
});

test('readiness fails closed when PostgreSQL is unavailable', async () => {
    const result = await getReadiness({
        pool: { query: async () => { throw new Error('database credentials must not leak'); } },
        redisClient: { isReady: true, ping: async () => 'PONG' }
    });

    assert.deepEqual(result, {
        ready: false,
        checks: { database: 'unavailable', redis: 'ok' }
    });
});

test('readiness fails closed when Redis is not ready', async () => {
    const result = await getReadiness({
        pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) },
        redisClient: { isReady: false, ping: async () => 'PONG' }
    });

    assert.deepEqual(result, {
        ready: false,
        checks: { database: 'ok', redis: 'unavailable' }
    });
});

test('readiness does not expose dependency error messages', async () => {
    const result = await getReadiness({
        pool: { query: async () => { throw new Error('secret-password'); } },
        redisClient: { isReady: false, ping: async () => 'PONG' }
    });

    assert.equal(JSON.stringify(result).includes('secret-password'), false);
});
