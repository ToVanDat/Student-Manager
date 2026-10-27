'use strict';

const crypto = require('node:crypto');

const ACTIONS = Object.freeze(['blink', 'smile']);
const MAX_FRAMES = 40;
const MIN_FRAMES = 6;
const MAX_DURATION_MS = 12_000;
const MAX_FRAME_GAP_MS = 3_000;

function createLivenessChallenge(now = Date.now()) {
    const actions = crypto.randomInt(0, 2) === 0 ? [...ACTIONS] : [...ACTIONS].reverse();
    return Object.freeze({
        id: crypto.randomUUID(),
        nonce: crypto.randomBytes(32).toString('base64url'),
        actions,
        issuedAt: now,
        expiresAt: now + 30_000
    });
}

function validScore(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateFrames(frames, issuedAt, expiresAt, now) {
    if (!Array.isArray(frames) || frames.length < MIN_FRAMES || frames.length > MAX_FRAMES) {
        return false;
    }
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || now > expiresAt) return false;

    let previous = 0;
    for (const frame of frames) {
        if (!frame || !Number.isFinite(frame.receivedAt) ||
            frame.receivedAt < issuedAt || frame.receivedAt > expiresAt ||
            frame.receivedAt <= previous) return false;
        if (previous && frame.receivedAt - previous > MAX_FRAME_GAP_MS) return false;
        const signals = frame.liveness;
        if (!signals || !['eyeBlinkLeft', 'eyeBlinkRight', 'mouthSmileLeft', 'mouthSmileRight', 'jawOpen']
            .every(key => validScore(signals[key]))) return false;
        previous = frame.receivedAt;
    }
    return frames[frames.length - 1].receivedAt - frames[0].receivedAt <= MAX_DURATION_MS;
}

function findBlink(frames, startIndex) {
    for (let i = startIndex; i < frames.length - 2; i += 1) {
        const a = frames[i].liveness;
        const b = frames[i + 1].liveness;
        const c = frames[i + 2].liveness;
        const neutral = a.eyeBlinkLeft < 0.3 && a.eyeBlinkRight < 0.3;
        const closed = b.eyeBlinkLeft > 0.65 && b.eyeBlinkRight > 0.65;
        const reopened = c.eyeBlinkLeft < 0.4 && c.eyeBlinkRight < 0.4;
        if (neutral && closed && reopened) return i + 2;
    }
    return -1;
}

function findSmile(frames, startIndex) {
    for (let i = startIndex; i < frames.length - 1; i += 1) {
        const a = frames[i].liveness;
        const b = frames[i + 1].liveness;
        const neutral = a.mouthSmileLeft < 0.35 && a.mouthSmileRight < 0.35;
        const smiling = b.mouthSmileLeft > 0.55 && b.mouthSmileRight > 0.55;
        if (neutral && smiling) return i + 1;
    }
    return -1;
}

// This verifier accepts only signals extracted by the trusted server-side MediaPipe service.
// It is not a standalone anti-spoof guarantee; calibrated PAD remains a separate required gate.
function verifyLivenessSequence({ actions, frames, issuedAt, expiresAt, now = Date.now() }) {
    if (!Array.isArray(actions) || actions.length !== ACTIONS.length ||
        new Set(actions).size !== ACTIONS.length || actions.some(action => !ACTIONS.includes(action))) {
        return { passed: false, reason: 'INVALID_CHALLENGE' };
    }
    if (!validateFrames(frames, issuedAt, expiresAt, now)) {
        return { passed: false, reason: 'INVALID_FRAME_SEQUENCE' };
    }

    let cursor = 0;
    for (const action of actions) {
        const matchedAt = action === 'blink'
            ? findBlink(frames, cursor)
            : findSmile(frames, cursor);
        if (matchedAt < 0) return { passed: false, reason: 'ACTION_NOT_COMPLETED' };
        cursor = matchedAt + 1;
    }
    return { passed: true, reason: 'CHALLENGE_COMPLETED' };
}

module.exports = { createLivenessChallenge, verifyLivenessSequence };
