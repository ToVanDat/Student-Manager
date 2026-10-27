'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyCapturePayload } = require('../service/faceCaptureValidation.js');

function signals(blink = 0.05, smile = 0.05) {
    return {
        eyeBlinkLeft: blink, eyeBlinkRight: blink,
        mouthSmileLeft: smile, mouthSmileRight: smile, jawOpen: 0.05
    };
}

function makeState({ padScore = 0.99, secondIdentity = false } = {}) {
    const base = [1, ...Array(127).fill(0)];
    const other = [0, 1, ...Array(126).fill(0)];
    const values = [
        [1_100, signals()], [1_300, signals()], [1_500, signals(0.9)],
        [1_700, signals()], [1_900, signals()], [2_100, signals(0.05, 0.8)]
    ];
    return {
        liveness: {
            actions: ['blink', 'smile'], issuedAt: 1_000, expiresAt: 5_000
        },
        capture: {
            frames: values.map(([receivedAt, liveness], index) => ({
                receivedAt, liveness, padScore,
                embedding: secondIdentity && index === 5 ? other : base
            }))
        }
    };
}

test('accepts only a complete liveness sequence with PAD pass and consistent MobileFaceNet embeddings', () => {
    const embedding = verifyCapturePayload(makeState(), {
        padThreshold: 0.9, consistencyThreshold: 0.8, now: 2_200
    });
    assert.equal(embedding.length, 128);
    assert.ok(Math.abs(Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0)) - 1) < 1e-6);
});

test('rejects uncalibrated thresholds and PAD failure', () => {
    assert.throws(() => verifyCapturePayload(makeState(), {
        padThreshold: undefined, consistencyThreshold: 0.8, now: 2_200
    }), error => error.code === 'FACE_AUTH_CONFIG_NOT_READY');
    assert.throws(() => verifyCapturePayload(makeState({ padScore: 0.5 }), {
        padThreshold: 0.9, consistencyThreshold: 0.8, now: 2_200
    }), error => error.code === 'FACE_PAD_FAILED');
});

test('rejects face identity changes across frames', () => {
    assert.throws(() => verifyCapturePayload(makeState({ secondIdentity: true }), {
        padThreshold: 0.9, consistencyThreshold: 0.8, now: 2_200
    }), error => error.code === 'FACE_IDENTITY_INCONSISTENT');
});

test('rejects incomplete capture and expired challenge', () => {
    const state = makeState();
    state.capture.frames.pop();
    assert.throws(() => verifyCapturePayload(state, {
        padThreshold: 0.9, consistencyThreshold: 0.8, now: 2_200
    }), error => error.code === 'FACE_CAPTURE_INCOMPLETE');
    assert.throws(() => verifyCapturePayload(makeState(), {
        padThreshold: 0.9, consistencyThreshold: 0.8, now: 5_001
    }), error => error.code === 'FACE_LIVENESS_FAILED');
});
