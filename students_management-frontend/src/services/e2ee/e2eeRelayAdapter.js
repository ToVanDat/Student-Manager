import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import socket from '@/socket/socket.js';

const unwrap = response => response?.data?.data;
const unsupported = (name) => {
    const error = new Error(`E2EE relay operation is not enabled in this deployment: ${name}`);
    error.code = 'E2EE_RELAY_OPERATION_UNSUPPORTED';
    return error;
};

const bytesToBase64 = value => {
    if (typeof value === 'string') return value;
    if (!(value instanceof Uint8Array)) throw new TypeError('SDK ciphertext must be a string or Uint8Array');
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < value.length; offset += chunkSize) {
        binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
};

const base64ToBytes = value => {
    if (typeof value !== 'string') return value;
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
};

export const createE2EERelayAdapter = (authenticatedUserId) => {
    const userId = String(authenticatedUserId);
    let currentDeviceId = null;
    let connectionState = { state: socket.connected ? 'connected' : 'stopped', since: Date.now() };
    const connectionListeners = new Set();
    const updateConnectionState = state => {
        connectionState = { ...state, since: Date.now() };
        connectionListeners.forEach(listener => {
            try { listener(connectionState); } catch (error) {
                console.error('[E2EE] relay state listener failed');
            }
        });
    };
    const assertOwnUser = target => {
        if (String(target) !== userId) {
            const error = new Error('Relay operation attempted to impersonate another account');
            error.code = 'E2EE_USER_MISMATCH';
            throw error;
        }
    };
    const requireDevice = () => {
        if (!currentDeviceId) {
            const error = new Error('E2EE device has not been registered with the relay');
            error.code = 'E2EE_DEVICE_NOT_REGISTERED';
            throw error;
        }
        return currentDeviceId;
    };

    socket.on('connect', () => updateConnectionState({ state: 'connected' }));
    socket.on('disconnect', () => updateConnectionState({ state: 'reconnecting', reason: 'closed' }));
    socket.on('connect_error', () => updateConnectionState({ state: 'reconnecting', reason: 'error' }));

    const adapter = {
        getCurrentDeviceId() { return currentDeviceId; },

        get relayConnectionState() {
            return { ...connectionState };
        },

        subscribeRelayConnectionState(listener) {
            connectionListeners.add(listener);
            return () => connectionListeners.delete(listener);
        },

        async registerDevice(requestedUserId, device = {}) {
            assertOwnUser(requestedUserId);
            const payload = {
                ...(device.deviceId == null ? {} : { deviceId: device.deviceId }),
                deviceType: device.deviceType || 'web',
                ...(device.encryptedDeviceName ? { encryptedDeviceName: bytesToBase64(new Uint8Array(device.encryptedDeviceName)) } : {})
            };
            const result = unwrap(await e2eeRelayApi.registerDevice(payload));
            currentDeviceId = Number(result.device_id ?? result.deviceId);
            if (!Number.isSafeInteger(currentDeviceId) || currentDeviceId < 1 || currentDeviceId > 5) {
                throw new Error('Relay returned an invalid numeric device slot');
            }
            return currentDeviceId;
        },

        async getDevices(targetUserId) {
            const result = unwrap(await e2eeRelayApi.getDevices(targetUserId));
            return Array.isArray(result) ? result : [];
        },

        async getActiveDevices(targetUserId) {
            const result = unwrap(await e2eeRelayApi.getActiveDevices(targetUserId));
            return Array.isArray(result) ? result : [];
        },

        async removeDevice(requestedUserId, deviceId) {
            assertOwnUser(requestedUserId);
            await e2eeRelayApi.removeDevice(deviceId);
            if (Number(deviceId) === currentDeviceId) currentDeviceId = null;
        },

        async provisionIdentityKey(request) {
            assertOwnUser(request.userId);
            currentDeviceId = Number(request.deviceId);
            await e2eeRelayApi.provisionIdentity(currentDeviceId, {
                identity: request.identity,
                registrationId: request.registrationId,
                identityType: request.identityType || 'aci'
            });
        },

        async getIdentityKey(targetUserId, identityType = 'aci') {
            return unwrap(await e2eeRelayApi.getIdentityKey(targetUserId, identityType));
        },

        async uploadPreKeys(requestedUserId, deviceId, keys, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            await e2eeRelayApi.uploadPreKeys(deviceId, {
                identityType,
                keys: keys.map(key => ({
                    type: key.type,
                    keyId: key.keyId,
                    publicKey: key.publicKey,
                    ...(key.signature ? { signature: key.signature } : {})
                }))
            });
        },

        async fetchPreKeyBundle(targetUserId, deviceId, _fetcherUserId, identityType = 'aci') {
            return unwrap(await e2eeRelayApi.fetchPreKeyBundle(targetUserId, deviceId, identityType));
        },

        async getPreKeyCount(requestedUserId, deviceId, type, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const count = unwrap(await e2eeRelayApi.getPreKeyCount(deviceId, type, identityType));
            return Number(count?.count ?? count ?? 0);
        },

        async getPreKeyInventory(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType));
        },

        async clearStaleKemPreKeys(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.clearStaleKemPreKeys(deviceId, identityType));
        },

        async publishPlannedPreKeys(requestedUserId, deviceId, plan, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const inventory = unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType));
            const keys = await plan(inventory);
            if (keys?.length) {
                await e2eeRelayApi.uploadPreKeys(deviceId, { identityType, keys });
            }
        },

        async send(envelope) {
            assertOwnUser(envelope.senderUserId);
            const result = unwrap(await e2eeRelayApi.sendDirectEnvelope(envelope.targetUserId, {
                targetUserId: envelope.targetUserId,
                targetDeviceId: envelope.targetDeviceId,
                senderDeviceId: envelope.senderDeviceId,
                ciphertext: bytesToBase64(envelope.ciphertext),
                messageType: envelope.messageType,
                deliveryClass: envelope.deliveryClass,
                contentKind: envelope.contentKind || 'message',
                timestamp: envelope.timestamp,
                clientMessageId: envelope.clientMessageId,
                ...(envelope.operationEpochMilliseconds == null ? {} : { operationEpochMilliseconds: envelope.operationEpochMilliseconds }),
                ...(envelope.recipientRegistrationId == null ? {} : { recipientRegistrationId: envelope.recipientRegistrationId })
            }));
            return {
                messageId: result.id,
                serverTimestamp: result.serverTimestamp,
                duplicate: result.duplicate,
                expiresAt: result.expiresAt
            };
        },

        async markDelivered(envelopeId) {
            const deviceId = requireDevice();
            await e2eeRelayApi.acknowledgeEnvelope(deviceId, envelopeId);
        },

        subscribe(requestedUserId, deviceId, onEnvelope, options = {}) {
            assertOwnUser(requestedUserId);
            currentDeviceId = Number(deviceId);
            let stopped = false;
            let processing = false;
            let pendingWake = false;

            const pullAndProcess = async () => {
                if (stopped) return;
                if (processing) {
                    pendingWake = true;
                    return;
                }
                processing = true;
                try {
                    options.onBatchStart?.();
                    do {
                        pendingWake = false;
                        const envelopes = unwrap(await e2eeRelayApi.pullMailbox(deviceId, 100)) || [];
                        for (const envelope of envelopes) {
                            if (stopped) break;
                            try {
                                await onEnvelope({
                                    ...envelope,
                                    targetUserId: String(requestedUserId),
                                    targetDeviceId: Number(deviceId),
                                    ciphertext: base64ToBytes(envelope.ciphertext)
                                });
                                await e2eeRelayApi.acknowledgeEnvelope(deviceId, envelope.id);
                            } catch (error) {
                                // Do not acknowledge: reconnect/mailbox recovery retries it.
                                console.warn('[E2EE] envelope processing deferred', {
                                    envelopeId: envelope.id,
                                    code: error?.code || 'ENVELOPE_HANDLER_FAILED'
                                });
                                break;
                            }
                        }
                    } while (pendingWake && !stopped);
                } catch (error) {
                    updateConnectionState({ state: 'reconnecting', reason: 'error' });
                    console.warn('[E2EE] mailbox pull failed', { code: error?.code || 'MAILBOX_PULL_FAILED' });
                } finally {
                    processing = false;
                    options.onBatchEnd?.();
                }
            };

            const onAvailable = event => {
                if (Number(event?.deviceId) === Number(deviceId)) void pullAndProcess();
            };
            const onConnect = () => {
                socket.emit('e2ee:subscribe', { deviceId: Number(deviceId) }, result => {
                    if (result?.ok) {
                        updateConnectionState({ state: 'connected' });
                        void pullAndProcess();
                    } else {
                        updateConnectionState({ state: 'reconnecting', reason: 'authentication' });
                    }
                });
            };
            socket.on('e2ee:envelope:available', onAvailable);
            socket.on('connect', onConnect);
            if (!socket.connected) {
                updateConnectionState({ state: 'connecting' });
                socket.connect();
            } else {
                onConnect();
            }

            return () => {
                stopped = true;
                socket.off('e2ee:envelope:available', onAvailable);
                socket.off('connect', onConnect);
                if (socket.connected) socket.emit('e2ee:unsubscribe', { deviceId: Number(deviceId) });
                updateConnectionState({ state: 'stopped' });
            };
        },

        async createProvisioningSession(requestedUserId, ephemeralPublicKey) {
            assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.createProvisioningSession(requestedUserId, bytesToBase64(ephemeralPublicKey)));
        },

        async connectNewDevice(sessionId, ephemeralPublicKey, deviceMetadata) {
            return unwrap(await e2eeRelayApi.connectNewDevice(sessionId, bytesToBase64(ephemeralPublicKey), deviceMetadata));
        },

        async sendProvisioningMessage(sessionId, encryptedMessage, requestedUserId) {
            if (requestedUserId != null) assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.sendProvisioningMessage(sessionId, encryptedMessage));
        },

        async getProvisioningMessage(sessionId) {
            return unwrap(await e2eeRelayApi.getProvisioningMessage(sessionId));
        },

        async completeProvisioning(sessionId, deviceMetadata = {}) {
            const payload = {
                ...deviceMetadata,
                ...(deviceMetadata.encryptedDeviceName
                    ? { encryptedDeviceName: bytesToBase64(new Uint8Array(deviceMetadata.encryptedDeviceName)) }
                    : {})
            };
            delete payload.platform;
            delete payload.appVersion;
            delete payload.osVersion;
            return unwrap(await e2eeRelayApi.completeProvisioning(sessionId, payload));
        },

        async acknowledgeProvisioning(sessionId) {
            return unwrap(await e2eeRelayApi.acknowledgeProvisioning(sessionId));
        },

        async rollbackProvisioning(sessionId) {
            return unwrap(await e2eeRelayApi.rollbackProvisioning(sessionId));
        },

        async deleteProvisioningSession(sessionId, requestedUserId) {
            if (requestedUserId != null) assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.deleteProvisioningSession(sessionId));
        },

        // Identity rotation requires compare-and-swap against the SDK commitment.
        // It remains fail-closed until the backend stores and verifies that commitment.
        rotateIdentityKey: async () => { throw unsupported('rotateIdentityKey'); }
    };

    return adapter;
};
