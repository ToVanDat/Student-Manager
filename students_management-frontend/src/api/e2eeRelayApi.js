import client from '@/api/client';

const root = '/api/e2ee/relay';
const deviceAuth = token => ({ headers: { 'X-E2EE-Device-Token': token } });

export const e2eeRelayApi = {
    registerDevice: (payload) => client.post(`${root}/devices`, payload),
    createProvisioningSession: (userId, ephemeralPublicKey) => client.post(`${root}/provisioning`, { ephemeralPublicKey }),
    connectNewDevice: (sessionId, ephemeralPublicKey, deviceMetadata) => client.post(`${root}/provisioning/${encodeURIComponent(sessionId)}/connect`, { ephemeralPublicKey, deviceMetadata }),
    sendProvisioningMessage: (sessionId, encryptedMessage) => client.post(`${root}/provisioning/${encodeURIComponent(sessionId)}/message`, { encryptedMessage }),
    getProvisioningMessage: (sessionId) => client.get(`${root}/provisioning/${encodeURIComponent(sessionId)}/message`),
    completeProvisioning: (sessionId, payload) => client.post(`${root}/provisioning/${encodeURIComponent(sessionId)}/complete`, payload),
    acknowledgeProvisioning: (sessionId, token) => client.post(`${root}/provisioning/${encodeURIComponent(sessionId)}/ack`, {}, deviceAuth(token)),
    rollbackProvisioning: (sessionId, token) => client.post(`${root}/provisioning/${encodeURIComponent(sessionId)}/rollback`, {}, deviceAuth(token)),
    deleteProvisioningSession: (sessionId) => client.delete(`${root}/provisioning/${encodeURIComponent(sessionId)}`),
    getDevices: (userId) => client.get(`${root}/users/${encodeURIComponent(userId)}/devices`),
    getIdentityKey: (userId, identityType = 'aci') => client.get(`${root}/users/${encodeURIComponent(userId)}/identity`, { params: { identityType } }),
    getActiveDevices: (userId) => client.get(`${root}/users/${encodeURIComponent(userId)}/active-devices`),
    removeDevice: (deviceId) => client.delete(`${root}/devices/${encodeURIComponent(deviceId)}`),
    provisionIdentity: (deviceId, payload, token) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/identity`, payload, deviceAuth(token)),
    rotateIdentity: (deviceId, payload, token) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/identity/rotate`, payload, deviceAuth(token)),
    uploadPreKeys: (deviceId, payload, token) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys`, payload, deviceAuth(token)),
    getPreKeyCount: (deviceId, type, identityType = 'aci', token) =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/count/${encodeURIComponent(type)}`, { params: { identityType }, ...deviceAuth(token) }),
    clearStaleKemPreKeys: (deviceId, identityType = 'aci', token) => client.delete(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/kem-stale`, { params: { identityType }, ...deviceAuth(token) }),
    getPreKeyInventory: (deviceId, identityType = 'aci', token) =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/inventory`, { params: { identityType }, ...deviceAuth(token) }),
    fetchPreKeyBundle: (userId, deviceId, identityType = 'aci') =>
        client.get(`${root}/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/prekey-bundle`, { params: { identityType } }),
    getConversationStatus: (conversationId) => client.get(`${root}/conversations/${encodeURIComponent(conversationId)}/status`),
    enableConversation: (conversationId) => client.post(`${root}/conversations/${encodeURIComponent(conversationId)}/enable`),
    pauseConversation: (conversationId) => client.post(`${root}/conversations/${encodeURIComponent(conversationId)}/pause`),
    sendDirectEnvelope: (userId, envelope, token) => client.post(`${root}/users/${encodeURIComponent(userId)}/envelopes`, envelope, deviceAuth(token)),
    sendEnvelope: (conversationId, envelope, token) =>
        client.post(`${root}/conversations/${encodeURIComponent(conversationId)}/envelopes`, envelope, deviceAuth(token)),
    pullMailbox: (deviceId, limit = 100, token) =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/mailbox`, { params: { limit }, ...deviceAuth(token) }),
    acknowledgeEnvelope: (deviceId, envelopeId, token) =>
        client.post(`${root}/devices/${encodeURIComponent(deviceId)}/envelopes/${encodeURIComponent(envelopeId)}/ack`, {}, deviceAuth(token))
};
