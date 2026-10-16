const express = require('express');
const userController = require('../controller/userController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation');

const router = express.Router();

router.use(authMiddleware);

router.get('/chat-search', userController.searchUsersForChat);
router.get('/', requireRole('admin'), userController.listUsersForAdmin);
router.patch('/:id/access', requireRole('admin'), validateResourceId, validateObjectBody(), userController.updateUserAccess);

module.exports = router;
