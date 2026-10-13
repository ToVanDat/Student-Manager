const webPushService = require('../service/webPushService');

const getPublicKey = (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        return res.status(503).json({ message: 'Web Push chưa được cấu hình trên máy chủ' });
    }
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

const getPreferences = async (req, res, next) => {
    try {
        const data = await webPushService.getAccountPreferences(Number(req.user.id));
        return res.status(200).json({ data });
    } catch (error) {
        next(error);
    }
};

const updatePreferences = async (req, res, next) => {
    try {
        const data = await webPushService.updateAccountPreferences(
            Number(req.user.id),
            req.body
        );
        return res.status(200).json({ message: 'Đã lưu cài đặt thông báo', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const getConversationPreference = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const data = await webPushService.getConversationPreference(
            conversationId,
            Number(req.user.id)
        );
        return res.status(200).json({ data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const updateConversationPreference = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const data = await webPushService.updateConversationPreference(
            conversationId,
            Number(req.user.id),
            req.body?.enabled
        );
        return res.status(200).json({ message: 'Đã cập nhật thông báo cuộc trò chuyện', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const subscribe = async (req, res, next) => {
    try {
        const data = await webPushService.saveSubscription(
            Number(req.user.id),
            req.body?.subscription,
            req.get('user-agent')
        );
        return res.status(201).json({ message: 'Đã bật Web Push', data: { id: data.id } });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const unsubscribe = async (req, res, next) => {
    try {
        const endpoint = req.body?.endpoint;
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
            return res.status(400).json({ message: 'Endpoint không hợp lệ' });
        }
        await webPushService.removeSubscription(Number(req.user.id), endpoint);
        return res.status(204).end();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPublicKey,
    getPreferences,
    updatePreferences,
    getConversationPreference,
    updateConversationPreference,
    subscribe,
    unsubscribe
};
