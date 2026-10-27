const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const servicePath = require.resolve('../service/advancedAuthService.js');
const controllerPath = require.resolve('../controller/advancedAuthController.js');

const calls = [];
const fakeService = {
    beginPasskeyLogin: async username => {
        calls.push(['beginPasskeyLogin', username]);
        return { challengeId: 'challenge-1', options: { challenge: 'challenge-value' } };
    },
    finishPasskeyLogin: async (challengeId, response, req) => {
        calls.push(['finishPasskeyLogin', challengeId, response, req]);
        return {
            user: { id: 7, username: 'student', role: 'user' },
            accessToken: 'access-token',
            refreshToken: 'refresh-token'
        };
    },
    listPasskeys: async userId => {
        calls.push(['listPasskeys', userId]);
        return [{ id: 1 }, { id: 2 }];
    }
};

const serviceModule = new Module(servicePath);
serviceModule.filename = servicePath;
serviceModule.loaded = true;
serviceModule.exports = fakeService;
require.cache[servicePath] = serviceModule;
delete require.cache[controllerPath];

const controller = require('../controller/advancedAuthController.js');

function responseMock() {
    return {
        statusCode: 200,
        body: undefined,
        cookies: [],
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; }
    };
}

test('biometric options delegates to the existing WebAuthn challenge service', async () => {
    calls.length = 0;
    const req = { body: { username: 'student' } };
    const res = responseMock();

    await controller.beginBiometricLogin(req, res);

    assert.deepEqual(calls, [['beginPasskeyLogin', 'student']]);
    assert.equal(res.body.challengeId, 'challenge-1');
    assert.equal(res.statusCode, 200);
});

test('biometric verification issues the normal authenticated session', async () => {
    calls.length = 0;
    const req = { body: { challengeId: 'challenge-1', response: { id: 'credential-id' } } };
    const res = responseMock();

    await controller.finishBiometricLogin(req, res);

    assert.equal(calls[0][0], 'finishPasskeyLogin');
    assert.equal(calls[0][1], 'challenge-1');
    assert.equal(calls[0][2].id, 'credential-id');
    assert.equal(calls[0][3], req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.accessToken, 'access-token');
    assert.equal(res.cookies[0].name, 'refreshToken');
    assert.equal(res.cookies[0].options.httpOnly, true);
});

test('biometric status is scoped to the authenticated account', async () => {
    calls.length = 0;
    const req = { user: { sub: 'user-7' } };
    const res = responseMock();

    await controller.getBiometricLoginStatus(req, res);

    assert.deepEqual(calls, [['listPasskeys', 'user-7']]);
    assert.deepEqual(res.body, {
        configured: true,
        credentialCount: 2,
        method: 'webauthn-device-verification',
        biometricMethodSelectedByDevice: true
    });
});
