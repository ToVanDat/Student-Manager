const e2eeRelayService = require('../service/e2eeRelayService');
const { getIO } = require('../src/socket/socket');

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

module.exports = {
    registerDevice: run(req => e2eeRelayService.registerDevice(Number(req.user.id), req.body)),
    getDevices: run(req => e2eeRelayService.getDevices(Number(req.user.id), Number(req.params.userId))),
    removeDevice: run(req => e2eeRelayService.removeDevice(Number(req.user.id), req.params.deviceId)),
    provisionIdentity: run(req => e2eeRelayService.provisionIdentity(
        Number(req.user.id), req.params.deviceId, req.body
    )),
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
    pullEnvelopes: run(req => e2eeRelayService.pullEnvelopes(
        Number(req.user.id), req.params.deviceId, req.query.limit
    )),
    markDelivered: run(req => e2eeRelayService.markDelivered(
        Number(req.user.id), req.params.deviceId, req.params.envelopeId
    )),
    sendEnvelope: async (req, res, next) => {
        try {
            const data = await e2eeRelayService.sendEnvelope(
                Number(req.user.id), req.params.conversationId, req.body
            );
            if (!data.duplicate) {
                getIO().to(`e2ee-device:${data.recipientUserId}:${data.recipientDeviceId}`)
                    .emit('e2ee:envelope:available', {
                        envelopeId: data.id,
                        deviceId: data.recipientDeviceId,
                        serverTimestamp: data.serverTimestamp
                    });
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
