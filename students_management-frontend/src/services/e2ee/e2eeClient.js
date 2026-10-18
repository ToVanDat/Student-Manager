import { createSignalProtocolClient } from '@open-e2ee/signal-protocol-sdk';
import { webSqliteStore } from '@open-e2ee/signal-protocol-sdk/local/store/web-sqlite';
import { createE2EERelayAdapter } from './e2eeRelayAdapter';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import { getStoredE2EEDeviceId, setStoredE2EEDeviceId } from './e2eeDeviceStateStore';

const listeners = new Set();
let activeContext = null;
let initialization = null;
let initializingUserId = null;
let generation = 0;
const decryptedMessageListeners = new Set();

const initialState = {
    status: 'idle',
    userId: null,
    deviceId: null,
    relayState: 'not-configured',
    errorCode: null
};

let state = { ...initialState };

const publish = (patch) => {
    state = { ...state, ...patch };
    for (const listener of listeners) {
        try {
            listener(state);
        } catch (error) {
            console.error('[E2EE] state listener failed', error);
        }
    }
};

const closeResources = async (client, storage, unsubscribeRelayState, relay) => {
    try { relay?.dispose?.(); } catch { /* best-effort cleanup */ }
    try { unsubscribeRelayState?.(); } catch { /* best-effort cleanup */ }
    try {
        if (client && typeof client.stop === 'function') await client.stop();
    } catch {
        // Best-effort cleanup; preserve the original error.
    }
    try {
        if (storage && typeof storage.close === 'function') await storage.close();
    } catch {
        // Best-effort cleanup; preserve the original error.
    }
};

export const getE2EEClientState = () => ({ ...state });

export const subscribeE2EEClientState = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(getE2EEClientState());
    return () => listeners.delete(listener);
};

/**
 * Opens the SDK-managed encrypted browser store for one account and creates a
 * local Signal Protocol client, authenticated relay adapter, and receive hook.
 * A conversation is still not E2EE-enabled merely because this client is ready.
 *
 * OPFS is used to give each signed-in account a separate local store. We do not
 * silently fall back to the SDK's fixed-name IndexedDB store because doing so
 * could mix identities when multiple accounts use the same browser profile.
 */
export const initializeE2EEClient = async (userId) => {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId || !/^[1-9][0-9]*$/.test(normalizedUserId)) {
        const error = new Error('A valid authenticated user ID is required for E2EE initialization.');
        error.code = 'E2EE_INVALID_USER';
        throw error;
    }

    if (activeContext?.userId === normalizedUserId && activeContext.client) {
        return activeContext.client;
    }

    let token;
    if (initialization) {
        const pending = initialization;
        if (initializingUserId === normalizedUserId) {
            return pending;
        }

        // A different account supersedes the in-flight initialization.
        token = ++generation;
        try {
            await pending;
        } catch {
            // The previous attempt may have been superseded or failed.
        }
        if (token !== generation) {
            const error = new Error('E2EE initialization was superseded by a newer account state.');
            error.code = 'E2EE_INITIALIZATION_SUPERSEDED';
            throw error;
        }
    } else {
        token = ++generation;
    }

    initializingUserId = normalizedUserId;
    publish({
        status: 'initializing',
        userId: normalizedUserId,
        deviceId: null,
        relayState: 'not-configured',
        errorCode: null
    });

    const pendingInitialization = (async () => {
        let storage;
        let client;
        let relay;
        let unsubscribeRelayState;
        try {
            if (activeContext) {
                const previous = activeContext;
                activeContext = null;
                await closeResources(previous.client, previous.storage, previous.unsubscribeRelayState, previous.relay);
            }

            let deviceId = await getStoredE2EEDeviceId(normalizedUserId);
            const devicesResponse = await e2eeRelayApi.getDevices(normalizedUserId);
            const serverDevices = devicesResponse.data?.data || [];
            if (deviceId == null) {
                if (serverDevices.length > 0) {
                    const error = new Error('Tài khoản đã có thiết bị E2EE. Hãy liên kết thiết bị này từ thiết bị chính thay vì tạo identity mới.');
                    error.code = 'E2EE_DEVICE_LINK_REQUIRED';
                    throw error;
                }
                deviceId = 1;
                await setStoredE2EEDeviceId(normalizedUserId, deviceId);
            } else if (serverDevices.length > 0 && !serverDevices.some(device => Number(device.deviceId) === deviceId)) {
                const error = new Error('Thiết bị E2EE cục bộ đã bị thu hồi hoặc không còn đăng ký trên relay.');
                error.code = 'E2EE_DEVICE_REVOKED';
                throw error;
            }

            storage = await webSqliteStore({
                name: `student-manager-e2ee-user-${normalizedUserId}.db`
            });
            if (token !== generation) {
                await closeResources(null, storage, null, relay);
                const error = new Error('E2EE initialization was superseded by a newer account state.');
                error.code = 'E2EE_INITIALIZATION_SUPERSEDED';
                throw error;
            }

            relay = createE2EERelayAdapter(normalizedUserId);
            // Provision the numeric relay slot before publishing identity/prekeys.
            await relay.registerDevice(normalizedUserId, { deviceId, deviceType: 'web' });
            client = await createSignalProtocolClient({
                identity: { userId: normalizedUserId, deviceId },
                adapters: { storage, relay }
            });
            if (typeof client.registerHook !== 'function' || typeof client.startRelaySubscription !== 'function') {
                throw new Error('Installed Signal Protocol SDK does not expose the expected receive lifecycle API.');
            }
            client.registerHook('onMessageDecrypted', async message => {
                for (const listener of [...decryptedMessageListeners]) await listener(message);
            });
            unsubscribeRelayState = relay.subscribeRelayConnectionState(next => {
                if (activeContext?.userId !== normalizedUserId) return;
                publish({ relayState: next.state });
            });
            activeContext = { userId: normalizedUserId, storage, client, relay, unsubscribeRelayState };
            await client.startRelaySubscription();
            if (token !== generation) {
                await closeResources(client, storage, unsubscribeRelayState, relay);
                const error = new Error('E2EE initialization was superseded by a newer account state.');
                error.code = 'E2EE_INITIALIZATION_SUPERSEDED';
                throw error;
            }

            publish({
                status: 'local-ready',
                userId: normalizedUserId,
                deviceId: client.deviceId ?? relay.getCurrentDeviceId() ?? null,
                relayState: relay.relayConnectionState.state,
                errorCode: null
            });
            return client;
        } catch (error) {
            await closeResources(client, storage, unsubscribeRelayState);
            if (token === generation) {
                const code = typeof error?.code === 'string' ? error.code : 'E2EE_LOCAL_STORE_FAILED';
                publish({
                    status: 'error',
                    userId: normalizedUserId,
                    deviceId: null,
                    relayState: 'not-configured',
                    errorCode: code
                });
                // Do not log SDK errors wholesale: some may contain protocol context.
                console.error('[E2EE] Local client initialization failed', { code });
            }
            throw error;
        } finally {
            if (token === generation) {
                initialization = null;
                initializingUserId = null;
            }
        }
    })();

    initialization = pendingInitialization;
    return pendingInitialization;
};

export const getE2EEClient = () => activeContext?.client ?? null;

export const shutdownE2EEClient = async () => {
    // Invalidate any pending async initialization before closing the active store.
    generation += 1;
    initialization = null;
    initializingUserId = null;

    const context = activeContext;
    activeContext = null;
    await closeResources(context?.client, context?.storage, context?.unsubscribeRelayState, context?.relay);
    publish({ ...initialState });
};

export const subscribeDecryptedE2EEMessages = (listener) => {
    if (typeof listener !== 'function') return () => {};
    decryptedMessageListeners.add(listener);
    return () => decryptedMessageListeners.delete(listener);
};

export const sendE2EEMessage = async (recipientUserId, plaintext) => {
    const client = getE2EEClient();
    if (!client || typeof client.send !== 'function') {
        const error = new Error('E2EE client is not ready to send messages');
        error.code = 'E2EE_CLIENT_NOT_READY';
        throw error;
    }
    const validText = typeof plaintext === 'string' && plaintext.trim().length > 0;
    const validControl = plaintext && typeof plaintext === 'object' && !Array.isArray(plaintext) &&
        ['message', 'edit', 'recall', 'reaction'].includes(plaintext.type) &&
        (plaintext.type !== 'message' || (typeof plaintext.body === 'string' && plaintext.body.trim().length > 0));
    if (!validText && !validControl) {
        const error = new Error('E2EE message payload is empty or has an unsupported control type');
        error.code = 'E2EE_EMPTY_MESSAGE';
        throw error;
    }
    // The SDK serializes DataMessageInput fields and intentionally drops
    // application-specific properties. Wrap app control/message objects as JSON
    // inside the protocol body so conversation IDs, reply IDs, edit/recall
    // operations and idempotency IDs survive encryption unchanged.
    const wireContent = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
    return client.send(String(recipientUserId), { body: wireContent });
};
export const getE2EEStorage = () => activeContext?.storage ?? null;
export const getE2EERelayAdapter = () => activeContext?.relay ?? null;

export const openE2EEProvisioningContext = async (userId) => {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId || !/^[1-9][0-9]*$/.test(normalizedUserId)) {
        const error = new Error('A valid authenticated user ID is required for device provisioning.');
        error.code = 'E2EE_INVALID_USER';
        throw error;
    }
    if (activeContext?.userId === normalizedUserId) {
        return {
            storage: activeContext.storage,
            relay: activeContext.relay,
            close: async () => {}
        };
    }
    const storage = await webSqliteStore({
        name: `student-manager-e2ee-user-${normalizedUserId}.db`
    });
    const relay = createE2EERelayAdapter(normalizedUserId);
    return {
        storage,
        relay,
        close: async () => {
            await closeResources(null, storage);
        }
    };
};
