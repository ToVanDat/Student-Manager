const notificationCenterService = require('../service/notificationCenterService');

const list = async (req, res, next) => {
    try {
        const limit = Number(req.query.limit) || 30;
        const offset = Number(req.query.offset) || 0;
        const userId = Number(req.user.id);
        const [items, unreadCount] = await Promise.all([
            notificationCenterService.listForUser(userId, limit, offset),
            notificationCenterService.getUnreadCount(userId)
        ]);
        res.status(200).json({ data: items, unreadCount, limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0) });
    } catch (error) { next(error); }
};

const markRead = async (req, res, next) => {
    try {
        const id = Number(req.params.notificationId);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'notificationId không hợp lệ' });
        const item = await notificationCenterService.markRead(Number(req.user.id), id);
        if (!item) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
        res.status(200).json({ data: item });
    } catch (error) { next(error); }
};

const markAllRead = async (req, res, next) => {
    try {
        const updated = await notificationCenterService.markAllRead(Number(req.user.id));
        res.status(200).json({ data: { updated } });
    } catch (error) { next(error); }
};

module.exports = { list, markRead, markAllRead };
