const callRepository = require('../repository/callRepository');

const getCallHistory = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
        const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
        const data = await callRepository.getCallHistory(userId, limit, offset);
        return res.json({ data });
    } catch (error) {
        console.error('GET CALL HISTORY ERROR:', error);
        return res.status(500).json({ message: 'Không thể lấy lịch sử cuộc gọi' });
    }
};

const getUnreadCallNotifications = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const data = await callRepository.getUnreadCallNotifications(userId);
        return res.json({ data });
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
    getUnreadCallNotifications,
    markCallNotificationRead
};
