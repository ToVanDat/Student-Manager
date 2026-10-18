import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
    getE2EEClientState,
    initializeE2EEClient,
    shutdownE2EEClient,
    subscribeE2EEClientState
} from '@/services/e2ee/e2eeClient';

/**
 * Exposes local protocol-store readiness only. It does not activate E2EE for
 * any conversation and must not be used as permission to send plaintext or
 * ciphertext until a compatible relay and the chat send/receive pipeline exist.
 */
export const useE2EEClient = () => {
    const { user } = useAuth();
    const userId = user?.id == null ? null : String(user.id);
    const [clientState, setClientState] = useState(getE2EEClientState);

    useEffect(() => subscribeE2EEClientState(setClientState), []);

    useEffect(() => {
        let cancelled = false;

        if (!userId) {
            void shutdownE2EEClient().catch((error) => {
                console.error('[E2EE] Could not close local client', {
                    code: error?.code || 'E2EE_SHUTDOWN_FAILED'
                });
            });
            return () => {
                cancelled = true;
            };
        }

        initializeE2EEClient(userId).catch((error) => {
            if (cancelled) return;
            setClientState({
                status: 'error',
                userId,
                deviceId: null,
                relayState: 'not-configured',
                errorCode: error?.code || 'E2EE_LOCAL_STORE_FAILED'
            });
        });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    return {
        ...clientState,
        isLocalStoreReady: clientState.status === 'local-ready',
        isRelayConnected: clientState.relayState === 'connected'
    };
};
