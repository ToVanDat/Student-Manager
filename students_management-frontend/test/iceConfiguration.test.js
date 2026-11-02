import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIceConfiguration } from '../src/utils/iceConfiguration.js';

test('keeps authenticated TURN credentials and public STUN URLs', () => {
    const result = buildIceConfiguration({
        turnAvailable: true,
        credentialExpiresAt: 1_800_000_000,
        iceServers: [
            { urls: 'stun:turn.example.com:3478' },
            {
                urls: ['turn:turn.example.com:3478?transport=udp', 'turns:turn.example.com:5349?transport=tcp'],
                username: '1800000000:42',
                credential: 'temporary-hmac-credential'
            }
        ]
    });

    assert.equal(result.turnAvailable, true);
    assert.equal(result.iceServers.length, 2);
    assert.equal(result.iceServers[1].username, '1800000000:42');
    assert.equal(result.credentialExpiresAt, 1_800_000_000);
});

test('rejects TURN entries without short-lived credentials', () => {
    const result = buildIceConfiguration({
        iceServers: [{ urls: 'turn:turn.example.com:3478?transport=udp' }]
    }, 'stun:stun.example.com:3478');

    assert.equal(result.turnAvailable, false);
    assert.deepEqual(result.iceServers, [{ urls: ['stun:stun.example.com:3478'] }]);
});

test('deduplicates servers and ignores malformed URLs', () => {
    const result = buildIceConfiguration({
        iceServers: [
            { urls: 'stun:stun.example.com:3478' },
            { urls: 'stun:stun.example.com:3478' },
            { urls: 'https://attacker.example/path' },
            { urls: 'turn:turn.example.com:70000?transport=udp', username: 'u', credential: 'p' }
        ]
    });

    assert.deepEqual(result.iceServers, [{ urls: ['stun:stun.example.com:3478'] }]);
    assert.equal(result.turnAvailable, false);
});

test('does not expose credential fields on STUN-only entries', () => {
    const result = buildIceConfiguration({
        iceServers: [{
            urls: 'stun:stun.example.com:3478',
            username: 'unexpected',
            credential: 'unexpected'
        }]
    });

    assert.deepEqual(result.iceServers, [{ urls: 'stun:stun.example.com:3478' }]);
});
