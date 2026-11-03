const test = require('node:test');
const assert = require('node:assert/strict');

const middlewarePath = require.resolve('../middleware/requireTrustedOrigin.js');
const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL: process.env.FRONTEND_URL,
    FRONTEND_URLS: process.env.FRONTEND_URLS
};

function loadMiddleware(env = {}) {
    for (const key of ['NODE_ENV', 'FRONTEND_URL', 'FRONTEND_URLS']) {
        delete process.env[key];
    }
    Object.assign(process.env, env);
    delete require.cache[middlewarePath];
    return require('../middleware/requireTrustedOrigin.js');
}

function invoke(middleware, headers = {}) {
    const req = {
        get(name) {
            return headers[name.toLowerCase()] ?? undefined;
        }
    };
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
    let nextCalled = false;
    middleware(req, response, () => { nextCalled = true; });
    return { response, nextCalled };
}

test('trusted Origin is accepted when exactly allowlisted', () => {
    const middleware = loadMiddleware({
        NODE_ENV: 'production',
        FRONTEND_URLS: 'https://app.example.com,https://admin.example.com'
    });
    const result = invoke(middleware, { origin: 'https://app.example.com' });
    assert.equal(result.nextCalled, true);
    assert.equal(result.response.statusCode, null);
});

test('trusted Referer origin is accepted when Origin is absent', () => {
    const middleware = loadMiddleware({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com'
    });
    const result = invoke(middleware, { referer: 'https://app.example.com/settings/profile' });
    assert.equal(result.nextCalled, true);
});

test('missing, malformed and untrusted origins are rejected', () => {
    const middleware = loadMiddleware({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com'
    });

    for (const headers of [
        {},
        { origin: 'not-a-url' },
        { origin: 'https://app.example.com.attacker.invalid' },
        { origin: 'https://attacker.invalid', referer: 'https://app.example.com/' }
    ]) {
        const result = invoke(middleware, headers);
        assert.equal(result.nextCalled, false);
        assert.equal(result.response.statusCode, 403);
        assert.match(result.response.body.message, /Origin/);
    }
});

test('localhost development origins are not implicitly trusted in production', () => {
    const middleware = loadMiddleware({ NODE_ENV: 'production' });
    const result = invoke(middleware, { origin: 'http://localhost:5173' });
    assert.equal(result.nextCalled, false);
    assert.equal(result.response.statusCode, 403);
});

test('frontend allowlist entries containing paths do not match a browser Origin', () => {
    const middleware = loadMiddleware({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com/path'
    });
    const result = invoke(middleware, { origin: 'https://app.example.com' });
    assert.equal(result.nextCalled, false);
    assert.equal(result.response.statusCode, 403);
});

test.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    delete require.cache[middlewarePath];
});
