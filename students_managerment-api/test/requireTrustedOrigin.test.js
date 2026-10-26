const test = require('node:test');
const assert = require('node:assert/strict');

const requireTrustedOrigin = require('../middleware/requireTrustedOrigin');

const invoke = (headers) => {
    const req = {
        get(name) {
            return headers[name.toLowerCase()] || undefined;
        }
    };
    const res = {
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
    requireTrustedOrigin(req, res, () => {
        nextCalled = true;
    });
    return { res, nextCalled };
};

test('allows an exact configured Origin', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.test';
    try {
        const { nextCalled, res } = invoke({ origin: 'https://app.example.test' });
        assert.equal(nextCalled, true);
        assert.equal(res.statusCode, null);
    } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previous;
    }
});

test('allows a trusted Referer when Origin is absent', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.test';
    try {
        const { nextCalled } = invoke({ referer: 'https://app.example.test/account/security' });
        assert.equal(nextCalled, true);
    } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previous;
    }
});

test('rejects missing Origin and Referer', () => {
    const { nextCalled, res } = invoke({});
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

test('rejects an untrusted or malformed Origin', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.test';
    try {
        for (const origin of [
            'https://app.example.test.attacker.invalid',
            'null',
            'not a URL'
        ]) {
            const { nextCalled, res } = invoke({ origin });
            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 403);
        }
    } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previous;
    }
});

test('rejects an untrusted Origin even if Referer is trusted', () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.test';
    try {
        const { nextCalled, res } = invoke({
            origin: 'https://attacker.invalid',
            referer: 'https://app.example.test/'
        });
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 403);
    } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONT_URL = previous;
    }
});
