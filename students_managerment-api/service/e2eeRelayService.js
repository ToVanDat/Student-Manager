const crypto = require('crypto');
const relayRepository = require('../repository/e2eeRelayRepository');
const conversationRepository = require('../repository/conversationRepository');

const fail = (statusCode, message, code) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
};

const integer = (value, name, min = 1, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw fail(400, `${name} không hợp lệ`);
    return n;
};

const registerDevice = async (userId, input = {}) => {
    const registrationId = input.registrationId == null
        ? crypto.randomInt(1, 65536)
        : integer(input.registrationId, 'registrationId', 1, 65535);
    const deviceId = input.deviceId == null ? undefined : integer(input.deviceId, 'deviceId', 1, 5);
    const deviceType = input.deviceType || 'web';
    if (!['web', 'desktop', 'mobile', 'tablet'].includes(deviceType)) throw fail(400, 'deviceType không hợp lệ');
    if (input.encryptedDeviceName != null &&
        (typeof input.encryptedDeviceName !== 'string' || input.encryptedDeviceName.length > 2048)) {
        throw fail(400, 'encryptedDeviceName không hợp lệ');
    }
    return relayRepository.registerDevice(userId, { deviceId, registrationId, deviceType, encryptedDeviceName: input.encryptedDeviceName });
};

const assertDeviceInventoryAccess = async (requesterId, targetUserId) => {
    integer(requesterId, 'requesterId');
    integer(targetUserId, 'userId');
    if (Number(requesterId) === Number(targetUserId)) return;
    const conversation = await conversationRepository.findDirectConversation(requesterId, targetUserId);
    if (!conversation) throw fail(404, 'Không tìm thấy conversation 1-1 với người dùng này');
};

const getDevices = async (requesterId, targetUserId) => {
    await assertDeviceInventoryAccess(requesterId, targetUserId);
    return relayRepository.getDevices(targetUserId);
};

const getActiveDevices = async (requesterId, targetUserId) => {
    await assertDeviceInventoryAccess(requesterId, targetUserId);
    return relayRepository.getActiveDevices(targetUserId);
};
const removeDevice = (userId, deviceId) => relayRepository.removeDevice(userId, integer(deviceId, 'deviceId', 1, 5));

const provisionIdentity = async (userId, deviceId, body = {}) => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    if (!body.identity || typeof body.identity !== 'object' || Array.isArray(body.identity)) {
        throw fail(400, 'identity phải là object CompositeIdentityV1 hợp lệ');
    }
    const registrationId = integer(body.registrationId, 'registrationId', 1, 2147483647);
    const identityType = body.identityType || 'aci';
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    return relayRepository.provisionIdentity(userId, slot, body.identity, registrationId, identityType);
};

const rotateIdentityKey = async (userId, deviceId, body = {}) => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    const registrationId = integer(body.registrationId, 'registrationId', 1, 65535);
    const identityType = body.identityType || 'aci';
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    if (!body.identity || typeof body.identity !== 'object' || Array.isArray(body.identity)) throw fail(400, 'identity không hợp lệ');
    assertBase64(body.expectedCurrentCommitment, 'expectedCurrentCommitment', 44);
    if (Buffer.from(body.expectedCurrentCommitment, 'base64').length !== 32) throw fail(400, 'expectedCurrentCommitment phải dài 32 byte');
    return relayRepository.rotateIdentityKey(userId, slot, body.identity, registrationId, body.expectedCurrentCommitment, identityType);
};
const uploadPreKeys = async (userId, deviceId, body = {}) => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    const identityType = body.identityType || 'aci';
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    if (!Array.isArray(body.keys) || body.keys.length > 500) throw fail(400, 'keys phải là mảng tối đa 500 khóa');
    const allowed = new Set(['ecPreKey', 'ecSignedPreKey', 'kemOneTimePreKey', 'kemLastResortPreKey']);
    const ids = new Set();
    for (const key of body.keys) {
        const identity = `${key?.type}:${key?.keyId}`;
        if (!allowed.has(key?.type) || !Number.isSafeInteger(key?.keyId) || key.keyId < 0 ||
            typeof key?.publicKey !== 'string' || !key.publicKey.trim() || key.publicKey.length > 16384 ||
            (key.signature != null && (typeof key.signature !== 'string' || key.signature.length > 16384)) ||
            ids.has(identity)) throw fail(400, 'Prekey không hợp lệ hoặc trùng ID/type');
        const decodedPublicKey = Buffer.from(key.publicKey, 'base64');
        // OpenE2EE SDK encodes ML-KEM-1024 public keys as 0x0A || 1568 raw bytes.
        // The algorithm tag is part of the wire key, so the encoded public key is 1569 bytes.
        const expectedPublicLength = key.type.startsWith('ec') ? 32 : 1569;
        if (decodedPublicKey.length !== expectedPublicLength || decodedPublicKey.toString('base64') !== key.publicKey) {
            throw fail(400, 'Độ dài hoặc encoding public prekey không hợp lệ');
        }
        if (!key.type.startsWith('ec') && decodedPublicKey[0] !== 0x0A) {
            throw fail(400, 'ML-KEM public prekey phải có algorithm tag 0x0A');
        }
        if (['ecSignedPreKey', 'kemOneTimePreKey', 'kemLastResortPreKey'].includes(key.type)) {
            const signature = Buffer.from(key.signature || '', 'base64');
            if (!key.signature || signature.length !== 64 || signature.toString('base64') !== key.signature) {
                throw fail(400, 'Prekey đã ký cần signature Ed25519 hợp lệ');
            }
        }
        ids.add(identity);
    }
    await relayRepository.uploadPreKeys(userId, slot, body.keys, identityType);
    return { uploaded: body.keys.length };
};

const fetchPreKeyBundle = async (requesterId, targetUserId, targetDeviceId, identityType = 'aci') => {
    integer(requesterId, 'requesterId');
    integer(targetUserId, 'userId');
    integer(targetDeviceId, 'deviceId', 1, 5);
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');

    // Fetching a bundle claims one-time prekeys. Require an established direct
    // conversation before allowing another account to consume this device's keys.
    // A user's own linked devices remain discoverable for multi-device sessions.
    if (Number(requesterId) !== Number(targetUserId)) {
        const conversation = await conversationRepository.findDirectConversation(requesterId, targetUserId);
        if (!conversation) throw fail(404, 'Không tìm thấy conversation 1-1 với người dùng này');
    }

    return relayRepository.fetchPreKeyBundle(targetUserId, targetDeviceId, identityType);
};

const getPreKeyCount = async (userId, deviceId, type, identityType = 'aci') => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    if (!['ec', 'kem'].includes(type)) throw fail(400, 'type phải là ec hoặc kem');
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    return relayRepository.getPreKeyCount(userId, slot, type, identityType);
};

const clearStaleKemPreKeys = async (userId, deviceId, identityType = 'aci') => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    return relayRepository.clearStaleKemPreKeys(userId, slot, identityType);
};

const getPreKeyInventory = async (userId, deviceId, identityType = 'aci') => {
    const slot = integer(deviceId, 'deviceId', 1, 5);
    if (!['aci', 'pni'].includes(identityType)) throw fail(400, 'identityType không hợp lệ');
    return relayRepository.getPreKeyInventory(userId, slot, identityType);
};

const getConversationE2EEStatus = async (requesterId, conversationId) =>
    relayRepository.getConversationE2EEStatus(requesterId, integer(conversationId, 'conversationId'));

const enableConversationE2EE = async (requesterId, conversationId) =>
    relayRepository.enableConversationE2EE(requesterId, integer(conversationId, 'conversationId'));

const pauseConversationE2EE = async (requesterId, conversationId) =>
    relayRepository.pauseConversationE2EE(requesterId, integer(conversationId, 'conversationId'));
const assertSessionId = value => {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw fail(400, 'sessionId không hợp lệ');
    }
    return value;
};

const assertBase64 = (value, name, max = 16384) => {
    if (typeof value !== 'string' || !value || value.length > max ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
        throw fail(400, `${name} phải là base64 hợp lệ`);
    }
    return value;
};

const createProvisioningSession = async (userId, body = {}) =>
    relayRepository.createProvisioningSession(userId, assertBase64(body.ephemeralPublicKey, 'ephemeralPublicKey'));

const connectNewDevice = async (userId, sessionId, body = {}) => {
    assertSessionId(sessionId);
    const ephemeralPublicKey = assertBase64(body.ephemeralPublicKey, 'ephemeralPublicKey');
    const metadata = body.deviceMetadata && typeof body.deviceMetadata === 'object' && !Array.isArray(body.deviceMetadata)
        ? body.deviceMetadata : {};
    return relayRepository.connectNewDevice(userId, sessionId, ephemeralPublicKey, metadata);
};

const sendProvisioningMessage = async (userId, sessionId, body = {}) => {
    assertSessionId(sessionId);
    if (typeof body.encryptedMessage !== 'string' || !body.encryptedMessage || body.encryptedMessage.length > 700_000) {
        throw fail(400, 'encryptedMessage không hợp lệ');
    }
    return relayRepository.sendProvisioningMessage(userId, sessionId, body.encryptedMessage);
};

const getProvisioningMessage = async (userId, sessionId) => {
    assertSessionId(sessionId);
    return relayRepository.getProvisioningMessage(userId, sessionId);
};

const completeProvisioning = async (userId, sessionId, body = {}) => {
    assertSessionId(sessionId);
    if (body.encryptedDeviceName != null && (typeof body.encryptedDeviceName !== 'string' || body.encryptedDeviceName.length > 2048)) {
        throw fail(400, 'encryptedDeviceName không hợp lệ');
    }
    const metadata = body.deviceMetadata && typeof body.deviceMetadata === 'object' && !Array.isArray(body.deviceMetadata)
        ? body.deviceMetadata : {};
    if (metadata.deviceType != null && !['web', 'desktop', 'mobile', 'tablet'].includes(metadata.deviceType)) {
        throw fail(400, 'deviceType không hợp lệ');
    }
    return relayRepository.completeProvisioning(userId, sessionId, body.encryptedDeviceName || null, metadata);
};

const acknowledgeProvisioning = async (userId, sessionId, deviceToken) => {
    assertSessionId(sessionId);
    if (typeof deviceToken !== 'string' || deviceToken.length < 32 || deviceToken.length > 256) {
        throw fail(401, 'Cần xác thực thiết bị E2EE mới');
    }
    const result = await relayRepository.acknowledgeProvisioning(userId, sessionId, deviceToken);
    if (result?.expiredOrUnavailable) {
        throw fail(409, 'Không thể xác nhận phiên liên kết thiết bị');
    }
    return result;
};

const rollbackProvisioning = async (userId, sessionId) => {
    assertSessionId(sessionId);
    return relayRepository.rollbackProvisioning(userId, sessionId);
};

const deleteProvisioningSession = async (userId, sessionId) => {
    assertSessionId(sessionId);
    return relayRepository.deleteProvisioningSession(userId, sessionId);
};
const sendEnvelope = async (senderUserId, conversationId, body = {}) => {
    const conversation = integer(conversationId, 'conversationId');
    const targetUserId = integer(body.targetUserId, 'targetUserId');
    const targetDeviceId = integer(body.targetDeviceId, 'targetDeviceId', 1, 5);
    const senderDeviceId = integer(body.senderDeviceId, 'senderDeviceId', 1, 5);
    if (typeof body.ciphertext !== 'string' || !body.ciphertext || body.ciphertext.length > 700_000) {
        throw fail(400, 'ciphertext phải là chuỗi base64 không rỗng, tối đa 700 KB');
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.ciphertext)) {
        throw fail(400, 'ciphertext không phải base64 hợp lệ');
    }
    if (!['ciphertext', 'prekey_bundle', 'sender_key', 'unidentified_sender', 'retry_request'].includes(body.messageType)) {
        throw fail(400, 'messageType không hợp lệ');
    }
    if (!['user-visible', 'background-sync', 'ephemeral'].includes(body.deliveryClass)) {
        throw fail(400, 'deliveryClass không hợp lệ');
    }
    if (body.contentKind != null && !['message', 'receipt'].includes(body.contentKind)) throw fail(400, 'contentKind không hợp lệ');
    if (!Number.isSafeInteger(body.timestamp) || body.timestamp <= 0) throw fail(400, 'timestamp không hợp lệ');
    if (typeof body.clientMessageId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientMessageId)) {
        throw fail(400, 'clientMessageId phải là UUID để hỗ trợ retry idempotent');
    }
    if (body.operationEpochMilliseconds != null && (!Number.isSafeInteger(body.operationEpochMilliseconds) || body.operationEpochMilliseconds <= 0)) {
        throw fail(400, 'operationEpochMilliseconds không hợp lệ');
    }
    if (body.recipientRegistrationId != null) integer(body.recipientRegistrationId, 'recipientRegistrationId', 1, 2147483647);
    return relayRepository.sendEnvelope(senderUserId, conversation, {
        ...body, targetUserId, targetDeviceId, senderDeviceId
    });
};

const sendDirectEnvelope = async (senderUserId, targetUserId, body = {}) => {
    const target = integer(targetUserId, 'targetUserId');
    if (Number(body.targetUserId) !== target) throw fail(400, 'targetUserId trong URL và body không khớp');
    const conversation = await conversationRepository.findDirectConversation(senderUserId, target);
    if (!conversation) throw fail(404, 'Không tìm thấy conversation 1-1 với người nhận');
    return sendEnvelope(senderUserId, conversation.id, body);
};

const pullEnvelopes = async (userId, deviceId, limit) =>
    relayRepository.pullEnvelopes(userId, integer(deviceId, 'deviceId', 1, 5), limit);

const markDelivered = async (userId, deviceId, envelopeId) => {
    if (typeof envelopeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(envelopeId)) throw fail(400, 'envelopeId không hợp lệ');
    return relayRepository.markDelivered(userId, integer(deviceId, 'deviceId', 1, 5), envelopeId);
};

module.exports = {
    registerDevice, getDevices, getActiveDevices, removeDevice, provisionIdentity, rotateIdentityKey,
    createProvisioningSession, connectNewDevice, sendProvisioningMessage, getProvisioningMessage,
    completeProvisioning, acknowledgeProvisioning, rollbackProvisioning, deleteProvisioningSession, uploadPreKeys,
    fetchPreKeyBundle, getPreKeyCount, getPreKeyInventory, clearStaleKemPreKeys, getConversationE2EEStatus, pauseConversationE2EE, enableConversationE2EE, sendEnvelope, sendDirectEnvelope,
    pullEnvelopes, markDelivered
};
