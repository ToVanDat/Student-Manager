const express = require('express');
const authMiddleware = require('../middleware/authMiddleware.js');
const chatbotController = require('../controller/chatbotController.js');

const router = express.Router();

// AI requests always run under the current authenticated account.
router.post('/chat', authMiddleware, chatbotController.chat);

module.exports = router;
