const e2eeService = require('../service/e2eeService');

const registerDevice = async (req, res, next) => {
    try {
        const data = await e2eeService.registerDevice(Number(req.user.id), req.body);
        return res.status(201).json({
            message: 'Đã đăng ký thiết bị E2EE',
            data
        });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        return next(error);
    }
};

const listMyDevices = async (req, res, next) => {
    try {
        const data = await e2eeService.listDevices(Number(req.user.id), Number(req.user.id));
        return res.status(200).json({ data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        return next(error);
    }
};

const revokeMyDevice = async (req, res, next) => {
    try {
        const data = await e2eeService.revokeDevice(Number(req.user.id), req.params.deviceId);
        return res.status(200).json({ message: 'Đã thu hồi thiết bị E2EE', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        return next(error);
    }
};

const getConversationDeviceBundles = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const data = await e2eeService.getConversationDeviceBundles(Number(req.user.id), conversationId);
        return res.status(200).json({ data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        return next(error);
    }
};

module.exports = {
    registerDevice,
    listMyDevices,
    revokeMyDevice,
    getConversationDeviceBundles
};
