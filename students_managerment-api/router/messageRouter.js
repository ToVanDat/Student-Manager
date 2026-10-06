const express = require('express');

const router = express.Router();

const messageController = require('../controller/messageController');

const authMiddleware = require('../middleware/authMiddleware');

// Gửi message
router.post(
    '/',
    authMiddleware,
    messageController.createMessage
);

// Lấy lịch sử message của conversation
router.get(
    '/conversation/:conversationId',
    authMiddleware,
    messageController.getMessagesByConversation
);

// Chỉnh sửa message
router.patch(
    '/:messageId',
    authMiddleware,
    messageController.updateMessage
);

// Thu hồi message
router.post(
    '/:messageId/recall',
    authMiddleware,
    messageController.recallMessage
);

// Xoá message cho riêng user hiện tại
router.delete(
    '/:messageId/me',
    authMiddleware,
    messageController.deleteMessageForMe
);

// Xoá message cho tất cả
router.delete(
    '/:messageId/everyone',
    authMiddleware,
    messageController.deleteMessageForEveryone
);

module.exports = router;
