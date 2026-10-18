const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const { redisClient } = require('../src/config/redis');
const authRepository = require('../repository/authRepository');
const relayRepository = require('../repository/e2eeRelayRepository');

const SESSION_ID = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
const JWT_SECRET = 'e2ee-integration-test-secret-only';
const originalEnv = process.env.JWT_SECRET;
const snapshots = [];

const stub = (object, key, replacement) => {
    snapshots.push({ object, key, value: object[key] });
    object[key] = replacement;
};

const restore = () => {
    for (const item of snapshots.splice(0).reverse()) item.object[item.key] = item.value;
    if (originalEnv === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalEnv;
};

const tokenFor = (sub = 44, sessionId = SESSION_ID) => jwt.sign(
    { sub, sessionId },
    JWT_SECRET,
    { issuer: 'student-management-api', audience: 'student-management-client', expiresIn: '5m' }
);

test('Express E2EE mailbox route requires a valid user session and per-device credential', async t => {
    process.env.JWT_SECRET = JWT_SECRET;
    stub(redisClient, 'isReady', true);
    stub(redisClient, 'get', async key => key.startsWith('access_token:') ? '44' : null);
    stub(authRepository, 'findSessionByIdAndUserId', async (sessionId, userId) =>
        sessionId === SESSION_ID && String(userId) === '44' ? { id: sessionId, revoked_at: null } : null);
    stub(authRepository, 'findUserById', async userId =>
        String(userId) === '44' ? { id: 44, username: 'e2ee-test', role: 'user', is_active: true } : null);
    stub(relayRepository, 'authenticateDeviceCredential', async (userId, deviceId, token) =>
        String(userId) === '44' && Number(deviceId) === 2 && token === 'valid-device-token'
            ? { id: 900, user_id: 44, device_id: 2, registration_id: 77 }
            : null);
    stub(relayRepository, 'pullEnvelopes', async (userId, deviceId, limit) => {
        assert.equal(Number(userId), 44);
        assert.equal(Number(deviceId), 2);
        assert.equal(Number(limit), 10);
        return [{ id: 'opaque-envelope', ciphertext: 'Y2lwaGVydGV4dA==' }];
    });

    const app = express();
    app.use(express.json());
    app.use('/api/e2ee/relay', require('../router/e2eeRelayRouter'));
    const server = app.listen(0, '127.0.0.1');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        restore();
    });
    await new Promise((resolve, reject) => {
        if (server.listening) return resolve();
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/e2ee/relay/devices/2/mailbox?limit=10`;

    const noBearer = await fetch(baseUrl);
    assert.equal(noBearer.status, 401);

    const noDeviceCredential = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${tokenFor()}` }
    });
    assert.equal(noDeviceCredential.status, 401);
    assert.equal((await noDeviceCredential.json()).code, 'E2EE_DEVICE_AUTH_REQUIRED');

    const wrongDeviceCredential = await fetch(baseUrl, {
        headers: {
            Authorization: `Bearer ${tokenFor()}`,
            'X-E2EE-Device-Token': 'wrong-device-token'
        }
    });
    assert.equal(wrongDeviceCredential.status, 401);
    assert.equal((await wrongDeviceCredential.json()).code, 'E2EE_DEVICE_AUTH_FAILED');

    const valid = await fetch(baseUrl, {
        headers: {
            Authorization: `Bearer ${tokenFor()}`,
            'X-E2EE-Device-Token': 'valid-device-token'
        }
    });
    assert.equal(valid.status, 200);
    const body = await valid.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'opaque-envelope');
    assert.equal(body.data[0].ciphertext, 'Y2lwaGVydGV4dA==');
});
