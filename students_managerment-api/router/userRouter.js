const express = require('express');
const userController = require('../controller/userController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation');

const router = express.Router();

router.use(authMiddleware);

router.get('/chat-search', userController.searchUsersForChat);
router.get('/', requireRole('admin'), requirePermission('accounts.manage'), userController.listUsersForAdmin);
router.patch('/:id/access', requireRole('admin'), requirePermission('accounts.manage'), validateResourceId, validateObjectBody(), userController.updateUserAccess);

module.exports = router;
