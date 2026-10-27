const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    decodeCanonical32,
    digestProvisioningCiphertext,
    verifyProvisioningProof
} = require('../utils/e2eeProvisioningProof');

const vector = {
    encryptedMessage: '{"ciphertext":"AQIDBA==","iv":"BQUFBQUFBQUFBQUF","authTag":"BgYGBgYGBgYGBgYGBgYGBg=="}',
    proof: 'WRVSNXMlkUkHwiarX8nqvWRl9lKFYm9m8Mt9kUysvwE='
};

test('relay accepts the v1 proof only when it matches the hidden primary commitment', () => {
    assert.equal(verifyProvisioningProof({ commitment: vector.proof, proof: vector.proof }), true);
    assert.equal(verifyProvisioningProof({
        commitment: vector.proof,
        proof: Buffer.alloc(32, 0x99).toString('base64')
    }), false);
});

test('proof and commitment must be canonical padded Base64 encoding exactly 32 bytes', () => {
    assert.throws(() => decodeCanonical32('not-base64', 'proof'), /canonical padded Base64/);
    assert.throws(() => decodeCanonical32(Buffer.alloc(31).toString('base64'), 'proof'), /exactly 32 bytes/);
    assert.throws(() => decodeCanonical32(Buffer.alloc(33).toString('base64'), 'proof'), /exactly 32 bytes/);
    assert.throws(() => decodeCanonical32(Buffer.alloc(32).toString('base64').replace(/=$/, ''), 'proof'), /canonical padded Base64/);
});

test('ciphertext digest is SHA-256 of the exact UTF-8 string', () => {
    const expected = crypto.createHash('sha256').update(Buffer.from(vector.encryptedMessage, 'utf8')).digest('base64');
    assert.equal(digestProvisioningCiphertext(vector.encryptedMessage), expected);
    assert.notEqual(digestProvisioningCiphertext(vector.encryptedMessage), digestProvisioningCiphertext(vector.encryptedMessage + ' '));
});

test('ciphertext digest rejects empty and oversized input', () => {
    assert.throws(() => digestProvisioningCiphertext(''), /invalid/);
    assert.throws(() => digestProvisioningCiphertext('x'.repeat(700_001)), /invalid/);
});
