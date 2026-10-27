const e2eeRelayService = require('../service/e2eeRelayService');
const { getIO } = require('../src/socket/socket');
const notificationDeliveryService = require('../service/notificationDeliveryService');
const e2eeAttachmentService = require('../service/e2eeAttachmentService');

const notifyE2EERecipient = async (data, senderId) => {
    if (!data?.notifyRecipient) return;
    try {
        // Never pass decrypted content, filename, or attachment metadata into
        // notification center / Web Push for E2EE messages.
        await notificationDeliveryService.notifyMessageRecipients({
            io: getIO(),
            conversationId: Number(data.conversationId),
            senderId: Number(senderId),
            senderName: 'Người gửi',
            message: { id: null, content: '' }
        });
    } catch (error) {
        // The ciphertext mailbox is already durable. Notification delivery is
        // best-effort and must not turn a successful encrypted send into failure.
        console.warn('[E2EE][relay] generic notification unavailable', {
            code: error?.code || 'E2EE_NOTIFICATION_FAILED'
        });
    }
};

const run = (handler) => async (req, res, next) => {
    try {
        const data = await handler(req);
        return res.status(200).json({ data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({
            message: error.message,
            ...(error.code ? { code: error.code } : {})
        });
        return next(error);
    }
};

const createAttachmentUploadTicket = run(req => e2eeAttachmentService.createUploadTicket(
    Number(req.user.id), req.params.conversationId, req.body
));
const completeAttachmentUpload = run(req => e2eeAttachmentService.completeUpload(
    Number(req.user.id), req.params.attachmentId
));
const createAttachmentDownloadTicket = run(req => e2eeAttachmentService.createDownloadTicket(
    Number(req.user.id), req.params.attachmentId, req.body?.readCapability
));
const reconcileAttachmentUpload = run(req => e2eeAttachmentService.reconcileUpload(
    Number(req.user.id), req.params.attachmentId
));
const deleteAttachmentObject = run(req => e2eeAttachmentService.deleteObject(
    Number(req.user.id), req.params.attachmentId
));
const abandonAttachmentUpload = run(req => e2eeAttachmentService.abandonUpload(
    Number(req.user.id), req.body
));
const resolveAttachmentUploadConversation = run(req => e2eeAttachmentService.resolveUploadConversation(
    Number(req.user.id), req.body
));

module.exports = {
    createAttachmentUploadTicket,
    completeAttachmentUpload,
    createAttachmentDownloadTicket,
    reconcileAttachmentUpload,
    deleteAttachmentObject,
    abandonAttachmentUpload,
    resolveAttachmentUploadConversation,
    registerDevice: run(req => e2eeRelayService.registerDevice(Number(req.user.id), req.body)),
    getDevices: run(req => e2eeRelayService.getDevices(Number(req.user.id), Number(req.params.userId))),
    getIdentityKey: run(async req => {
        const userId = Number(req.params.userId);
        const identityType = req.query.identityType || 'aci';
        if (!Number.isSafeInteger(userId) || userId <= 0 || !['aci', 'pni'].includes(identityType)) {
            const error = new Error('userId hoặc identityType không hợp lệ');
            error.statusCode = 400;
            throw error;
        }
        return require('../repository/e2eeRelayRepository').getIdentityKey(userId, identityType);
    }),
    getActiveDevices: run(req => e2eeRelayService.getActiveDevices(
        Number(req.user.id), Number(req.params.userId)
    )),
    clearStaleKemPreKeys: run(req => e2eeRelayService.clearStaleKemPreKeys(
        Number(req.user.id), req.params.deviceId, req.query.identityType || 'aci'
    )),
    removeDevice: run(req => e2eeRelayService.removeDevice(Number(req.user.id), req.params.deviceId)),
    provisionIdentity: run(req => e2eeRelayService.provisionIdentity(
        Number(req.user.id), req.params.deviceId, req.body
    )),
    rotateIdentityKey: run(req => e2eeRelayService.rotateIdentityKey(Number(req.user.id), req.params.deviceId, req.body)),
    uploadPreKeys: run(req => e2eeRelayService.uploadPreKeys(
        Number(req.user.id), req.params.deviceId, req.body
    )),
    getPreKeyCount: run(req => e2eeRelayService.getPreKeyCount(
        Number(req.user.id), req.params.deviceId, req.params.type, req.query.identityType || 'aci'
    )),
    getPreKeyInventory: run(req => e2eeRelayService.getPreKeyInventory(
        Number(req.user.id), req.params.deviceId, req.query.identityType || 'aci'
    )),
    fetchPreKeyBundle: run(req => e2eeRelayService.fetchPreKeyBundle(
        Number(req.user.id), Number(req.params.userId), req.params.deviceId, req.query.identityType || 'aci'
    )),
    createProvisioningSession: run(req => e2eeRelayService.createProvisioningSession(Number(req.user.id), req.body)),
    connectNewDevice: run(req => e2eeRelayService.connectNewDevice(Number(req.user.id), req.params.sessionId, req.body)),
    sendProvisioningMessage: run(req => e2eeRelayService.sendProvisioningMessage(Number(req.user.id), req.params.sessionId, req.body)),
    getProvisioningMessage: run(req => e2eeRelayService.getProvisioningMessage(Number(req.user.id), req.params.sessionId)),
    completeProvisioning: run(req => e2eeRelayService.completeProvisioning(Number(req.user.id), req.params.sessionId, req.body)),
    acknowledgeProvisioning: run(req => e2eeRelayService.acknowledgeProvisioning(
        Number(req.user.id), req.params.sessionId, req.get('X-E2EE-Device-Token')
    )),
    rollbackProvisioning: run(req => e2eeRelayService.rollbackProvisioning(
        Number(req.user.id), req.params.sessionId, req.get('X-E2EE-Device-Token')
    )),
    abortProvisioningSession: run(req => e2eeRelayService.abortProvisioningSession(Number(req.user.id), req.params.sessionId)),
    deleteProvisioningSession: run(req => e2eeRelayService.deleteProvisioningSession(Number(req.user.id), req.params.sessionId)),
    getConversationStatus: run(req => e2eeRelayService.getConversationE2EEStatus(
        Number(req.user.id), req.params.conversationId
    )),
    enableConversation: run(req => e2eeRelayService.enableConversationE2EE(
        Number(req.user.id), req.params.conversationId
    )),
    pauseConversation: async (req, res, next) => {
        try {
            const result = await e2eeRelayService.pauseConversationE2EE(
                Number(req.user.id), req.params.conversationId
            );
            // Broadcast only mode metadata, never message content or key material.
            getIO().to(`conversation:${Number(req.params.conversationId)}`).emit('conversation:e2ee-mode-updated', {
                conversationId: Number(req.params.conversationId),
                enabled: true,
                mode: result.mode,
                pausedAt: result.pausedAt || null
            });
            return res.json({ data: result });
        } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({
                    message: error.message,
                    ...(error.code ? { code: error.code } : {})
                });
            }
            return next(error);
        }
    },
    pullEnvelopes: run(req => e2eeRelayService.pullEnvelopes(
        Number(req.user.id), req.params.deviceId, req.query.limit
    )),
    markDelivered: run(req => e2eeRelayService.markDelivered(
        Number(req.user.id), req.params.deviceId, req.params.envelopeId
    )),
    sendDirectEnvelope: async (req, res, next) => {
        try {
            const data = await e2eeRelayService.sendDirectEnvelope(
                Number(req.user.id), Number(req.params.userId), req.body
            );
            await notifyE2EERecipient(data, Number(req.user.id));
            if (!data.duplicate) {
                try {
                    getIO().to(`e2ee-device:${data.recipientUserId}:${data.recipientDeviceId}`)
                        .emit('e2ee:envelope:available', {
                            envelopeId: data.id,
                            deviceId: data.recipientDeviceId,
                            serverTimestamp: data.serverTimestamp
                        });
                } catch (deliveryError) {
                    console.warn('[E2EE][relay] wake-up signal unavailable', {
                        code: deliveryError.code || 'SOCKET_UNAVAILABLE'
                    });
                }
            }
            return res.status(data.duplicate ? 200 : 201).json({ data });
        } catch (error) {
            if (error.statusCode) return res.status(error.statusCode).json({
                message: error.message,
                ...(error.code ? { code: error.code } : {})
            });
            return next(error);
        }
    },
    sendEnvelope: async (req, res, next) => {
        try {
            const data = await e2eeRelayService.sendEnvelope(
                Number(req.user.id), req.params.conversationId, req.body
            );
            await notifyE2EERecipient(data, Number(req.user.id));
            if (!data.duplicate) {
                try {
                    getIO().to(`e2ee-device:${data.recipientUserId}:${data.recipientDeviceId}`)
                        .emit('e2ee:envelope:available', {
                            envelopeId: data.id,
                            deviceId: data.recipientDeviceId,
                            serverTimestamp: data.serverTimestamp
                        });
                } catch (deliveryError) {
                    // The durable mailbox insert is authoritative. A reconnecting
                    // device recovers through GET /mailbox even if Socket.IO is down.
                    console.warn('[E2EE][relay] wake-up signal unavailable', {
                        code: deliveryError.code || 'SOCKET_UNAVAILABLE'
                    });
                }
            }
            return res.status(data.duplicate ? 200 : 201).json({ data });
        } catch (error) {
            if (error.statusCode) return res.status(error.statusCode).json({
                message: error.message,
                ...(error.code ? { code: error.code } : {})
            });
            return next(error);
        }
    }
};
