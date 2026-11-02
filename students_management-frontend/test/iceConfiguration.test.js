import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIceConfiguration, getIceCredentialRefreshDelay, extractIceUfrags, isIceCandidateForRemoteDescription } from '../src/utils/iceConfiguration.js';

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

    assert.deepEqual(result.iceServers, [{ urls: ['stun:stun.example.com:3478'] }]);
});

test('schedules credential refresh before expiry with a bounded safety margin', () => {
    const now = 1_800_000_000_000;
    assert.equal(getIceCredentialRefreshDelay(1_800_000_060, now), 45_000);
    assert.equal(getIceCredentialRefreshDelay(1_800_086_400, now), 86_280_000);
    assert.equal(getIceCredentialRefreshDelay(null, now), null);
});

test('extracts distinct ICE generations and rejects stale candidates', () => {
    const sdp = [
        'v=0',
        'a=ice-ufrag:current-generation',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=ice-ufrag:audio-generation'
    ].join('\\r\\n');

    assert.deepEqual(extractIceUfrags(sdp), ['current-generation', 'audio-generation']);
    assert.equal(isIceCandidateForRemoteDescription({ usernameFragment: 'current-generation' }, sdp), true);
    assert.equal(isIceCandidateForRemoteDescription({ usernameFragment: 'old-generation' }, sdp), false);
    assert.equal(isIceCandidateForRemoteDescription({ candidate: 'candidate:1' }, sdp), true);
});
