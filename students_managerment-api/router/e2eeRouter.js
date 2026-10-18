const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Public-key discovery is cheap; prekey claims mutate one-time key inventory.
// Limit claim attempts so a single client cannot trivially drain a device's keys.
const prekeyClaimLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu lấy prekey; vui lòng thử lại sau.' }
});
const authMiddleware = require('../middleware/authMiddleware');
const e2eeController = require('../controller/e2eeController');

router.use(authMiddleware);

router.post('/devices', e2eeController.registerDevice);
router.get('/devices', e2eeController.listMyDevices);
router.delete('/devices/:deviceId', e2eeController.revokeMyDevice);
router.get('/conversations/:conversationId/device-bundles', e2eeController.getConversationDeviceBundles);
router.post('/conversations/:conversationId/users/:userId/devices/:deviceId/claim-prekey', prekeyClaimLimiter, e2eeController.claimConversationDevicePrekey);

module.exports = router;
