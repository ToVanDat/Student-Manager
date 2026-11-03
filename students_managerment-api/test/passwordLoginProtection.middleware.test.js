const test = require('node:test');
const assert = require('node:assert/strict');

const { redisClient } = require('../src/config/redis');
const passwordLoginProtection = require('../middleware/passwordLoginProtection');

const originalSecret = process.env.AUTH_RATE_LIMIT_HASH_SECRET;
const originalEval = redisClient.eval;
process.env.AUTH_RATE_LIMIT_HASH_SECRET = 'test-only-secret-with-at-least-32-characters';

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test.after(() => {
    redisClient.eval = originalEval;
    if (originalSecret === undefined) delete process.env.AUTH_RATE_LIMIT_HASH_SECRET;
    else process.env.AUTH_RATE_LIMIT_HASH_SECRET = originalSecret;
});

test('password cooldown middleware skips requests without a username', async () => {
    let called = false;
    const response = createResponse();
    redisClient.eval = async () => {
        throw new Error('Redis should not be queried');
    };

    await passwordLoginProtection({ body: {}, ip: '192.0.2.10' }, response, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(response.statusCode, 200);
});

test('password cooldown middleware returns 429 and Retry-After for an active cooldown', async () => {
    const response = createResponse();
    let called = false;
    redisClient.eval = async (script) => {
        assert.match(script, /PTTL/);
        return 1250;
    };

    await passwordLoginProtection({
        body: { username: 'student@example.test' },
        ip: '192.0.2.10'
    }, response, () => {
        called = true;
    });

    assert.equal(called, false);
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['retry-after'], '2');
    assert.equal(response.body.code, 'LOGIN_COOLDOWN');
});

test('password cooldown middleware continues when no cooldown is active', async () => {
    const response = createResponse();
    let called = false;
    redisClient.eval = async () => -2;

    await passwordLoginProtection({
        body: { username: 'student@example.test' },
        ip: '192.0.2.10'
    }, response, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(response.statusCode, 200);
});

test('password cooldown middleware fails closed when Redis is unavailable', async () => {
    const response = createResponse();
    let called = false;
    redisClient.eval = async () => {
        const error = new Error('Redis unavailable');
        error.code = 'ECONNREFUSED';
        throw error;
    };

    const originalError = console.error;
    console.error = () => {};
    try {
        await passwordLoginProtection({
            body: { username: 'student@example.test' },
            ip: '192.0.2.10'
        }, response, () => {
            called = true;
        });
    } finally {
        console.error = originalError;
    }

    assert.equal(called, false);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'AUTH_PROTECTION_UNAVAILABLE');
});
