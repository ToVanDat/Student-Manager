const express = require('express');
const router = express.Router();

const conversationController = require('../controller/conversationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/direct', conversationController.createDirectConversation);
router.post('/group', conversationController.createGroup);
router.patch('/:conversationId', conversationController.updateGroup);
router.patch('/:conversationId/settings', conversationController.updateConversationSettings);
router.post('/:conversationId/block', conversationController.blockUser);
router.post('/:conversationId/unblock', conversationController.unblockUser);
router.post('/:conversationId/report', conversationController.reportConversation);
router.get('/', conversationController.getUserConversations);
router.get('/:conversationId/members', conversationController.getConversationMembers);
router.post('/:conversationId/members', conversationController.addGroupMember);
router.patch('/:conversationId/members/:userId/role', conversationController.updateGroupMemberRole);
router.delete('/:conversationId/members/:userId', conversationController.removeGroupMember);
router.post('/:conversationId/leave', conversationController.leaveGroup);
router.patch('/:id/read', conversationController.markAsRead);

module.exports = router;
