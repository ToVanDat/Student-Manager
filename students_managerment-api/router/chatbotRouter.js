const express = require('express');
const authMiddleware = require('../middleware/authMiddleware.js');
const chatbotController = require('../controller/chatbotController.js');
const chatbotRateLimiter = require('../middleware/chatbotRateLimiter.js');
const requireRole = require('../middleware/roleMiddleware.js');
const uploadAssistantDocument = require('../middleware/assistantDocumentUploadMiddleware.js');
const assistantDocumentController = require('../controller/assistantDocumentController.js');

const router = express.Router();

// Admin-only document knowledge base. The backend enforces role and file limits.
router.get('/documents', authMiddleware, requireRole('admin'), chatbotRateLimiter, assistantDocumentController.listDocuments);
router.post('/documents', authMiddleware, requireRole('admin'), chatbotRateLimiter, uploadAssistantDocument, assistantDocumentController.uploadTextDocument);
router.patch('/documents/:documentId/archive', authMiddleware, requireRole('admin'), chatbotRateLimiter, assistantDocumentController.archiveDocument);
router.patch('/documents/:documentId/restore', authMiddleware, requireRole('admin'), chatbotRateLimiter, assistantDocumentController.restoreDocument);

// AI requests always run under the current authenticated account.
router.post('/chat', authMiddleware, chatbotRateLimiter, chatbotController.chat);
router.post('/chat/stream', authMiddleware, chatbotRateLimiter, chatbotController.chatStream);
router.post('/feedback', authMiddleware, chatbotRateLimiter, chatbotController.rateAnswer);
router.get('/conversations', authMiddleware, chatbotRateLimiter, chatbotController.listConversations);
router.post('/conversations', authMiddleware, chatbotRateLimiter, chatbotController.createConversation);
router.patch('/conversations/:conversationId', authMiddleware, chatbotRateLimiter, chatbotController.renameConversation);
router.delete('/conversations/:conversationId', authMiddleware, chatbotRateLimiter, chatbotController.deleteConversation);
router.get('/history', authMiddleware, chatbotRateLimiter, chatbotController.getHistory);
router.delete('/history', authMiddleware, chatbotRateLimiter, chatbotController.clearHistory);

module.exports = router;
