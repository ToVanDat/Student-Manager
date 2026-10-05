const express = require('express');
const router = express.Router();

const conversationController = require('../controller/conversationController');
const authMiddleware = require('../middleware/authMiddleware');

// Áp dụng middleware xác thực cho toàn bộ route bên dưới
router.use(authMiddleware);

// Tạo hoặc lấy conversation 1-1
router.post('/direct', conversationController.createDirectConversation);

// Lấy danh sách conversation của user hiện tại
router.get('/', conversationController.getUserConversations);

// Lấy members của conversation
router.get('/:conversationId/members', conversationController.getConversationMembers);

// Đánh dấu đã đọc tất cả tin nhắn trong conversation
router.patch('/:id/read', conversationController.markAsRead);

module.exports = router;