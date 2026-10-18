import client from '@/api/client';

const root = '/api/e2ee/relay';

export const e2eeRelayApi = {
    registerDevice: (payload) => client.post(`${root}/devices`, payload),
    getDevices: (userId) => client.get(`${root}/users/${encodeURIComponent(userId)}/devices`),
    removeDevice: (deviceId) => client.delete(`${root}/devices/${encodeURIComponent(deviceId)}`),
    provisionIdentity: (deviceId, payload) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/identity`, payload),
    uploadPreKeys: (deviceId, payload) => client.put(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys`, payload),
    getPreKeyCount: (deviceId, type, identityType = 'aci') =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/count/${encodeURIComponent(type)}`, { params: { identityType } }),
    getPreKeyInventory: (deviceId, identityType = 'aci') =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/prekeys/inventory`, { params: { identityType } }),
    fetchPreKeyBundle: (userId, deviceId, identityType = 'aci') =>
        client.get(`${root}/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}/prekey-bundle`, { params: { identityType } }),
    sendEnvelope: (conversationId, envelope) =>
        client.post(`${root}/conversations/${encodeURIComponent(conversationId)}/envelopes`, envelope),
    pullMailbox: (deviceId, limit = 100) =>
        client.get(`${root}/devices/${encodeURIComponent(deviceId)}/mailbox`, { params: { limit } }),
    acknowledgeEnvelope: (deviceId, envelopeId) =>
        client.post(`${root}/devices/${encodeURIComponent(deviceId)}/envelopes/${encodeURIComponent(envelopeId)}/ack`)
};
