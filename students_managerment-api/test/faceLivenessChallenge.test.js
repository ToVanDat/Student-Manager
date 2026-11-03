'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLivenessChallenge, verifyLivenessSequence, MAX_FRAME_GAP_MS } = require('../service/faceLivenessChallenge.js');

function frame(receivedAt, blink = 0.05, smile = 0.05) {
    return {
        receivedAt,
        liveness: {
            eyeBlinkLeft: blink,
            eyeBlinkRight: blink,
            mouthSmileLeft: smile,
            mouthSmileRight: smile,
            jawOpen: 0.05
        }
    };
}

test('shares the same bounded frame-gap policy with Redis capture ingestion', () => {
    assert.equal(MAX_FRAME_GAP_MS, 10_000);
});

test('creates a short-lived challenge with a random ordered action sequence', () => {
    const challenge = createLivenessChallenge(1_000);
    assert.equal(challenge.actions.length, 2);
    assert.deepEqual([...challenge.actions].sort(), ['blink', 'smile']);
    assert.equal(challenge.issuedAt, 1_000);
    assert.equal(challenge.expiresAt, 61_000);
    assert.ok(challenge.nonce.length >= 40);
});

test('verifies blink followed by smile from temporally ordered server signals', () => {
    const frames = [
        frame(1_100), frame(1_300), frame(1_500, 0.9), frame(1_700),
        frame(1_900), frame(2_100, 0.05, 0.8)
    ];
    assert.deepEqual(verifyLivenessSequence({
        actions: ['blink', 'smile'], frames, issuedAt: 1_000, expiresAt: 5_000, now: 2_200
    }), { passed: true, reason: 'CHALLENGE_COMPLETED' });
});

test('verifies smile followed by blink when the challenge order is reversed', () => {
    const frames = [
        frame(1_100), frame(1_300, 0.05, 0.8), frame(1_500),
        frame(1_700), frame(1_900, 0.9), frame(2_100)
    ];
    assert.equal(verifyLivenessSequence({
        actions: ['smile', 'blink'], frames, issuedAt: 1_000, expiresAt: 5_000, now: 2_200
    }).passed, true);
});

test('rejects missing actions, invalid signals, stale challenges and frame gaps', () => {
    const valid = [
        frame(1_100), frame(1_300), frame(1_500, 0.9), frame(1_700),
        frame(1_900), frame(2_100, 0.05, 0.8)
    ];
    const base = { actions: ['blink', 'smile'], issuedAt: 1_000, expiresAt: 5_000, now: 2_200 };
    assert.equal(verifyLivenessSequence({ ...base, frames: valid.slice(0, 5) }).reason, 'INVALID_FRAME_SEQUENCE');
    assert.equal(verifyLivenessSequence({ ...base, frames: valid, now: 5_001 }).reason, 'INVALID_FRAME_SEQUENCE');
    const gap = valid.map(item => ({ ...item }));
    gap[3] = { ...gap[3], receivedAt: 5_000 };
    assert.equal(verifyLivenessSequence({ ...base, frames: gap }).reason, 'INVALID_FRAME_SEQUENCE');
    const invalid = valid.map(item => ({ ...item, liveness: { ...item.liveness } }));
    invalid[0].liveness.eyeBlinkLeft = 2;
    assert.equal(verifyLivenessSequence({ ...base, frames: invalid }).reason, 'INVALID_FRAME_SEQUENCE');
    assert.equal(verifyLivenessSequence({ ...base, actions: ['blink', 'blink'], frames: valid }).reason, 'INVALID_CHALLENGE');
});

test('rejects a sequence where actions occur in the wrong order', () => {
    const frames = [
        frame(1_100), frame(1_300, 0.05, 0.8), frame(1_500),
        frame(1_700), frame(1_900, 0.9), frame(2_100)
    ];
    assert.equal(verifyLivenessSequence({
        actions: ['blink', 'smile'], frames, issuedAt: 1_000, expiresAt: 5_000, now: 2_200
    }).reason, 'ACTION_NOT_COMPLETED');
});


test('allows bounded server-side inference latency without accepting stale or excessively long sequences', () => {
    const frames = [
        frame(1_100), frame(9_100), frame(17_100, 0.9),
        frame(25_100), frame(33_100), frame(41_100, 0.05, 0.8)
    ];
    const result = verifyLivenessSequence({
        actions: ['blink', 'smile'],
        frames,
        issuedAt: 1_000,
        expiresAt: 61_000,
        now: 42_000
    });
    assert.deepEqual(result, { passed: true, reason: 'CHALLENGE_COMPLETED' });

    const tooSlow = frames.map((item, index) => ({
        ...item,
        receivedAt: 1_100 + index * 11_000
    }));
    assert.equal(verifyLivenessSequence({
        actions: ['blink', 'smile'],
        frames: tooSlow,
        issuedAt: 1_000,
        expiresAt: 61_000,
        now: 57_000
    }).reason, 'INVALID_FRAME_SEQUENCE');

    assert.equal(verifyLivenessSequence({
        actions: ['blink', 'smile'],
        frames,
        issuedAt: 1_000,
        expiresAt: 61_000,
        now: 61_001
    }).reason, 'INVALID_FRAME_SEQUENCE');
});
