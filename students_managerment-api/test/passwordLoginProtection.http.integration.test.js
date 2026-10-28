const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');

const { redisClient } = require('../src/config/redis');
const authRouter = require('../router/authRouter');
const {
    recordFailure,
    resetAccountState
} = require('../service/passwordLoginProtection');

const enabled = process.env.REDIS_INTEGRATION === '1';

test('HTTP login pipeline counts cooldown rejections against the IP limiter', {
    skip: !enabled
}, async () => {
    const secret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    assert.ok(secret && secret.length >= 32, 'integration test requires AUTH_RATE_LIMIT_HASH_SECRET');

    if (!redisClient.isOpen) await redisClient.connect();

    const username = `login-pipeline-${crypto.randomUUID()}`;
    const ip = '203.0.113.77';
    const ipRateLimitKey = `rate-limit:password-login:${ip}`;
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use('/api/auth', authRouter);

    const server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const address = server.address();
    const endpoint = `http://127.0.0.1:${address.port}/api/auth/login`;

    try {
        await redisClient.del(ipRateLimitKey);
        await resetAccountState(username);

        for (let i = 0; i < 4; i += 1) {
            await recordFailure(username, ip);
        }

        for (let i = 0; i < 30; i += 1) {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    origin: 'http://localhost:5173',
                    'x-forwarded-for': ip
                },
                body: JSON.stringify({ username, password: 'not-used-because-cooldown-is-active' })
            });
            assert.equal(response.status, 429, `request ${i + 1} should be rejected by account/IP cooldown`);
            const body = await response.json();
            assert.equal(body.code, 'LOGIN_COOLDOWN');
        }

        const overLimitResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                origin: 'http://localhost:5173',
                'x-forwarded-for': ip
            },
            body: JSON.stringify({ username, password: 'not-used' })
        });

        assert.equal(overLimitResponse.status, 429);
        const overLimitBody = await overLimitResponse.json();
        assert.equal(overLimitBody.code, 'LOGIN_IP_RATE_LIMITED');
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await redisClient.del(ipRateLimitKey);
        await resetAccountState(username);
        if (redisClient.isOpen) await redisClient.quit();
    }
});
