const test = require('node:test');
const assert = require('node:assert/strict');

const relayService = require('../service/e2eeRelayService');

const expectStatus = async (promise, statusCode, code) => {
    await assert.rejects(promise, error => {
        assert.equal(error.statusCode, statusCode);
        if (code) assert.equal(error.code, code);
        return true;
    });
};

test('SDK relay rejects invalid numeric device slots before touching the database', async () => {
    await expectStatus(relayService.pullEnvelopes(7, 0), 400);
    await expectStatus(relayService.pullEnvelopes(7, 6), 400);
});

test('SDK relay requires valid base64 ciphertext and a supported delivery class', async () => {
    const base = {
        targetUserId: 8,
        targetDeviceId: 1,
        senderDeviceId: 1,
        messageType: 'ciphertext',
        deliveryClass: 'user-visible',
        timestamp: Date.now(),
        clientMessageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    };
    await expectStatus(relayService.sendEnvelope(7, 9, { ...base, ciphertext: 'not base64!' }), 400);
    await expectStatus(relayService.sendEnvelope(7, 9, { ...base, ciphertext: 'YQ==', deliveryClass: 'plaintext' }), 400);
    await expectStatus(relayService.sendEnvelope(7, 9, { ...base, ciphertext: 'YQ==', messageType: 'plaintext' }), 400);
});

test('SDK relay rejects non-idempotent client message identifiers', async () => {
    await expectStatus(relayService.sendEnvelope(7, 9, {
        targetUserId: 8,
        targetDeviceId: 1,
        senderDeviceId: 1,
        ciphertext: 'YQ==',
        messageType: 'ciphertext',
        deliveryClass: 'user-visible',
        timestamp: Date.now(),
        clientMessageId: 'counter-1'
    }), 400);
});

test('SDK relay rejects device registration types outside the allowlist', async () => {
    await expectStatus(relayService.registerDevice(7, {
        registrationId: 12,
        deviceType: 'unknown-device'
    }), 400);
});
