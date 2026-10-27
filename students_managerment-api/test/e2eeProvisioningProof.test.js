const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    buildProvisioningTranscript,
    deriveProvisioningProof,
    verifyProvisioningProof
} = require('../utils/e2eeProvisioningProof');

const vector = {
    sessionId: 'test-session-001',
    sharedSecret: Buffer.alloc(32, 0x11),
    challenge: Buffer.alloc(32, 0x22).toString('base64'),
    ownerEphemeralPublicKey: Buffer.alloc(32, 0x33).toString('base64'),
    newDeviceEphemeralPublicKey: Buffer.alloc(32, 0x44).toString('base64'),
    encryptedMessage: '{"ciphertext":"AQIDBA==","iv":"BQUFBQUFBQUFBQUF","authTag":"BgYGBgYGBgYGBgYGBgYGBg=="}'
};

test('v1 provisioning proof matches the published deterministic vector', () => {
    const transcript = buildProvisioningTranscript(vector);
    assert.equal(
        crypto.createHash('sha256').update(transcript).digest('hex'),
        '7ba6ebba1874ec0418ee48cb06fc38f94baab7fbebce376baf2eba8e65aa3e22'
    );
    const proof = deriveProvisioningProof(vector);
    assert.equal(
        proof.toString('hex'),
        '591552357325914907c226ab5fc9eabd6465f65285626f66f0cb7d914cacbf01'
    );
    assert.equal(
        proof.toString('base64'),
        'WRVSNXMlkUkHwiarX8nqvWRl9lKFYm9m8Mt9kUysvwE='
    );
});

test('proof is bound to the exact ciphertext and both ephemeral public keys', () => {
    const baseline = deriveProvisioningProof(vector);
    for (const changed of [
        { ...vector, encryptedMessage: vector.encryptedMessage + ' ' },
        { ...vector, ownerEphemeralPublicKey: Buffer.alloc(32, 0x34).toString('base64') },
        { ...vector, newDeviceEphemeralPublicKey: Buffer.alloc(32, 0x45).toString('base64') },
        { ...vector, sessionId: 'test-session-002' },
        { ...vector, challenge: Buffer.alloc(32, 0x23).toString('base64') }
    ]) {
        assert.notDeepEqual(deriveProvisioningProof(changed), baseline);
    }
});

test('verification requires canonical 32-byte commitment and proof values', () => {
    const proof = deriveProvisioningProof(vector).toString('base64');
    assert.equal(verifyProvisioningProof({ ...vector, commitment: proof, proof }), true);
    assert.equal(verifyProvisioningProof({
        ...vector,
        commitment: proof,
        proof: Buffer.alloc(32, 0x99).toString('base64')
    }), false);
    assert.throws(() => verifyProvisioningProof({
        ...vector,
        commitment: 'not-base64',
        proof
    }), /canonical padded Base64/);
    assert.throws(() => verifyProvisioningProof({
        ...vector,
        commitment: Buffer.alloc(31).toString('base64'),
        proof
    }), /exactly 32 bytes/);
});

test('transcript rejects malformed ephemeral keys and oversized ciphertext', () => {
    assert.throws(() => buildProvisioningTranscript({
        ...vector,
        ownerEphemeralPublicKey: Buffer.alloc(31).toString('base64')
    }), /exactly 32 bytes/);
    assert.throws(() => buildProvisioningTranscript({
        ...vector,
        encryptedMessage: 'x'.repeat(700_001)
    }), /invalid/);
});
