const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controller/callController');

const router = express.Router();

router.get('/history', authMiddleware, controller.getCallHistory);
router.delete('/history/:callId', authMiddleware, controller.hideCallHistory);
router.get('/notifications', authMiddleware, controller.getUnreadCallNotifications);
router.patch('/notifications/:notificationId/read', authMiddleware, controller.markCallNotificationRead);

module.exports = router;
