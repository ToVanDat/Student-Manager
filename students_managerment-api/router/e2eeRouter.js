const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const e2eeController = require('../controller/e2eeController');

router.use(authMiddleware);

router.post('/devices', e2eeController.registerDevice);
router.get('/devices', e2eeController.listMyDevices);
router.delete('/devices/:deviceId', e2eeController.revokeMyDevice);
router.get('/conversations/:conversationId/device-bundles', e2eeController.getConversationDeviceBundles);
router.post('/conversations/:conversationId/users/:userId/devices/:deviceId/claim-prekey', e2eeController.claimConversationDevicePrekey);

module.exports = router;
