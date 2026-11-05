'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const redisPath = require.resolve('../src/config/redis.js');
const store = new Map();

const redisClient = {
    async set(key, value, options = {}) {
        if (options.NX && store.has(key)) return null;
        store.set(key, { value, expiresAt: Date.now() + Number(options.EX || 0) * 1000 });
        return 'OK';
    },
    async get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= Date.now()) { store.delete(key); return null; }
        return entry.value;
    },
    async eval(_script, { keys }) {
        const key = keys[0];
        const value = await this.get(key);
        if (value) store.delete(key);
        return value;
    }
};

require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: { redisClient }
};
const pending = require('../service/pendingFaceMfaService.js');

function request(ip = '10.0.0.10', userAgent = 'StudentManager-Test/1.0') {
    return { ip, get: name => name.toLowerCase() === 'user-agent' ? userAgent : undefined };
}

 test('pending Face MFA is bound to the same account, browser and network request', async () => {
    const original = request();
    const created = await pending.createPendingAuth({ id: 7, username: 'student7', is_active: true }, original, 'password');
    assert.equal(created.requiresFaceMfa, true);
    assert.equal(created.accessToken, undefined);
    assert.equal(created.refreshToken, undefined);
    assert.equal((await pending.readPendingAuth(created.pendingAuthId, original)).userId, '7');
    assert.equal(await pending.readPendingAuth(created.pendingAuthId, request('10.0.0.11')), null);
    assert.equal(await pending.readPendingAuth(created.pendingAuthId, request('10.0.0.10', 'OtherBrowser/2.0')), null);
});

test('pending Face MFA is one-time and cannot be replayed or consumed by another account', async () => {
    const req = request();
    const created = await pending.createPendingAuth({ id: 8, username: 'student8', is_active: true }, req, 'google');
    assert.equal(await pending.consumePendingAuth(created.pendingAuthId, 9, req), null);
    // Consumption is atomic and one-shot; a mismatched account attempt burns the challenge.
    assert.equal(await pending.consumePendingAuth(created.pendingAuthId, 8, req), null);
    assert.equal(await pending.consumePendingAuth(created.pendingAuthId, 8, req), null);
});

test('pending Face MFA expires and inactive accounts cannot create challenges', async () => {
    const req = request();
    const created = await pending.createPendingAuth({ id: 10, username: 'student10', is_active: true }, req, 'passkey');
    const key = `auth:pending-face-mfa:${created.pendingAuthId}`;
    store.get(key).expiresAt = Date.now() - 1;
    assert.equal(await pending.readPendingAuth(created.pendingAuthId, req), null);
    await assert.rejects(
        pending.createPendingAuth({ id: 11, username: 'disabled', is_active: false }, req, 'qr'),
        error => error.code === 'PENDING_AUTH_ACCOUNT_INVALID'
    );
});
