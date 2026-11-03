const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { redisClient } = require('../src/config/redis');
const authRateLimiter = require('../middleware/authRateLimiter');

test('authentication endpoint quotas are isolated for the same client IP', async () => {
    const originalEval = redisClient.eval;
    const counts = new Map();
    const app = express();

    redisClient.eval = async (_script, options) => {
        const key = options.keys[0];
        const totalHits = (counts.get(key) || 0) + 1;
        counts.set(key, totalHits);
        return [totalHits, 15 * 60 * 1000];
    };

    app.post('/google/login', authRateLimiter, (_req, res) => res.sendStatus(204));
    app.post('/refresh', authRateLimiter, (_req, res) => res.sendStatus(204));

    const server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const request = (path) => fetch(`${endpoint}${path}`, { method: 'POST' });

    try {
        // Exhaust one endpoint's allowance without penalizing another auth flow.
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const response = await request('/google/login');
            assert.equal(response.status, 204);
        }

        const isolatedResponse = await request('/refresh');
        assert.equal(isolatedResponse.status, 204);

        const limitedResponse = await request('/google/login');
        assert.equal(limitedResponse.status, 429);
        assert.equal((await limitedResponse.json()).code, 'AUTH_ENDPOINT_RATE_LIMITED');

        // The second endpoint retains its own independent allowance.
        const stillAvailableResponse = await request('/refresh');
        assert.equal(stillAvailableResponse.status, 204);

        assert.equal(counts.size, 2);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        redisClient.eval = originalEval;
    }
});
