const express = require('express');
const authMiddleware = require('../middleware/authMiddleware.js');
const chatbotController = require('../controller/chatbotController.js');
const chatbotRateLimiter = require('../middleware/chatbotRateLimiter.js');

const router = express.Router();

// AI requests always run under the current authenticated account.
router.post('/chat', authMiddleware, chatbotRateLimiter, chatbotController.chat);
router.post('/chat/stream', authMiddleware, chatbotRateLimiter, chatbotController.chatStream);
router.delete('/history', authMiddleware, chatbotRateLimiter, chatbotController.clearHistory);

module.exports = router;
