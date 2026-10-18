const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controller/e2eeRelayController');

const relaySendLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu gửi E2EE; vui lòng thử lại sau.' }
});
const keyMutationLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu quản lý khóa; vui lòng thử lại sau.' }
});

router.use(authMiddleware);

// SDK numeric device slots are a separate contract from the legacy UUID registry.
router.post('/devices', keyMutationLimiter, controller.registerDevice);
router.get('/users/:userId/devices', controller.getDevices);
router.get('/users/:userId/identity', controller.getIdentityKey);
router.get('/users/:userId/active-devices', controller.getActiveDevices);
router.delete('/devices/:deviceId', keyMutationLimiter, controller.removeDevice);
router.put('/devices/:deviceId/identity', keyMutationLimiter, controller.provisionIdentity);
router.put('/devices/:deviceId/prekeys', keyMutationLimiter, controller.uploadPreKeys);
router.get('/devices/:deviceId/prekeys/count/:type', controller.getPreKeyCount);
router.get('/devices/:deviceId/prekeys/inventory', controller.getPreKeyInventory);
router.delete('/devices/:deviceId/prekeys/kem-stale', keyMutationLimiter, controller.clearStaleKemPreKeys);
router.get('/users/:userId/devices/:deviceId/prekey-bundle', keyMutationLimiter, controller.fetchPreKeyBundle);

router.post('/conversations/:conversationId/envelopes', relaySendLimiter, controller.sendEnvelope);
router.post('/users/:userId/envelopes', relaySendLimiter, controller.sendDirectEnvelope);
router.get('/devices/:deviceId/mailbox', controller.pullEnvelopes);
router.post('/devices/:deviceId/envelopes/:envelopeId/ack', controller.markDelivered);

module.exports = router;
