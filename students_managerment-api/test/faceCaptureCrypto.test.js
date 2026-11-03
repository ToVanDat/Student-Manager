'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    encryptCaptureEmbedding,
    decryptCaptureEmbedding
} = require('../service/faceCaptureCrypto.js');

const previous = {
    key: process.env.FACE_TEMPLATE_ENCRYPTION_KEY,
    keyring: process.env.FACE_TEMPLATE_ENCRYPTION_KEYS,
    version: process.env.FACE_TEMPLATE_KEY_VERSION
};
process.env.FACE_TEMPLATE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
delete process.env.FACE_TEMPLATE_ENCRYPTION_KEYS;
process.env.FACE_TEMPLATE_KEY_VERSION = '7';

const embedding = [1, ...Array(127).fill(0)];

test('encrypts transient face embeddings and restores the normalized vector', () => {
    const envelope = encryptCaptureEmbedding({
        kind: 'login',
        challengeId: 'AbCdEf0123456789_-AbCdEf',
        embedding,
        modelId: 'mobilefacenet+minifasnet-v2',
        modelVersion: 'supplied-bundle-v1'
    });

    assert.equal(Object.hasOwn(envelope, 'embedding'), false);
    assert.equal(typeof envelope.ciphertext, 'string');
    assert.notEqual(envelope.ciphertext, Buffer.from(JSON.stringify(embedding)).toString('base64'));
    assert.deepEqual(decryptCaptureEmbedding({
        kind: 'login',
        challengeId: 'AbCdEf0123456789_-AbCdEf',
        envelope
    }), embedding);
});

test('prevents moving an encrypted embedding to another challenge or capture type', () => {
    const envelope = encryptCaptureEmbedding({
        kind: 'enrollment',
        challengeId: 'AbCdEf0123456789_-AbCdEf',
        embedding,
        modelId: 'mobilefacenet+minifasnet-v2',
        modelVersion: 'supplied-bundle-v1'
    });

    assert.throws(() => decryptCaptureEmbedding({
        kind: 'enrollment',
        challengeId: 'ZbCdEf0123456789_-AbCdEf',
        envelope
    }));
    assert.throws(() => decryptCaptureEmbedding({
        kind: 'login',
        challengeId: 'AbCdEf0123456789_-AbCdEf',
        envelope
    }));
});

test('rejects malformed capture envelopes and challenge identifiers', () => {
    assert.throws(() => decryptCaptureEmbedding({
        kind: 'login',
        challengeId: 'invalid',
        envelope: {}
    }), error => error.code === 'FACE_CHALLENGE_INVALID');

    assert.throws(() => decryptCaptureEmbedding({
        kind: 'login',
        challengeId: 'AbCdEf0123456789_-AbCdEf',
        envelope: {
            ciphertext: 'not base64!',
            nonce: 'AAAAAAAAAAAAAAAA',
            authTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
            keyVersion: 7,
            modelId: 'model',
            modelVersion: 'v1'
        }
    }), error => error.code === 'FACE_CAPTURE_ENVELOPE_INVALID');
});

test.after(() => {
    if (previous.key === undefined) delete process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
    else process.env.FACE_TEMPLATE_ENCRYPTION_KEY = previous.key;
    if (previous.keyring === undefined) delete process.env.FACE_TEMPLATE_ENCRYPTION_KEYS;
    else process.env.FACE_TEMPLATE_ENCRYPTION_KEYS = previous.keyring;
    if (previous.version === undefined) delete process.env.FACE_TEMPLATE_KEY_VERSION;
    else process.env.FACE_TEMPLATE_KEY_VERSION = previous.version;
});
