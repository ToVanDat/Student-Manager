const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatbotRateLimiter, RATE_LIMIT_SCRIPT } = require('../middleware/chatbotRateLimiter');

function response() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        setHeader(name, value) { this.headers[name] = value; },
        json(body) { this.body = body; return this; }
    };
}

test('chatbot limiter atomically increments a user-scoped Redis key', async () => {
    const calls = [];
    const redis = {
        isReady: true,
        eval: async (script, options) => {
            calls.push({ script, options });
            return [7, 42];
        }
    };
    const middleware = createChatbotRateLimiter({ redis, windowSeconds: 60, maxRequests: 20 });
    const res = response();
    let nextCalled = false;

    await middleware({ user: { sub: 'user-12' } }, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options.keys, ['rate-limit:assistant:user:user-12']);
    assert.deepEqual(calls[0].options.arguments, ['60']);
    assert.match(calls[0].script, /INCR/);
    assert.match(calls[0].script, /EXPIRE/);
});

test('chatbot limiter rejects requests above the configured limit and reports retry time', async () => {
    const redis = { isReady: true, eval: async () => [21, 17] };
    const middleware = createChatbotRateLimiter({ redis });
    const res = response();
    let nextCalled = false;

    await middleware({ user: { sub: 5 } }, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers['Retry-After'], '17');
});

test('chatbot limiter fails closed when Redis is unavailable', async () => {
    const middleware = createChatbotRateLimiter({ redis: { isReady: false } });
    const res = response();
    let nextCalled = false;

    await middleware({ user: { sub: 5 } }, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
});

test('chatbot limiter fails closed on Redis errors or malformed responses', async () => {
    for (const redis of [
        { isReady: true, eval: async () => { throw new Error('redis down'); } },
        { isReady: true, eval: async () => ['invalid', 10] }
    ]) {
        const middleware = createChatbotRateLimiter({ redis });
        const res = response();
        let nextCalled = false;
        await middleware({ user: { sub: 5 } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 503);
    }
});

test('limiter script performs expiry setup in the same Redis operation', () => {
    assert.match(RATE_LIMIT_SCRIPT, /INCR/);
    assert.match(RATE_LIMIT_SCRIPT, /EXPIRE/);
    assert.match(RATE_LIMIT_SCRIPT, /TTL/);
    assert.match(RATE_LIMIT_SCRIPT, /ttl < 0/);
});
