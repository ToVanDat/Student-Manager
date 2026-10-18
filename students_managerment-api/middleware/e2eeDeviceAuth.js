const relayRepository = require('../repository/e2eeRelayRepository');

module.exports = async (req, res, next) => {
    try {
        const userId = Number(req.user?.id);
        const deviceId = Number(req.params?.deviceId ?? req.body?.senderDeviceId);
        const token = req.get('X-E2EE-Device-Token');
        if (!Number.isSafeInteger(userId) || userId <= 0 ||
            !Number.isSafeInteger(deviceId) || deviceId < 1 || deviceId > 5 || !token) {
            return res.status(401).json({ code: 'E2EE_DEVICE_AUTH_REQUIRED', message: 'Cần xác thực thiết bị E2EE.' });
        }
        const device = await relayRepository.authenticateDeviceCredential(userId, deviceId, token);
        if (!device) {
            return res.status(401).json({ code: 'E2EE_DEVICE_AUTH_FAILED', message: 'Thông tin xác thực thiết bị E2EE không hợp lệ hoặc đã bị thu hồi.' });
        }
        req.e2eeDevice = {
            id: Number(device.id),
            userId: Number(device.user_id),
            deviceId: Number(device.device_id),
            registrationId: Number(device.registration_id)
        };
        return next();
    } catch (error) {
        return next(error);
    }
};
