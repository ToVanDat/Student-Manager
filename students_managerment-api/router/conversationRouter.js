const express = require('express');
const router = express.Router();

const conversationController = require('../controller/conversationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/direct', conversationController.createDirectConversation);
router.post('/group', conversationController.createGroup);
router.get('/', conversationController.getUserConversations);
router.get('/:conversationId/members', conversationController.getConversationMembers);
router.post('/:conversationId/members', conversationController.addGroupMember);
router.patch('/:conversationId/members/:userId/role', conversationController.updateGroupMemberRole);
router.delete('/:conversationId/members/:userId', conversationController.removeGroupMember);
router.post('/:conversationId/leave', conversationController.leaveGroup);
router.patch('/:id/read', conversationController.markAsRead);

module.exports = router;
