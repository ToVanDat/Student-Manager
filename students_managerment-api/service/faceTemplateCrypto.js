'use strict';

const crypto = require('crypto');

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function getKey(version = getKeyVersion()) {
    let encoded;
    if (process.env.FACE_TEMPLATE_ENCRYPTION_KEYS) {
        let keyring;
        try { keyring = JSON.parse(process.env.FACE_TEMPLATE_ENCRYPTION_KEYS); }
        catch {
            const error = new Error('FACE_TEMPLATE_ENCRYPTION_KEYS phải là JSON object ánh xạ version sang base64 key');
            error.code = 'FACE_AUTH_CONFIG_INVALID';
            throw error;
        }
        encoded = keyring?.[String(version)];
    } else if (version === getKeyVersion()) {
        encoded = process.env.FACE_TEMPLATE_ENCRYPTION_KEY;
    }

    if (!encoded) {
        const error = new Error(`Không tìm thấy FACE template key cho version ${version}`);
        error.code = 'FACE_AUTH_CONFIG_NOT_READY';
        throw error;
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== KEY_BYTES) {
        const error = new Error(`FACE template key version ${version} phải là base64 của đúng 32 byte`);
        error.code = 'FACE_AUTH_CONFIG_INVALID';
        throw error;
    }
    return key;
}

function getKeyVersion() {
    const version = Number.parseInt(process.env.FACE_TEMPLATE_KEY_VERSION || '1', 10);
    if (!Number.isSafeInteger(version) || version < 1 || version > 32767) {
        const error = new Error('FACE_TEMPLATE_KEY_VERSION không hợp lệ');
        error.code = 'FACE_AUTH_CONFIG_INVALID';
        throw error;
    }
    return version;
}

function associatedData(userId, keyVersion, modelId, modelVersion) {
    return Buffer.from(
        ['student-manager-face-template-v1', String(userId), String(keyVersion), modelId, modelVersion].join(':'),
        'utf8'
    );
}

function validateEmbedding(embedding) {
    if (!Array.isArray(embedding) || embedding.length !== 128 ||
        embedding.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
        throw new TypeError('Face template phải là vector gồm đúng 128 giá trị hữu hạn');
    }
    const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm < 1e-8) {
        throw new TypeError('Face template không hợp lệ');
    }
    return embedding.map(value => Math.fround(value / norm));
}

function encryptFaceTemplate({ userId, embedding, modelId, modelVersion }) {
    if (!userId || !modelId || !modelVersion) throw new TypeError('Thiếu metadata face template');
    const normalized = validateEmbedding(embedding);
    const keyVersion = getKeyVersion();
    const nonce = crypto.randomBytes(NONCE_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(keyVersion), nonce);
    cipher.setAAD(associatedData(userId, keyVersion, modelId, modelVersion));
    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(JSON.stringify(normalized), 'utf8')),
        cipher.final()
    ]);
    return {
        ciphertext,
        nonce,
        authTag: cipher.getAuthTag(),
        keyVersion,
        modelId,
        modelVersion,
        templateFormat: 'float32-128'
    };
}

function decryptFaceTemplate({ userId, ciphertext, nonce, authTag, keyVersion, modelId, modelVersion }) {
    if (!userId || !ciphertext || !nonce || !authTag || !keyVersion || !modelId || !modelVersion) {
        throw new TypeError('Face credential envelope không đầy đủ');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(Number(keyVersion)), Buffer.from(nonce));
    decipher.setAAD(associatedData(userId, keyVersion, modelId, modelVersion));
    decipher.setAuthTag(Buffer.from(authTag));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext)),
        decipher.final()
    ]).toString('utf8');
    return validateEmbedding(JSON.parse(plaintext));
}

module.exports = {
    encryptFaceTemplate,
    decryptFaceTemplate,
    validateEmbedding
};
