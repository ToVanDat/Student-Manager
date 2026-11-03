'use strict';

const { encryptFaceTemplate, decryptFaceTemplate } = require('./faceTemplateCrypto.js');

const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/;

function bindingIdentity(kind, challengeId) {
    if (!['enrollment', 'login'].includes(kind) ||
        typeof challengeId !== 'string' ||
        !CHALLENGE_ID_PATTERN.test(challengeId)) {
        const error = new Error('Face capture challenge binding is invalid.');
        error.code = 'FACE_CHALLENGE_INVALID';
        throw error;
    }
    return 'face-capture:' + kind + ':' + challengeId;
}

/**
 * Encrypt each transient embedding before it is written to Redis.
 * The AES-GCM associated data binds the ciphertext to its capture type and
 * one-time challenge ID, so envelopes cannot be copied between challenges.
 */
function encryptCaptureEmbedding({ kind, challengeId, embedding, modelId, modelVersion }) {
    const envelope = encryptFaceTemplate({
        userId: bindingIdentity(kind, challengeId),
        embedding,
        modelId,
        modelVersion
    });

    return {
        ciphertext: envelope.ciphertext.toString('base64'),
        nonce: envelope.nonce.toString('base64'),
        authTag: envelope.authTag.toString('base64'),
        keyVersion: envelope.keyVersion,
        modelId: envelope.modelId,
        modelVersion: envelope.modelVersion
    };
}

function decodeBase64(value, expectedLength, label) {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
        const error = new Error('Encrypted face capture ' + label + ' is malformed.');
        error.code = 'FACE_CAPTURE_ENVELOPE_INVALID';
        throw error;
    }
    const decoded = Buffer.from(value, 'base64');
    if (expectedLength && decoded.length !== expectedLength) {
        const error = new Error('Encrypted face capture ' + label + ' has an invalid length.');
        error.code = 'FACE_CAPTURE_ENVELOPE_INVALID';
        throw error;
    }
    return decoded;
}

function decryptCaptureEmbedding({ kind, challengeId, envelope }) {
    if (!envelope || !Number.isSafeInteger(envelope.keyVersion) ||
        envelope.keyVersion < 1 || typeof envelope.modelId !== 'string' ||
        typeof envelope.modelVersion !== 'string') {
        const error = new Error('Encrypted face capture envelope is incomplete.');
        error.code = 'FACE_CAPTURE_ENVELOPE_INVALID';
        throw error;
    }

    return decryptFaceTemplate({
        userId: bindingIdentity(kind, challengeId),
        ciphertext: decodeBase64(envelope.ciphertext, null, 'ciphertext'),
        nonce: decodeBase64(envelope.nonce, 12, 'nonce'),
        authTag: decodeBase64(envelope.authTag, 16, 'authentication tag'),
        keyVersion: envelope.keyVersion,
        modelId: envelope.modelId,
        modelVersion: envelope.modelVersion
    });
}

module.exports = { encryptCaptureEmbedding, decryptCaptureEmbedding };
