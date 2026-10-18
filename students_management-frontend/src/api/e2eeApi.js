import client from './client';

// Device public keys and prekey bundles only. Private keys and Signal session
// state must stay in the browser's local encrypted storage.
export const e2eeApi = {
    registerDevice: (device) => client.post('/api/e2ee/devices', device),
    getMyDevices: () => client.get('/api/e2ee/devices'),
    revokeDevice: (deviceId) => client.delete(`/api/e2ee/devices/${encodeURIComponent(deviceId)}`),
    getConversationDeviceBundles: (conversationId) =>
        client.get(`/api/e2ee/conversations/${conversationId}/device-bundles')
};
