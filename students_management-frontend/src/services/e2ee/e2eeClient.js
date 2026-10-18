import { createSignalProtocolClient } from '@open-e2ee/signal-protocol-sdk';
import { webSqliteStore } from '@open-e2ee/signal-protocol-sdk/local/store/web-sqlite';

const listeners = new Set();
let activeContext = null;
let initialization = null;

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

export const getE2EEClientState = () => ({ ...state });

export const subscribeE2EEClientState = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(getE2EEClientState());
    return () => listeners.delete(listener);
};

/**
 * Opens the SDK-managed, encrypted browser store for one account and creates
 * a local Signal Protocol client. No relay is attached in this foundation step:
 * this function intentionally does not enable messaging or upload key material.
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

    if (initialization) {
        const pending = initialization;
        try {
            const existing = await pending;
            if (activeContext?.userId === normalizedUserId) return existing;
        } catch {
            // The next account gets its own initialization attempt below.
        }
    }

    initialization = (async () => {
        publish({
            status: 'initializing',
            userId: normalizedUserId,
            deviceId: null,
            relayState: 'not-configured',
            errorCode: null
        });

        if (activeContext) {
            await shutdownE2EEClient();
        }

        let storage;
        let client;
        try {
            storage = await webSqliteStore({
                name: `student-manager-e2ee-user-${normalizedUserId}.db`
            });

            client = await createSignalProtocolClient({
                identity: { userId: normalizedUserId },
                adapters: { storage }
            });

            activeContext = {
                userId: normalizedUserId,
                storage,
                client
            };

            publish({
                status: 'local-ready',
                userId: normalizedUserId,
                deviceId: client.deviceId ?? 1,
                relayState: 'not-configured',
                errorCode: null
            });

            return client;
        } catch (error) {
            try {
                if (client && typeof client.stop === 'function') await client.stop();
            } catch {
                // Preserve the initialization error.
            }
            try {
                if (storage && typeof storage.close === 'function') await storage.close();
            } catch {
                // Preserve the initialization error.
            }

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
            throw error;
        } finally {
            initialization = null;
        }
    })();

    return initialization;
};

export const getE2EEClient = () => activeContext?.client ?? null;

export const shutdownE2EEClient = async () => {
    const context = activeContext;
    activeContext = null;

    if (context?.client && typeof context.client.stop === 'function') {
        await context.client.stop();
    }
    if (context?.storage && typeof context.storage.close === 'function') {
        await context.storage.close();
    }

    publish({ ...initialState });
};
