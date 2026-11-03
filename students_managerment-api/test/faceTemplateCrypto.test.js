'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    encryptFaceTemplate,
    decryptFaceTemplate,
    validateEmbedding
} = require('../service/faceTemplateCrypto.js');

const originalKey = process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
const originalVersion = process.env.FACE_TEMPLATE_KEY_VERSION;

test.beforeEach(() => {
    process.env.FACE_TEMPLATE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    process.env.FACE_TEMPLATE_KEY_VERSION = '1';
});

test.after(() => {
    if (originalKey === undefined) delete process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
    else process.env.FACE_TEMPLATE_ENCRYPTION_KEY = originalKey;
    if (originalVersion === undefined) delete process.env.FACE_TEMPLATE_KEY_VERSION;
    else process.env.FACE_TEMPLATE_KEY_VERSION = originalVersion;
});

test('AES-256-GCM encrypts and decrypts a normalized 128-D template', () => {
    const embedding = Array.from({ length: 128 }, (_, index) => index + 1);
    const envelope = encryptFaceTemplate({
        userId: '42',
        embedding,
        modelId: 'mobilefacenet',
        modelVersion: 'test-v1'
    });
    assert.equal(envelope.nonce.length, 12);
    assert.equal(envelope.authTag.length, 16);
    assert.ok(envelope.ciphertext.length > 0);
    const restored = decryptFaceTemplate({
        userId: '42',
        ...envelope
    });
    assert.equal(restored.length, 128);
    assert.ok(Math.abs(Math.sqrt(restored.reduce((sum, value) => sum + value * value, 0)) - 1) < 1e-5);
});

test('AES-GCM authentication rejects tampered ciphertext', () => {
    const envelope = encryptFaceTemplate({
        userId: '42',
        embedding: Array.from({ length: 128 }, (_, index) => index + 1),
        modelId: 'mobilefacenet',
        modelVersion: 'test-v1'
    });
    envelope.ciphertext[0] ^= 1;
    assert.throws(() => decryptFaceTemplate({ userId: '42', ...envelope }));
});

test('associated data binds the encrypted template to its account', () => {
    const envelope = encryptFaceTemplate({
        userId: '42',
        embedding: Array.from({ length: 128 }, (_, index) => index + 1),
        modelId: 'mobilefacenet',
        modelVersion: 'test-v1'
    });
    assert.throws(() => decryptFaceTemplate({ userId: '43', ...envelope }));
});

test('invalid dimensions and non-finite values are rejected', () => {
    assert.throws(() => validateEmbedding([1, 2, 3]), /128/);
    const invalid = Array(128).fill(0);
    invalid[4] = Number.NaN;
    assert.throws(() => validateEmbedding(invalid), /128/);
});
