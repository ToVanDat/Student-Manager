'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createIceConfiguration, parseServerUrls } = require('./turnCredentialsService');

const SECRET = '0123456789abcdef'.repeat(4);
const BASE_ENV = {
    STUN_URIS: 'stun:turn.smartsmanage.com:3478',
    TURN_URIS: 'turn:turn.smartsmanage.com:3478?transport=udp,turns:turn.smartsmanage.com:5349?transport=tcp',
    TURN_SHARED_SECRET: SECRET,
    TURN_CREDENTIAL_TTL_SECONDS: '3600'
};

test('creates per-user Coturn REST credentials with HMAC-SHA1 and expiry username', () => {
    const now = 1_800_000_000_000;
    const config = createIceConfiguration(42, BASE_ENV, now);
    const turn = config.iceServers.find(server => Array.isArray(server.urls) && server.urls.some(url => url.startsWith('turn:')));

    assert.ok(turn);
    assert.equal(turn.username, String(Math.floor(now / 1000) + 3600) + ':42');
    assert.equal(
        turn.credential,
        crypto.createHmac('sha1', SECRET).update(turn.username, 'utf8').digest('base64')
    );
    assert.deepEqual(turn.urls, [
        'turn:turn.smartsmanage.com:3478?transport=udp',
        'turns:turn.smartsmanage.com:5349?transport=tcp'
    ]);
    assert.equal(config.turnAvailable, true);
    assert.equal(config.credentialTtlSeconds, 3600);
});

test('does not return static credentials when TURN is not configured', () => {
    const config = createIceConfiguration(42, {
        STUN_URIS: 'stun:stun.example.net:3478',
        TURN_URIS: '',
        TURN_SHARED_SECRET: ''
    }, 1_800_000_000_000);

    assert.deepEqual(config.iceServers, [{ urls: 'stun:stun.example.net:3478' }]);
    assert.equal(config.turnAvailable, false);
    assert.equal(config.credentialExpiresAt, null);
});

test('rejects a shared secret that is not exactly 32 bytes encoded as hex', () => {
    for (const secret of ['short-secret', 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(66)]) {
        assert.throws(
            () => createIceConfiguration(42, { ...BASE_ENV, TURN_SHARED_SECRET: secret }),
            error => error.code === 'TURN_CONFIG_INVALID'
        );
    }
});

test('rejects TURN configuration without its shared secret and secret without TURN URLs', () => {
    assert.throws(
        () => createIceConfiguration(42, { ...BASE_ENV, TURN_SHARED_SECRET: '' }),
        error => error.code === 'TURN_CONFIG_INVALID'
    );
    assert.throws(
        () => createIceConfiguration(42, { ...BASE_ENV, TURN_URIS: '' }),
        error => error.code === 'TURN_CONFIG_INVALID'
    );
});

test('rejects invalid user identifiers, URI schemes, ports and credential TTLs', () => {
    assert.throws(() => createIceConfiguration(0, BASE_ENV), /tài khoản không hợp lệ/);
    assert.throws(
        () => parseServerUrls('turn:turn.example.net:70000', ['turn:'], 'TURN_URIS'),
        error => error.code === 'TURN_CONFIG_INVALID'
    );
    assert.throws(
        () => createIceConfiguration(42, { ...BASE_ENV, TURN_CREDENTIAL_TTL_SECONDS: '59' }),
        error => error.code === 'TURN_CONFIG_INVALID'
    );
    assert.throws(
        () => createIceConfiguration(42, { ...BASE_ENV, TURN_CREDENTIAL_TTL_SECONDS: '86401' }),
        error => error.code === 'TURN_CONFIG_INVALID'
    );
});
