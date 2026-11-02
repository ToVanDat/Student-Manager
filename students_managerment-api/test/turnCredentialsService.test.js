'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createIceConfiguration, parseServerUrls } = require('../service/turnCredentialsService.js');

const BASE_ENV = {
    STUN_URIS: 'stun:turn.example.test:3478',
    TURN_URIS: 'turn:turn.example.test:3478?transport=udp,turns:turn.example.test:5349?transport=tcp',
    TURN_SHARED_SECRET: 'a'.repeat(64),
    TURN_CREDENTIAL_TTL_SECONDS: '600'
};

test('TURN REST credentials use an expiry-scoped username and HMAC-SHA1 password', () => {
    const now = 1_800_000_000_000;
    const result = createIceConfiguration(42, BASE_ENV, now);
    const expiry = Math.floor(now / 1000) + 600;
    const username = expiry + ':42';
    const expectedCredential = crypto.createHmac('sha1', BASE_ENV.TURN_SHARED_SECRET)
        .update(username, 'utf8')
        .digest('base64');

    assert.equal(result.turnAvailable, true);
    assert.equal(result.credentialExpiresAt, expiry);
    assert.equal(result.credentialTtlSeconds, 600);
    assert.deepEqual(result.iceServers[0], { urls: 'stun:turn.example.test:3478' });
    assert.deepEqual(result.iceServers[1], {
        urls: [
            'turn:turn.example.test:3478?transport=udp',
            'turns:turn.example.test:5349?transport=tcp'
        ],
        username,
        credential: expectedCredential
    });
});

test('STUN-only configuration never returns a TURN credential', () => {
    const result = createIceConfiguration(7, {
        STUN_URIS: 'stun:stun.example.test:3478'
    }, 1_800_000_000_000);

    assert.equal(result.turnAvailable, false);
    assert.equal(result.credentialExpiresAt, null);
    assert.equal(result.credentialTtlSeconds, null);
    assert.deepEqual(result.iceServers, [{ urls: 'stun:stun.example.test:3478' }]);
});

test('TURN URLs require a shared secret and vice versa', () => {
    assert.throws(
        () => createIceConfiguration(7, { TURN_URIS: 'turn:turn.example.test:3478' }),
        { code: 'TURN_CONFIG_INVALID' }
    );
    assert.throws(
        () => createIceConfiguration(7, { TURN_SHARED_SECRET: 'x'.repeat(64) }),
        { code: 'TURN_CONFIG_INVALID' }
    );
});

test('invalid TURN secret length and credential TTL fail closed', () => {
    assert.throws(
        () => createIceConfiguration(7, {
            TURN_URIS: 'turn:turn.example.test:3478',
            TURN_SHARED_SECRET: 'short'
        }),
        { code: 'TURN_CONFIG_INVALID' }
    );

    assert.throws(
        () => createIceConfiguration(7, {
            ...BASE_ENV,
            TURN_CREDENTIAL_TTL_SECONDS: '99999'
        }),
        { code: 'TURN_CONFIG_INVALID' }
    );
});

test('only STUN/STUNS and TURN/TURNS URI schemes are accepted', () => {
    assert.deepEqual(parseServerUrls('turn:one.test:3478; turns:two.test:5349', ['turn:', 'turns:'], 'TURN_URIS'), [
        'turn:one.test:3478',
        'turns:two.test:5349'
    ]);
    assert.throws(
        () => parseServerUrls('https://turn.example.test', ['turn:', 'turns:'], 'TURN_URIS'),
        { code: 'TURN_CONFIG_INVALID' }
    );
    assert.throws(
        () => parseServerUrls('turn:user:password@turn.example.test', ['turn:', 'turns:'], 'TURN_URIS'),
        { code: 'TURN_CONFIG_INVALID' }
    );
});
