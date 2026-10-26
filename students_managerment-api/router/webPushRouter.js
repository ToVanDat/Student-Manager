const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controller/webPushController');
const notificationCenterController = require('../controller/notificationCenterController');

const router = express.Router();
router.use(authMiddleware);

router.get('/vapid-public-key', controller.getPublicKey);
router.get('/history', notificationCenterController.list);
router.patch('/history/read-all', notificationCenterController.markAllRead);
router.patch('/history/:notificationId/read', notificationCenterController.markRead);
router.delete('/history/:notificationId', notificationCenterController.deleteNotification);
router.get('/preferences', controller.getPreferences);
router.patch('/preferences', controller.updatePreferences);
router.get('/conversations/:conversationId', controller.getConversationPreference);
router.put('/conversations/:conversationId', controller.updateConversationPreference);
router.post('/subscriptions', controller.subscribe);
router.delete('/subscriptions', controller.unsubscribe);

module.exports = router;
