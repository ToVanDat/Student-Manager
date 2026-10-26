import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import socket from '@/socket/socket.js';
import { getE2EEDeviceCredential, saveE2EEDeviceCredential, deleteE2EEDeviceCredential, setPendingE2EEProvisioningRollback, getPendingE2EEProvisioningRollback } from './e2eeDeviceCredentialStore';
import { setStoredE2EEDeviceId, clearStoredE2EEDeviceId } from './e2eeDeviceStateStore';

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

    const requireCredential = async (deviceId = requireDevice()) => {
        const pendingRollback = await getPendingE2EEProvisioningRollback(userId, Number(deviceId));
        if (pendingRollback) {
            const error = new Error('This linked device is awaiting provisioning rollback; relay operations are blocked.');
            error.code = 'E2EE_PROVISIONING_ROLLBACK_PENDING';
            throw error;
        }
        const token = await getE2EEDeviceCredential(userId, Number(deviceId));
        if (!token) {
            const error = new Error('Per-device relay credential is missing. Revoke and securely re-link this device.');
            error.code = 'E2EE_DEVICE_CREDENTIAL_MISSING';
            throw error;
        }
        return token;
    };

    const finishProvisioningRollback = async (deviceId, sessionId) => {
        const token = await getE2EEDeviceCredential(userId, Number(deviceId));
        if (!token) {
            const error = new Error('Cannot recover provisioning rollback without the stored device credential.');
            error.code = 'E2EE_DEVICE_CREDENTIAL_MISSING';
            throw error;
        }
        const result = unwrap(await e2eeRelayApi.rollbackProvisioning(sessionId, token));
        await deleteE2EEDeviceCredential(userId, Number(deviceId));
        await clearStoredE2EEDeviceId(userId);
        if (currentDeviceId === Number(deviceId)) currentDeviceId = null;
        return result;
    };

    const retryPendingProvisioningRollback = async () => {
        const deviceId = await getStoredE2EEDeviceId(userId);
        if (!deviceId || deviceId <= 1) return;
        const sessionId = await getPendingE2EEProvisioningRollback(userId, deviceId);
        if (!sessionId) return;
        try {
            await finishProvisioningRollback(deviceId, sessionId);
        } catch (error) {
            console.warn('[E2EE] pending provisioning rollback remains queued', {
                code: error?.code || 'PROVISIONING_ROLLBACK_FAILED'
            });
        }
    };

    // SDK v11 logs and swallows rollback failures. Keep a durable local intent
    // so the next adapter initialization can retry with the retained device token.
    void retryPendingProvisioningRollback();

    const onSocketConnect = () => updateConnectionState({ state: 'connected' });
    const onSocketDisconnect = () => updateConnectionState({ state: 'reconnecting', reason: 'closed' });
    const onSocketConnectError = () => updateConnectionState({ state: 'reconnecting', reason: 'error' });
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('connect_error', onSocketConnectError);

    const adapter = {
        dispose() {
            socket.off('connect', onSocketConnect);
            socket.off('disconnect', onSocketDisconnect);
            socket.off('connect_error', onSocketConnectError);
            connectionListeners.clear();
        },

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
            if (result.device_token) {
                await saveE2EEDeviceCredential(userId, currentDeviceId, result.device_token);
                await setStoredE2EEDeviceId(userId, currentDeviceId);
            } else if (!(await getE2EEDeviceCredential(userId, currentDeviceId))) {
                const error = new Error('Relay did not issue a device credential for this registered slot.');
                error.code = 'E2EE_DEVICE_CREDENTIAL_MISSING';
                throw error;
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
            if (Number(deviceId) === currentDeviceId) {
                await deleteE2EEDeviceCredential(userId, currentDeviceId);
                await clearStoredE2EEDeviceId(userId);
                currentDeviceId = null;
            }
        },

        async provisionIdentityKey(request) {
            assertOwnUser(request.userId);
            currentDeviceId = Number(request.deviceId);
            const token = await requireCredential(currentDeviceId);
            await e2eeRelayApi.provisionIdentity(currentDeviceId, {
                identity: request.identity,
                registrationId: request.registrationId,
                identityType: request.identityType || 'aci'
            }, token);
        },

        async getIdentityKey(targetUserId, identityType = 'aci') {
            return unwrap(await e2eeRelayApi.getIdentityKey(targetUserId, identityType));
        },

        async uploadPreKeys(requestedUserId, deviceId, keys, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            await e2eeRelayApi.uploadPreKeys(deviceId, {
                identityType,
                keys: keys.map(key => ({
                    type: key.type,
                    keyId: key.keyId,
                    publicKey: key.publicKey,
                    ...(key.signature ? { signature: key.signature } : {})
                }))
            }, token);
        },

        async fetchPreKeyBundle(targetUserId, deviceId, _fetcherUserId, identityType = 'aci') {
            return unwrap(await e2eeRelayApi.fetchPreKeyBundle(targetUserId, deviceId, identityType));
        },

        async getPreKeyCount(requestedUserId, deviceId, type, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            const count = unwrap(await e2eeRelayApi.getPreKeyCount(deviceId, type, identityType, token));
            return Number(count?.count ?? count ?? 0);
        },

        async getPreKeyInventory(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            return unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType, token));
        },

        async getEcSignedPreKeyMetadata(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            const inventory = unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType, token));
            return inventory?.ecSignedPreKey || null;
        },

        async getKemLastResortPreKeyMetadata(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            const inventory = unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType, token));
            return inventory?.kemLastResortPreKey || null;
        },

        async clearStaleKemPreKeys(requestedUserId, deviceId, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            return unwrap(await e2eeRelayApi.clearStaleKemPreKeys(deviceId, identityType, token));
        },

        async publishPlannedPreKeys(requestedUserId, deviceId, plan, identityType = 'aci') {
            assertOwnUser(requestedUserId);
            const token = await requireCredential(deviceId);
            const inventory = unwrap(await e2eeRelayApi.getPreKeyInventory(deviceId, identityType, token));
            const keys = await plan(inventory);
            if (keys?.length) {
                await e2eeRelayApi.uploadPreKeys(deviceId, { identityType, keys }, token);
            }
        },

        async send(envelope) {
            assertOwnUser(envelope.senderUserId);
            const token = await requireCredential(envelope.senderDeviceId);
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
            }, token));
            return {
                messageId: result.id,
                serverTimestamp: result.serverTimestamp,
                duplicate: result.duplicate,
                expiresAt: result.expiresAt
            };
        },

        async markDelivered(envelopeId) {
            const deviceId = requireDevice();
            const token = await requireCredential(deviceId);
            await e2eeRelayApi.acknowledgeEnvelope(deviceId, envelopeId, token);
        },

        subscribe(requestedUserId, deviceId, onEnvelope, options = {}) {
            assertOwnUser(requestedUserId);
            currentDeviceId = Number(deviceId);
            let deviceTokenPromise = requireCredential(currentDeviceId);
            let stopped = false;
            let processing = false;
            let pendingWake = false;
            let retryTimer = null;
            let retryAttempt = 0;
            let pullAndProcess;

            // Durable mailbox rows are intentionally left unacknowledged when
            // decryption/handling fails. Retry with capped exponential backoff
            // instead of waiting indefinitely for a future Socket.IO event.
            const scheduleRetry = () => {
                if (stopped || retryTimer) return;
                const delay = Math.min(30_000, 1_000 * (2 ** Math.min(retryAttempt, 5)));
                retryAttempt += 1;
                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    void pullAndProcess();
                }, delay);
            };

            pullAndProcess = async () => {
                if (stopped) return;
                if (processing) {
                    pendingWake = true;
                    return;
                }
                if (retryTimer) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
                processing = true;
                let shouldRetry = false;
                try {
                    options.onBatchStart?.();
                    do {
                        pendingWake = false;
                        const token = await deviceTokenPromise;
                        const envelopes = unwrap(await e2eeRelayApi.pullMailbox(deviceId, 100, token)) || [];
                        // Drain full mailbox pages even if no additional Socket.IO
                        // wake-up arrives while the current batch is being handled.
                        if (envelopes.length >= 100) pendingWake = true;
                        for (const envelope of envelopes) {
                            if (stopped) break;
                            try {
                                await onEnvelope({
                                    ...envelope,
                                    targetUserId: String(requestedUserId),
                                    targetDeviceId: Number(deviceId),
                                    ciphertext: base64ToBytes(envelope.ciphertext)
                                });
                                await e2eeRelayApi.acknowledgeEnvelope(deviceId, envelope.id, token);
                            } catch (error) {
                                // Do not acknowledge: a later retry can process the same durable envelope.
                                console.warn('[E2EE] envelope processing deferred', {
                                    envelopeId: envelope.id,
                                    code: error?.code || 'ENVELOPE_HANDLER_FAILED'
                                });
                                shouldRetry = true;
                                break;
                            }
                        }
                        if (!shouldRetry) retryAttempt = 0;
                    } while (pendingWake && !stopped && !shouldRetry);
                } catch (error) {
                    shouldRetry = true;
                    updateConnectionState({ state: 'reconnecting', reason: 'error' });
                    console.warn('[E2EE] mailbox pull failed', { code: error?.code || 'MAILBOX_PULL_FAILED' });
                } finally {
                    processing = false;
                    options.onBatchEnd?.();
                    if (shouldRetry) scheduleRetry();
                }
            };

            const onAvailable = event => {
                if (Number(event?.deviceId) === Number(deviceId)) void pullAndProcess();
            };
            const onConnect = () => {
                void deviceTokenPromise.then(deviceToken => socket.emit('e2ee:subscribe', { deviceId: Number(deviceId), deviceToken }, result => {
                    if (result?.ok) {
                        updateConnectionState({ state: 'connected' });
                        void pullAndProcess();
                    } else {
                        updateConnectionState({ state: 'reconnecting', reason: 'authentication' });
                    }
                })).catch(error => {
                    updateConnectionState({ state: 'reconnecting', reason: 'device-auth' });
                    console.warn('[E2EE] device subscription auth failed', { code: error?.code || 'DEVICE_AUTH_FAILED' });
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
                if (retryTimer) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
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
            delete payload.deviceName;
            delete payload.platform;
            delete payload.appVersion;
            delete payload.osVersion;
            const result = unwrap(await e2eeRelayApi.completeProvisioning(sessionId, payload));
            if (result?.deviceToken && Number.isInteger(Number(result.deviceId))) {
                currentDeviceId = Number(result.deviceId);
                await saveE2EEDeviceCredential(userId, currentDeviceId, result.deviceToken);
                await setStoredE2EEDeviceId(userId, currentDeviceId);
            }
            return result;
        },

        async acknowledgeProvisioning(sessionId) {
            const deviceId = requireDevice();
            const token = await requireCredential(deviceId);
            return unwrap(await e2eeRelayApi.acknowledgeProvisioning(sessionId, token));
        },

        async rollbackProvisioning(sessionId) {
            const deviceId = requireDevice();
            await setPendingE2EEProvisioningRollback(userId, deviceId, sessionId);
            return finishProvisioningRollback(deviceId, sessionId);
        },

        async deleteProvisioningSession(sessionId, requestedUserId) {
            if (requestedUserId != null) assertOwnUser(requestedUserId);
            return unwrap(await e2eeRelayApi.deleteProvisioningSession(sessionId));
        },

        async rotateIdentityKey(request) {
            assertOwnUser(request.userId);
            const deviceId = Number(request.deviceId);
            const token = await requireCredential(deviceId);
            return unwrap(await e2eeRelayApi.rotateIdentity(deviceId, {
                identity: request.identity,
                registrationId: request.registrationId,
                identityType: request.identityType || 'aci',
                expectedCurrentCommitment: bytesToBase64(request.expectedCurrentCommitment)
            }, token));
        }
    };

    return adapter;
};
