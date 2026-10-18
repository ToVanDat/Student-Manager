import { createSignalProtocolClient } from '@open-e2ee/signal-protocol-sdk';
import { webSqliteStore } from '@open-e2ee/signal-protocol-sdk/local/store/web-sqlite';
import { createE2EERelayAdapter } from './e2eeRelayAdapter';
import { e2eeRelayApi } from '@/api/e2eeRelayApi';
import { createE2EER2ObjectStore } from './e2eeR2ObjectStore';
import { getStoredE2EEDeviceId, setStoredE2EEDeviceId } from './e2eeDeviceStateStore';

const listeners = new Set();
let activeContext = null;
let initialization = null;
let initializingUserId = null;
let generation = 0;
const decryptedMessageListeners = new Set();
let activeAttachmentConversationId = null;

export const setE2EEAttachmentConversationId = (conversationId) => {
    const value = Number(conversationId);
    activeAttachmentConversationId = Number.isSafeInteger(value) && value > 0 ? value : null;
};

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
                adapters: { storage, relay, remoteObjectStore: createE2EER2ObjectStore({ getConversationId: () => activeAttachmentConversationId }) }
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
            // If subscription startup failed after publishing activeContext, do not
            // leave a closed client visible to later callers as if it were usable.
            if (activeContext?.userId === normalizedUserId && activeContext.client === client) {
                activeContext = null;
            }
            await closeResources(client, storage, unsubscribeRelayState, relay);
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
/**
 * Uploads a file through the SDK's encrypted attachment flow. The SDK encrypts
 * bytes locally and returns a pointer that must itself be sent inside an E2EE
 * message. This helper deliberately does not fall back to the legacy upload API.
 */
export const uploadE2EEAttachment = async (file, { onProgress } = {}) => {
    const client = getE2EEClient();
    if (!client || typeof client.uploadAttachment !== 'function') {
        const error = new Error('The active Signal client does not support encrypted attachments.');
        error.code = 'E2EE_ATTACHMENT_UNAVAILABLE';
        throw error;
    }
    if (!activeAttachmentConversationId) {
        const error = new Error('Select an E2EE-enabled conversation before uploading an attachment.');
        error.code = 'E2EE_ATTACHMENT_CONVERSATION_REQUIRED';
        throw error;
    }
    if (!(file instanceof Blob) || file.size < 1) {
        const error = new TypeError('A non-empty File or Blob is required for an E2EE attachment.');
        error.code = 'E2EE_ATTACHMENT_INVALID_FILE';
        throw error;
    }

    const mimeType = typeof file.type === 'string' && file.type ? file.type.toLowerCase() : 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const isDocument = mimeType === 'application/pdf'
        || mimeType.startsWith('text/')
        || mimeType.includes('officedocument')
        || mimeType === 'application/msword'
        || mimeType === 'application/zip'
        || mimeType === 'application/octet-stream';
    const maxBytes = isImage ? 20 * 1024 * 1024
        : isVideo ? 500 * 1024 * 1024
            : (isAudio || isDocument) ? 100 * 1024 * 1024
                : 0;
    if (!maxBytes) {
        const error = new Error('Loại tệp này chưa được cho phép gửi qua E2EE.');
        error.code = 'E2EE_ATTACHMENT_TYPE_NOT_ALLOWED';
        throw error;
    }
    if (file.size > maxBytes) {
        const error = new Error('Tệp vượt quá giới hạn kích thước cho loại tệp này.');
        error.code = 'E2EE_ATTACHMENT_TOO_LARGE';
        throw error;
    }
    const allowedContentTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*',
        'application/msword', 'application/zip', 'application/octet-stream',
        'application/vnd.openxmlformats-officedocument.*'];
    return client.uploadAttachment(file, {
        mimeType,
        attachment: {
            policy: {
                maxPlaintextSizeBytes: maxBytes,
                allowedContentTypes
            },
            ...(typeof onProgress === 'function' ? { onProgress } : {})
        }
    });
};

/**
 * Downloads and decrypts a pointer received inside a verified E2EE message.
 * The caller remains responsible for rendering the returned bytes safely.
 */
export const downloadE2EEAttachment = async (pointer, options = {}) => {
    const client = getE2EEClient();
    if (!client || typeof client.downloadAttachment !== 'function') {
        const error = new Error('The active Signal client does not support encrypted attachment downloads.');
        error.code = 'E2EE_ATTACHMENT_UNAVAILABLE';
        throw error;
    }
    if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) {
        const error = new TypeError('A valid E2EE attachment pointer is required.');
        error.code = 'E2EE_ATTACHMENT_POINTER_INVALID';
        throw error;
    }
    return client.downloadAttachment(pointer, options);
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
