const crypto = require('node:crypto');

const TRANSCRIPT_DOMAIN = Buffer.from('StudentManager/E2EE/ProvisioningTranscript/v1', 'ascii');
const SALT_DOMAIN = Buffer.from('StudentManager/E2EE/ProvisioningSalt/v1', 'ascii');
const INFO_DOMAIN = Buffer.from('StudentManager/E2EE/ProvisioningProof/v1', 'ascii');
const PROTOCOL_VERSION = 1;
const PROOF_BYTES = 32;
const MAX_SESSION_ID_BYTES = 1024;
const MAX_CIPHERTEXT_BYTES = 700_000;

const decodeCanonical32 = (value, name) => {
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

const encodeLengthPrefixed = value => {
    const bytes = Buffer.from(value, 'utf8');
    if (bytes.length > MAX_SESSION_ID_BYTES) throw new TypeError('sessionId is too long');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length, 0);
    return Buffer.concat([length, bytes]);
};

const buildProvisioningTranscript = ({
    sessionId,
    challenge,
    ownerEphemeralPublicKey,
    newDeviceEphemeralPublicKey,
    encryptedMessage
}) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new TypeError('sessionId is required');
    }
    if (typeof encryptedMessage !== 'string' || encryptedMessage.length === 0 ||
        Buffer.byteLength(encryptedMessage, 'utf8') > MAX_CIPHERTEXT_BYTES) {
        throw new TypeError('encryptedMessage is invalid');
    }

    const challengeBytes = decodeCanonical32(challenge, 'challenge');
    const ownerPublicKey = decodeCanonical32(ownerEphemeralPublicKey, 'ownerEphemeralPublicKey');
    const newDevicePublicKey = decodeCanonical32(newDeviceEphemeralPublicKey, 'newDeviceEphemeralPublicKey');
    const ciphertextDigest = crypto.createHash('sha256')
        .update(Buffer.from(encryptedMessage, 'utf8'))
        .digest();

    return Buffer.concat([
        TRANSCRIPT_DOMAIN,
        Buffer.from([PROTOCOL_VERSION]),
        encodeLengthPrefixed(sessionId),
        challengeBytes,
        ownerPublicKey,
        newDevicePublicKey,
        ciphertextDigest
    ]);
};

const deriveProvisioningProof = ({ sharedSecret, ...transcriptInput }) => {
    if (!Buffer.isBuffer(sharedSecret) || sharedSecret.length !== PROOF_BYTES) {
        throw new TypeError('sharedSecret must be a 32-byte Buffer');
    }
    const challenge = decodeCanonical32(transcriptInput.challenge, 'challenge');
    const sessionIdBytes = Buffer.from(transcriptInput.sessionId || '', 'utf8');
    if (sessionIdBytes.length === 0 || sessionIdBytes.length > MAX_SESSION_ID_BYTES) {
        throw new TypeError('sessionId is invalid');
    }

    const salt = crypto.createHash('sha256')
        .update(Buffer.concat([SALT_DOMAIN, challenge, sessionIdBytes]))
        .digest();
    const proofKey = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, INFO_DOMAIN, PROOF_BYTES));
    try {
        const transcript = buildProvisioningTranscript(transcriptInput);
        return crypto.createHmac('sha256', proofKey).update(transcript).digest();
    } finally {
        proofKey.fill(0);
        salt.fill(0);
    }
};

const verifyProvisioningProof = ({ commitment, proof, ...input }) => {
    const expectedCommitment = decodeCanonical32(commitment, 'commitment');
    const suppliedProof = decodeCanonical32(proof, 'proof');
    const expectedProof = deriveProvisioningProof(input);
    try {
        return crypto.timingSafeEqual(expectedCommitment, expectedProof) &&
            crypto.timingSafeEqual(expectedProof, suppliedProof);
    } finally {
        expectedCommitment.fill(0);
        suppliedProof.fill(0);
        expectedProof.fill(0);
    }
};

module.exports = {
    PROTOCOL_VERSION,
    buildProvisioningTranscript,
    deriveProvisioningProof,
    verifyProvisioningProof
};
