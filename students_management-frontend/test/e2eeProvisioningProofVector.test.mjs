import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, hkdfSync } from 'node:crypto';

const utf8 = value => Buffer.from(value, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest();

function lengthPrefix(value) {
    const bytes = Buffer.from(value);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    return Buffer.concat([length, bytes]);
}

function decodeCanonicalBase64(value, expectedLength, fieldName) {
    assert.equal(typeof value, 'string', `${fieldName} must be a string`);
    assert.match(value, /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, `${fieldName} must be canonical Base64`);
    const decoded = Buffer.from(value, 'base64');
    assert.equal(decoded.toString('base64'), value, `${fieldName} must round-trip as canonical Base64`);
    assert.equal(decoded.length, expectedLength, `${fieldName} must be ${expectedLength} bytes`);
    return decoded;
}

function buildTranscript({ sessionId, challenge, primaryPublicKey, newDevicePublicKey, encryptedMessage }) {
    const challengeBytes = decodeCanonicalBase64(challenge, 32, 'challenge');
    const primaryBytes = decodeCanonicalBase64(primaryPublicKey, 32, 'primaryPublicKey');
    const newDeviceBytes = decodeCanonicalBase64(newDevicePublicKey, 32, 'newDevicePublicKey');
    const ciphertextDigest = sha256(utf8(encryptedMessage));
    return Buffer.concat([
        utf8('StudentManager/E2EE/ProvisioningTranscript/v1'),
        Buffer.from([0x01]),
        lengthPrefix(utf8(sessionId)),
        challengeBytes,
        primaryBytes,
        newDeviceBytes,
        ciphertextDigest
    ]);
}

function deriveProofKey(sharedSecret, challenge, sessionId) {
    assert.equal(sharedSecret.length, 32, 'sharedSecret must be 32 bytes');
    const salt = sha256(Buffer.concat([
        utf8('StudentManager/E2EE/ProvisioningSalt/v1'),
        challenge,
        utf8(sessionId)
    ]));
    return Buffer.from(hkdfSync(
        'sha256',
        sharedSecret,
        salt,
        utf8('StudentManager/E2EE/ProvisioningProof/v1'),
        32
    ));
}

function computeProof(inputs) {
    const challenge = decodeCanonicalBase64(inputs.challenge, 32, 'challenge');
    const sharedSecret = Buffer.from(inputs.sharedSecretHex, 'hex');
    const proofKey = deriveProofKey(sharedSecret, challenge, inputs.sessionId);
    try {
        const transcript = buildTranscript(inputs);
        return {
            transcriptSha256: sha256(transcript).toString('hex'),
            proofHex: createHmac('sha256', proofKey).update(transcript).digest('hex')
        };
    } finally {
        proofKey.fill(0);
        sharedSecret.fill(0);
    }
}

const vector = {
    sessionId: 'test-session-001',
    sharedSecretHex: '11'.repeat(32),
    challenge: Buffer.alloc(32, 0x22).toString('base64'),
    primaryPublicKey: Buffer.alloc(32, 0x33).toString('base64'),
    newDevicePublicKey: Buffer.alloc(32, 0x44).toString('base64'),
    encryptedMessage: '{"ciphertext":"AQIDBA==","iv":"BQUFBQUFBQUFBQUF","authTag":"BgYGBgYGBgYGBgYGBgYGBg=="}'
};

test('provisioning proof v1 matches the deterministic cross-implementation vector', () => {
    const result = computeProof(vector);
    assert.equal(result.transcriptSha256, '7ba6ebba1874ec0418ee48cb06fc38f94baab7fbebce376baf2eba8e65aa3e22');
    assert.equal(result.proofHex, '591552357325914907c226ab5fc9eabd6465f65285626f66f0cb7d914cacbf01');
});

test('provisioning proof transcript binds the exact ciphertext string', () => {
    const baseline = computeProof(vector);
    const changed = computeProof({
        ...vector,
        encryptedMessage: vector.encryptedMessage + ' '
    });
    assert.notEqual(changed.transcriptSha256, baseline.transcriptSha256);
    assert.notEqual(changed.proofHex, baseline.proofHex);
});

test('provisioning proof rejects malformed or noncanonical fixed-size inputs', () => {
    assert.throws(() => buildTranscript({ ...vector, challenge: 'A'.repeat(43) }), /canonical Base64/);
    assert.throws(() => buildTranscript({
        ...vector,
        primaryPublicKey: Buffer.alloc(31, 0x33).toString('base64')
    }), /must be 32 bytes/);
});
