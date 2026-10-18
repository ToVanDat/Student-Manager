const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controller/e2eeRelayController');
const deviceAuth = require('../middleware/e2eeDeviceAuth');

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
router.post('/provisioning', keyMutationLimiter, controller.createProvisioningSession);
router.post('/provisioning/:sessionId/connect', keyMutationLimiter, controller.connectNewDevice);
router.post('/provisioning/:sessionId/message', keyMutationLimiter, controller.sendProvisioningMessage);
router.get('/provisioning/:sessionId/message', controller.getProvisioningMessage);
router.post('/provisioning/:sessionId/complete', keyMutationLimiter, controller.completeProvisioning);
router.post('/provisioning/:sessionId/ack', keyMutationLimiter, controller.acknowledgeProvisioning);
router.post('/provisioning/:sessionId/rollback', keyMutationLimiter, controller.rollbackProvisioning);
router.delete('/provisioning/:sessionId', keyMutationLimiter, controller.deleteProvisioningSession);
router.get('/users/:userId/devices', controller.getDevices);
router.get('/users/:userId/identity', controller.getIdentityKey);
router.get('/users/:userId/active-devices', controller.getActiveDevices);
router.delete('/devices/:deviceId', keyMutationLimiter, controller.removeDevice);
router.put('/devices/:deviceId/identity', deviceAuth, keyMutationLimiter, controller.provisionIdentity);
router.put('/devices/:deviceId/identity/rotate', deviceAuth, keyMutationLimiter, controller.rotateIdentityKey);
router.put('/devices/:deviceId/prekeys', deviceAuth, keyMutationLimiter, controller.uploadPreKeys);
router.get('/devices/:deviceId/prekeys/count/:type', deviceAuth, controller.getPreKeyCount);
router.get('/devices/:deviceId/prekeys/inventory', deviceAuth, controller.getPreKeyInventory);
router.delete('/devices/:deviceId/prekeys/kem-stale', deviceAuth, keyMutationLimiter, controller.clearStaleKemPreKeys);
router.get('/users/:userId/devices/:deviceId/prekey-bundle', keyMutationLimiter, controller.fetchPreKeyBundle);

router.get('/conversations/:conversationId/status', controller.getConversationStatus);
router.post('/conversations/:conversationId/enable', keyMutationLimiter, controller.enableConversation);
router.post('/conversations/:conversationId/envelopes', deviceAuth, relaySendLimiter, controller.sendEnvelope);
router.post('/users/:userId/envelopes', deviceAuth, relaySendLimiter, controller.sendDirectEnvelope);
router.get('/devices/:deviceId/mailbox', deviceAuth, controller.pullEnvelopes);
router.post('/devices/:deviceId/envelopes/:envelopeId/ack', deviceAuth, controller.markDelivered);

module.exports = router;
