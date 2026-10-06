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

module.exports = router;
