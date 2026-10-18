import client from '@/api/client';

const root = '/api/e2ee/relay';

export const e2eeRelayApi = {
    registerDevice: (payload) => client.post(`${root}/devices`, payload),
    getDevices: (userId) => client.get(`${root}/users/${encodeURIComponent(userId)}/devices`),
    getIdentityKey: (userId, identityType = 'aci') => client.get(`${root}/users/${encodeURIComponent(userId)}/identity`, { params: { identityType } }),
    getActiveDevices: (userId) => client.get(`${root}/users/${encodeURIComponent(userId)}/active-devices`),
    removeDevice: (deviceId) => client.delete(`${root}/devices/${encodeURIComponent(deviceId)}`),
    provisionIdentity: (deviceId, payload) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/identity`, payload),
    uploadPreKeys: (deviceId, payload) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys`, payload),
    getPreKeyCount: (deviceId, type, identityType = 'aci') =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/count/${encodeURIComponent(type)}`, { params: { identityType } }),
    clearStaleKemPreKeys: (deviceId, identityType = 'aci') => client.delete(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/kem-stale`, { params: { identityType } }),
    getPreKeyInventory: (deviceId, identityType = 'aci') =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/inventory`, { params: { identityType } }),
    fetchPreKeyBundle: (userId, deviceId, identityType = 'aci') =>
        client.get(`${root}/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/prekey-bundle`, { params: { identityType } }),
    sendDirectEnvelope: (userId, envelope) => client.post(`${root}/users/${encodeURIComponent(userId)}/envelopes`, envelope),
    sendEnvelope: (conversationId, envelope) =>
        client.post(`${root}/conversations/${encodeURIComponent(conversationId)}/envelopes`, envelope),
    pullMailbox: (deviceId, limit = 100) =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/mailbox`, { params: { limit } }),
    acknowledgeEnvelope: (deviceId, envelopeId) =>
        client.post(`${root}/devices/${encodeURIComponent(deviceId)}/envelopes/${encodeURIComponent(envelopeId)}/ack`)
};
