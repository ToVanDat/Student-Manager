const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { redisClient } = require('../src/config/redis');
const loginRateLimiter = require('../middleware/loginRateLimiter');
const passwordLoginProtection = require('../middleware/passwordLoginProtection');

test('three successful password logins from one IP do not consume the failed-login quota', async () => {
    const originalEval = redisClient.eval;
    const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';
    const counts = new Map();

    redisClient.eval = async (script, options) => {
        const key = options.keys[0];

        if (script.includes('return redis.call(\'PTTL\'')) {
            return -2;
        }

        if (script.includes("local hits = redis.call('INCR'") && script.includes('PTTL')) {
            const hits = (counts.get(key) || 0) + 1;
            counts.set(key, hits);
            return [hits, 15 * 60 * 1000];
        }

        if (script.includes("local hits = redis.call('DECR'")) {
            const hits = Math.max((counts.get(key) || 0) - 1, 0);
            if (hits === 0) counts.delete(key);
            else counts.set(key, hits);
            return hits;
        }

        throw new Error('Unexpected Redis script in login limiter test');
    };

    const app = express();
    app.use(express.json());
    app.post('/api/auth/login', loginRateLimiter, passwordLoginProtection, (_req, res) => {
        res.status(200).json({ message: 'login successful' });
    });

    const server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    try {
        const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username: 'student.test', password: 'correct-password' })
            });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { message: 'login successful' });
        }

        // express-rate-limit decrements successful responses asynchronously
        // on response finish; all completed requests should leave no failed hits.
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(counts.size, 0);
    } finally {
        await new Promise(resolve => server.close(resolve));
        redisClient.eval = originalEval;
        if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
        else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
    }
});
