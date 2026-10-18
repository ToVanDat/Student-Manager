const e2eeRepository = require('../repository/e2eeRepository');
const conversationRepository = require('../repository/conversationRepository');

const isBoundedString = (value, max = 4096) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const registerDevice = async (userId, input) => {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        const error = new Error('User hiện tại không hợp lệ');
        error.statusCode = 401;
        throw error;
    }
    const device = input || {};
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(device.deviceId || '')) {
        const error = new Error('deviceId phải là UUID hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (!isBoundedString(device.identityKeyPublic) ||
        !isBoundedString(device.signedPrekeyPublic) ||
        !isBoundedString(device.signedPrekeySignature)) {
        const error = new Error('Public key hoặc chữ ký signed prekey không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (!Number.isSafeInteger(device.signedPrekeyId) || device.signedPrekeyId < 0 ||
        !Number.isSafeInteger(device.registrationId) || device.registrationId <= 0) {
        const error = new Error('signedPrekeyId hoặc registrationId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    const deviceName = typeof device.deviceName === 'string'
        ? device.deviceName.trim().slice(0, 120) || 'Browser device'
        : 'Browser device';
    const prekeys = device.oneTimePrekeys;
    if (!Array.isArray(prekeys) || prekeys.length > 100) {
        const error = new Error('oneTimePrekeys phải là mảng tối đa 100 khóa');
        error.statusCode = 400;
        throw error;
    }
    const ids = new Set();
    for (const key of prekeys) {
        if (!Number.isSafeInteger(key?.id) || key.id < 0 ||
            !isBoundedString(key?.publicKey) || ids.has(key.id)) {
            const error = new Error('Danh sách one-time prekey không hợp lệ hoặc trùng ID');
            error.statusCode = 400;
            throw error;
        }
        ids.add(key.id);
    }

    return e2eeRepository.registerDevice(userId, {
        ...device,
        deviceName
    }, prekeys);
};

const listDevices = async (requesterId, targetUserId) => {
    if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
        const error = new Error('userId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (requesterId !== targetUserId) {
        const error = new Error('Chỉ được xem danh sách thiết bị của chính mình');
        error.statusCode = 403;
        throw error;
    }
    return e2eeRepository.listDevicesForUser(targetUserId, requesterId);
};

const revokeDevice = async (userId, deviceId) => {
    if (typeof deviceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
        const error = new Error('deviceId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    const device = await e2eeRepository.revokeDevice(userId, deviceId);
    if (!device) {
        const error = new Error('Không tìm thấy thiết bị đang hoạt động');
        error.statusCode = 404;
        throw error;
    }
    return device;
};

const getConversationDeviceBundles = async (requesterId, conversationId) => {
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
        const error = new Error('conversationId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (!await conversationRepository.isConversationMember(conversationId, requesterId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }
    return e2eeRepository.getConversationDeviceBundles(conversationId, requesterId);
};

module.exports = {
    registerDevice,
    listDevices,
    revokeDevice,
    getConversationDeviceBundles
};
