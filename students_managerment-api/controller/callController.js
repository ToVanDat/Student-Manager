const callRepository = require('../repository/callRepository');

const getCallHistory = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
        const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
        const conversationId = req.query.conversationId
            ? Number.parseInt(req.query.conversationId, 10)
            : null;
        if (conversationId !== null && (!Number.isInteger(conversationId) || conversationId <= 0)) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const data = await callRepository.getCallHistory(userId, limit, offset, conversationId);
        return res.json({ data });
    } catch (error) {
        console.error('GET CALL HISTORY ERROR:', error);
        return res.status(500).json({ message: 'Không thể lấy lịch sử cuộc gọi' });
    }
};

const hideCallHistory = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const callId = String(req.params.callId || '').trim();
        if (!callId || callId.length > 128) {
            return res.status(400).json({ message: 'callId không hợp lệ' });
        }

        const hidden = await callRepository.hideCallHistoryForUser(userId, callId);
        if (!hidden) {
            return res.status(404).json({ message: 'Cuộc gọi không tồn tại hoặc bạn không có quyền ẩn' });
        }

        return res.json({ message: 'Đã xóa cuộc gọi khỏi lịch sử của bạn' });
    } catch (error) {
        console.error('HIDE CALL HISTORY ERROR:', error);
        return res.status(500).json({ message: 'Không thể xóa cuộc gọi khỏi lịch sử' });
    }
};

const getUnreadCallNotifications = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const [data, unreadCount] = await Promise.all([
            callRepository.getCallNotifications(userId),
            callRepository.getUnreadCallNotificationCount(userId)
        ]);
        return res.json({ data, unreadCount });
    } catch (error) {
        console.error('GET CALL NOTIFICATIONS ERROR:', error);
        return res.status(500).json({ message: 'Không thể lấy thông báo cuộc gọi' });
    }
};

const markCallNotificationRead = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const notificationId = Number(req.params.notificationId);
        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({ message: 'notificationId không hợp lệ' });
        }
        const data = await callRepository.markCallNotificationRead(notificationId, userId);
        if (!data) return res.status(404).json({ message: 'Thông báo không tồn tại' });
        return res.json({ data });
    } catch (error) {
        console.error('READ CALL NOTIFICATION ERROR:', error);
        return res.status(500).json({ message: 'Không thể cập nhật thông báo cuộc gọi' });
    }
};

module.exports = {
    getCallHistory,
    hideCallHistory,
    getUnreadCallNotifications,
    markCallNotificationRead
};
