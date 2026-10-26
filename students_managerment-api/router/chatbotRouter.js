const express = require('express');
const authMiddleware = require('../middleware/authMiddleware.js');
const chatbotController = require('../controller/chatbotController.js');
const chatbotRateLimiter = require('../middleware/chatbotRateLimiter.js');

const router = express.Router();

// AI requests always run under the current authenticated account.
router.post('/chat', authMiddleware, chatbotRateLimiter, chatbotController.chat);
router.post('/chat/stream', authMiddleware, chatbotRateLimiter, chatbotController.chatStream);
router.get('/conversations', authMiddleware, chatbotRateLimiter, chatbotController.listConversations);
router.post('/conversations', authMiddleware, chatbotRateLimiter, chatbotController.createConversation);
router.patch('/conversations/:conversationId', authMiddleware, chatbotRateLimiter, chatbotController.renameConversation);
router.delete('/conversations/:conversationId', authMiddleware, chatbotRateLimiter, chatbotController.deleteConversation);
router.get('/history', authMiddleware, chatbotRateLimiter, chatbotController.getHistory);
router.delete('/history', authMiddleware, chatbotRateLimiter, chatbotController.clearHistory);

module.exports = router;
