const crypto = require('node:crypto');

const PROTOCOL_VERSION = 1;
const PROOF_BYTES = 32;
const MAX_CIPHERTEXT_BYTES = 700_000;

const decodeCanonical32 = (value, name = 'value') => {
    if (typeof value !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/.test(value)) {
        throw new TypeError(`${name} must be canonical padded Base64`);
    }
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== PROOF_BYTES || decoded.toString('base64') !== value) {
        throw new TypeError(`${name} must encode exactly 32 bytes`);
    }
    return decoded;
};

// The relay deliberately does not derive the HMAC: it never receives the
// ECDH shared secret. It stores the primary's commitment and accepts the
// new-device proof only when both canonical 32-byte values match.
const verifyProvisioningProof = ({ commitment, proof }) => {
    const expected = decodeCanonical32(commitment, 'commitment');
    const supplied = decodeCanonical32(proof, 'proof');
    try {
        return crypto.timingSafeEqual(expected, supplied);
    } finally {
        expected.fill(0);
        supplied.fill(0);
    }
};

const digestProvisioningCiphertext = encryptedMessage => {
    if (typeof encryptedMessage !== 'string' || encryptedMessage.length === 0 ||
        Buffer.byteLength(encryptedMessage, 'utf8') > MAX_CIPHERTEXT_BYTES) {
        throw new TypeError('encryptedMessage is invalid');
    }
    return crypto.createHash('sha256')
        .update(Buffer.from(encryptedMessage, 'utf8'))
        .digest('base64');
};

module.exports = {
    PROTOCOL_VERSION,
    decodeCanonical32,
    digestProvisioningCiphertext,
    verifyProvisioningProof
};
