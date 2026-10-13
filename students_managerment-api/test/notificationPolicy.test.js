const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isAllowedPushEndpoint,
    validateAccountPreferencePatch,
    validatePushSubscription
} = require('../service/notificationPolicy');

test('account notification preferences accept only known boolean flags', () => {
    assert.deepEqual(
        validateAccountPreferencePatch({ push_enabled: false, sound_enabled: true }),
        [['push_enabled', false], ['sound_enabled', true]]
    );
    assert.throws(
        () => validateAccountPreferencePatch({ role: 'admin' }),
        error => error.statusCode === 400
    );
    assert.throws(
        () => validateAccountPreferencePatch({ push_enabled: 'false' }),
        error => error.statusCode === 400
    );
    assert.throws(
        () => validateAccountPreferencePatch({}),
        error => error.statusCode === 400
    );
});

test('push endpoint validation allows browser push providers only', () => {
    assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true);
    assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
    assert.equal(isAllowedPushEndpoint('https://evil.example/endpoint'), false);
    assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/endpoint'), false);
    assert.equal(isAllowedPushEndpoint('https://127.0.0.1/endpoint'), false);
    assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/endpoint'), false);
});

test('push subscription requires a valid endpoint and cryptographic keys', () => {
    assert.equal(validatePushSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/example',
        keys: { p256dh: '0123456789abcdef', auth: 'abcdefgh' }
    }).keys.auth, 'abcdefgh');
    assert.throws(
        () => validatePushSubscription({
            endpoint: 'https://attacker.example/',
            keys: { p256dh: '0123456789abcdef', auth: 'abcdefgh' }
        }),
        error => error.statusCode === 400
    );
});
