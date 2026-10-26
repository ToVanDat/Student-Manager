const test = require('node:test');
const assert = require('node:assert/strict');

const { redisClient } = require('../src/config/redis');
const middleware = require('../middleware/e2eePreKeyBundleRateLimit');

const createResponse = () => ({
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

test('prekey bundle limiter uses requester-target and requester-wide Redis counters', async t => {
    const originalEval = redisClient.eval;
    let invocation;
    redisClient.eval = async (script, options) => {
        invocation = { script, options };
        return [3, 60, 12, 60];
    };
    t.after(() => { redisClient.eval = originalEval; });

    const req = { user: { id: 11 }, params: { userId: '22' } };
    const res = createResponse();
    let continued = false;
    await middleware(req, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.deepEqual(invocation.options.keys, [
        'e2ee:prekey-bundle:pair:11:22',
        'e2ee:prekey-bundle:requester:11'
    ]);
    assert.equal(invocation.options.arguments[0], '60');
    assert.match(invocation.script, /redis\.call\('INCR'/);
});

test('prekey bundle limiter rejects pair quota exhaustion with Retry-After', async t => {
    const originalEval = redisClient.eval;
    redisClient.eval = async () => [9, 37, 9, 52];
    t.after(() => { redisClient.eval = originalEval; });

    const res = createResponse();
    let continued = false;
    await middleware({ user: { id: 11 }, params: { userId: '22' } }, res, () => { continued = true; });

    assert.equal(continued, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers['Retry-After'], '52');
    assert.equal(res.body.code, 'E2EE_PREKEY_RATE_LIMITED');
});

test('prekey bundle limiter fails closed when shared Redis is unavailable', async t => {
    const originalEval = redisClient.eval;
    redisClient.eval = async () => { throw new Error('redis down'); };
    t.after(() => { redisClient.eval = originalEval; });

    const res = createResponse();
    let continued = false;
    await middleware({ user: { id: 11 }, params: { userId: '22' } }, res, () => { continued = true; });

    assert.equal(continued, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'E2EE_RATE_LIMIT_UNAVAILABLE');
});

test('prekey bundle limiter skips counters for a user reading their own linked device', async t => {
    const originalEval = redisClient.eval;
    let calls = 0;
    redisClient.eval = async () => { calls += 1; return [1, 60, 1, 60]; };
    t.after(() => { redisClient.eval = originalEval; });

    const res = createResponse();
    let continued = false;
    await middleware({ user: { id: 11 }, params: { userId: '11' } }, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(calls, 0);
});
