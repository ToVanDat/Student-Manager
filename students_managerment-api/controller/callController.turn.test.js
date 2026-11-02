'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getIceConfig } = require('./callController');

function responseRecorder() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

const SECRET = '0123456789abcdef'.repeat(4);

test('ICE config endpoint returns private no-store credentials for the authenticated user', async () => {
    const original = {
        STUN_URIS: process.env.STUN_URIS,
        TURN_URIS: process.env.TURN_URIS,
        TURN_SHARED_SECRET: process.env.TURN_SHARED_SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: process.env.TURN_CREDENTIAL_TTL_SECONDS
    };
    Object.assign(process.env, {
        STUN_URIS: 'stun:turn.smartsmanage.com:3478',
        TURN_URIS: 'turn:turn.smartsmanage.com:3478?transport=udp',
        TURN_SHARED_SECRET: SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: '3600'
    });

    try {
        const res = responseRecorder();
        await getIceConfig({ user: { id: 73 } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['cache-control'], 'no-store, private');
        assert.equal(res.headers.pragma, 'no-cache');
        assert.equal(res.body.turnAvailable, true);
        assert.match(res.body.iceServers[1].username, /^\d+:73$/);
        assert.ok(res.body.iceServers[1].credential);
        assert.equal(JSON.stringify(res.body).includes(SECRET), false);
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('ICE config endpoint rejects missing authenticated user', async () => {
    const res = responseRecorder();
    await getIceConfig({ user: null }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
    assert.equal(res.headers['cache-control'], 'no-store, private');
});

test('ICE config endpoint fails closed when TURN secret is absent', async () => {
    const original = {
        STUN_URIS: process.env.STUN_URIS,
        TURN_URIS: process.env.TURN_URIS,
        TURN_SHARED_SECRET: process.env.TURN_SHARED_SECRET
    };
    process.env.STUN_URIS = 'stun:turn.smartsmanage.com:3478';
    process.env.TURN_URIS = 'turn:turn.smartsmanage.com:3478?transport=udp';
    delete process.env.TURN_SHARED_SECRET;

    try {
        const res = responseRecorder();
        await getIceConfig({ user: { id: 73 } }, res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, 'TURN_CONFIG_INVALID');
        assert.equal(JSON.stringify(res.body).includes('secret'), false);
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
