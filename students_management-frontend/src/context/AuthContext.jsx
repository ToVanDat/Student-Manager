import {
    createContext,
    useEffect,
    useState,
    useCallback
} from 'react';

import { logoutApi } from '@/api/authApi.js';
import {
    refreshAccessToken,
    setAccessToken as setApiAccessToken
} from '@/api/client.js';
import socket from '@/socket/socket.js';
import useWebRTCCall from '@/hooks/useWebRTCCall.js';
import { shutdownE2EEClient } from '@/services/e2ee/e2eeClient';

const AuthContext = createContext(null);

const getStoredUser = () => {
    try {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    } catch {
        localStorage.removeItem('user');
        return null;
    }
};

export const AuthProvider = ({ children }) => {

    // Call state must live above route pages so an incoming call is received
    // even when the user is on Dashboard/Home instead of ChatPage.
    const webRTCCall = useWebRTCCall();

    // Access tokens are intentionally memory-only. A cached profile is display
    // data, never proof of authentication; the refresh cookie restores the session.
    const [accessToken, setAccessToken] = useState(null);
    const [user, setUser] = useState(getStoredUser);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [authRestoreError, setAuthRestoreError] = useState('');

    // Cross-tab fallback: a logout in one tab also clears cached auth in
    // sibling tabs even if their Socket.IO connection was temporarily asleep.
    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== 'user' || event.newValue !== null) return;
            if (sessionStorage.getItem('auth:login-in-progress') === 'true') return;

            void shutdownE2EEClient().catch(() => {});
            setApiAccessToken(null);
            setAccessToken(null);
            setUser(null);
            setAuthRestoreError('');
            socket.disconnect();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Đồng bộ khi Axios interceptor refresh token sau một request 401.
    useEffect(() => {
        const handleTokenChanged = (event) => {
            const nextToken = event.detail?.accessToken || null;
            setAccessToken(nextToken);

            if (!nextToken) {
                void shutdownE2EEClient().catch(() => {});
                localStorage.removeItem('user');
                setUser(null);
            }
        };

        const handleSessionInvalid = () => {
            void shutdownE2EEClient().catch(() => {});
            localStorage.removeItem('user');
            setUser(null);
            setAccessToken(null);
            setIsAuthLoading(false);
            setAuthRestoreError('');
            socket.disconnect();
        };

        window.addEventListener('auth:access-token-changed', handleTokenChanged);
        window.addEventListener('auth:session-invalid', handleSessionInvalid);

        return () => {
            window.removeEventListener('auth:access-token-changed', handleTokenChanged);
            window.removeEventListener('auth:session-invalid', handleSessionInvalid);
        };
    }, []);

    // Restore the session from the HttpOnly refresh cookie after a hard reload.
    // A transient network/5xx failure is not proof that the user is logged out.
    const restoreSession = useCallback(async () => {
        setIsAuthLoading(true);
        setAuthRestoreError('');
        try {
            await refreshAccessToken();
        } catch (error) {
            if (error.response?.status !== 401) {
                console.warn('[AUTH] Session restoration temporarily failed:', error.message);
                setAuthRestoreError('Không thể kết nối dịch vụ xác thực. Phiên đăng nhập chưa được xác định; hãy thử lại khi kết nối ổn định.');
            } else {
                setAuthRestoreError('');
                setApiAccessToken(null);
            }
        } finally {
            setIsAuthLoading(false);
        }
    }, []);

    useEffect(() => {
        void restoreSession();
    }, [restoreSession]);

const updateUser = (partialUser) => {
        setUser(previous => {
            const nextUser = { ...(previous || {}), ...(partialUser || {}) };
            localStorage.setItem('user', JSON.stringify(nextUser));
            return nextUser;
        });
    };

    //login
    const loginUser = (data) => {

        setApiAccessToken(data.accessToken);

        localStorage.setItem(
            'user',
            JSON.stringify(data.user)
        );

        setAccessToken(data.accessToken);
        setUser(data.user);
        setAuthRestoreError('');
        setIsAuthLoading(false);
    };

    // =========================
    // LOGOUT
    // =========================
    const logoutUser = async () => {

        try {
            await logoutApi();

        } catch (error) {

            console.error(
                'Logout API error:',
                error
            );

        } finally {

            // Close the active protocol client and relay listeners before clearing
            // authentication state. The local key store is intentionally preserved.
            try {
                await shutdownE2EEClient();
            } catch {
                console.warn('[E2EE] Could not cleanly shut down the local client.');
            }

            socket.disconnect();

            setApiAccessToken(null);

            localStorage.removeItem(
                'user'
            );

            setAccessToken(null);
            setUser(null);
            setAuthRestoreError('');
        }
    };

    // =========================
    // PROACTIVE ACCESS TOKEN REFRESH
    // =========================
    useEffect(() => {
        if (!accessToken) return;

        let timerId;

        const scheduleRefresh = (token) => {
            try {
                const payload = JSON.parse(
                    atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
                );

                if (!payload.exp) {
                    console.warn('Access token không có exp');
                    return;
                }

                // Refresh trước khi hết hạn 60 giây.
                const delay = Math.max(
                    (payload.exp * 1000) - Date.now() - 60_000,
                    5_000
                );

                timerId = window.setTimeout(async () => {
                    try {
                        const newToken = await refreshAccessToken();
                        setAccessToken(newToken);
                    } catch (error) {
                        console.warn('Không thể tự refresh Access Token:', error.message);

                        // Only a definitive 401 means the refresh credential is
                        // invalid/revoked. A temporary network/5xx failure should
                        // retry later rather than logging the user out.
                        if (error.response?.status !== 401) {
                            timerId = window.setTimeout(async () => {
                                try {
                                    setAccessToken(await refreshAccessToken());
                                } catch (retryError) {
                                    if (retryError.response?.status === 401) {
                                        void shutdownE2EEClient().catch(() => {});
                                        socket.disconnect();
                                        setApiAccessToken(null);
                                        localStorage.removeItem('user');
                                        setAccessToken(null);
                                        setUser(null);
                                        window.location.href = '/login';
                                    } else {
                                        console.warn('Refresh vẫn tạm thời thất bại:', retryError.message);
                                    }
                                }
                            }, 10_000);
                            return;
                        }

                        void shutdownE2EEClient().catch(() => {});
                        socket.disconnect();
                        setApiAccessToken(null);
                        localStorage.removeItem('user');
                        setAccessToken(null);
                        setUser(null);
                        window.location.href = '/login';
                    }
                }, delay);
            } catch (error) {
                console.error('Không thể đọc exp của Access Token:', error);
            }
        };

        scheduleRefresh(accessToken);

        return () => {
            if (timerId) window.clearTimeout(timerId);
        };
    }, [accessToken]);

    // Global notification toast and sound, available on every authenticated route.
    useEffect(() => {
        if (!accessToken || !user?.id) return undefined;
        let active = true;

        const handleNotification = async notification => {
            if (!active || !notification) return;
            const isAwayFromChat = document.visibilityState === 'hidden' || window.location.pathname !== '/chat';
            if (isAwayFromChat) {
                const { toast } = await import('sonner');
                toast(notification.title || 'Tin nhắn mới', {
                    description: notification.body || 'Bạn có tin nhắn mới.',
                    duration: 4500,
                    id: `notification-${notification.id}`
                });
            }
            if (isAwayFromChat && notification.soundEnabled !== false) {
                const { playSound } = await import('@/services/soundService.js');
                await playSound('notification', { volume: 0.55 });
            }
        };

        socket.on('notification:new', handleNotification);
        return () => {
            active = false;
            socket.off('notification:new', handleNotification);
        };
    }, [accessToken, user?.id]);

    useEffect(() => {
        if (!accessToken || !user?.id) return undefined;
        const handleProfileUpdated = profile => {
            if (Number(profile?.userId) !== Number(user.id)) return;
            setUser(previous => {
                if (!previous) return previous;
                const nextUser = {
                    ...previous,
                    username: profile.username || previous.username,
                    avatar_url: profile.avatarUrl || null
                };
                localStorage.setItem('user', JSON.stringify(nextUser));
                return nextUser;
            });
        };
        socket.on('user:profile-updated', handleProfileUpdated);
        return () => socket.off('user:profile-updated', handleProfileUpdated);
    }, [accessToken, user?.id]);

    // =========================
    // SOCKET CONNECTION
    // =========================
    useEffect(() => {
        if (!accessToken) {
            socket.disconnect();
            return;
        }

        // Keep the socket lifecycle independent from access-token state.
        // Updating the JWT must not force a disconnect during an active call.
        socket.auth = { accessToken };

        const syncSocketToken = () => {
            if (!socket.connected || !accessToken) return;

            socket.emit('auth:token-refresh', { accessToken }, (result) => {
                if (!result?.ok) {
                    console.warn('[SOCKET][token refresh rejected]', result?.message || 'Unknown error');
                } else {
                    console.log('[SOCKET][token refreshed]', socket.id);
                }
            });
        };

        const handleConnect = () => {
            console.log('[SOCKET][connect]', socket.id);
            syncSocketToken();
        };

        const handleSessionRevoked = (data) => {
            console.log('[SOCKET][session revoked]', data);

            const revokeReason = String(data?.reason || '').toUpperCase();

            // Explicit logout is synchronized to every tab in the session. Clear
            // local auth silently: never show the forced-login warning.
            if (revokeReason === 'LOGOUT') {
                void shutdownE2EEClient().catch(() => {});
                setApiAccessToken(null);
                localStorage.removeItem('user');
                setAccessToken(null);
                setUser(null);
                setAuthRestoreError('');
                socket.disconnect();
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return;
            }

            // A login in this same tab intentionally replaces its previous
            // session. Do not let the old socket event clear the new login.
            if (sessionStorage.getItem('auth:login-in-progress') === 'true') {
                return;
            }

            // Ignore delayed revoke events for a session that is no longer
            // the one represented by the currently stored access token.
            const currentToken = accessToken;
            let currentSessionId = null;
            try {
                const payload = currentToken?.split('.')?.[1];
                if (payload) {
                    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
                    currentSessionId = JSON.parse(
                        decodeURIComponent(
                            atob(normalized).split('').map(char =>
                                '%' + char.charCodeAt(0).toString(16).padStart(2, '0')
                            ).join('')
                        )
                    )?.sessionId;
                }
            } catch {
                currentSessionId = null;
            }

            if (
                data?.sessionId != null &&
                currentSessionId != null &&
                String(data.sessionId) !== String(currentSessionId)
            ) {
                return;
            }

            alert(
                'Phiên đăng nhập của bạn đã kết thúc. ' +
                'Tài khoản vừa được đăng nhập trên một thiết bị khác.'
            );

            localStorage.removeItem('user');
            setApiAccessToken(null);
            setAccessToken(null);
            setUser(null);
            socket.disconnect();
            window.location.href = '/login';
        };

        const handleConnectError = (error) => {
            // The old socket can fail authentication while this tab is
            // replacing its session. Do not refresh the old refresh cookie or
            // clear the newly-authenticating state during that race.
            if (sessionStorage.getItem('auth:login-in-progress') === 'true') {
                console.warn('[SOCKET][connect error ignored during login]', error.message);
                return;
            }

            console.error('[SOCKET][connect error]', error.message);

            // Only refresh the token here when the server explicitly rejects
            // the socket authentication. Normal call/WebRTC errors must not
            // trigger an auth refresh.
            if (/Access Token|token|Session/i.test(error.message || '')) {
                refreshAccessToken()
                    .then((newToken) => {
                        // Update auth for the next socket handshake.
                        socket.auth = { accessToken: newToken };
                        setAccessToken(newToken);
                    })
                    .catch((refreshError) => {
                        if (refreshError.response?.status !== 401) {
                            console.warn('[SOCKET][refresh deferred]', refreshError.message);
                            return;
                        }
                        setApiAccessToken(null);
                        localStorage.removeItem('user');
                        setAccessToken(null);
                        setUser(null);
                        socket.disconnect();
                        window.location.href = '/login';
                    });
            }
        };

        const handleSocketDisconnect = (reason) => {
            console.warn('[SOCKET][disconnect]', {
                reason,
                socketId: socket.id
            });

            // Ordinary transport/network loss is recovered by Socket.IO.
            // A server-initiated namespace disconnect is different: Socket.IO
            // will not reconnect automatically. Refresh once so an expired AT
            // can recover, while a revoked session is rejected by the API.
            if (
                reason === 'io server disconnect' &&
                sessionStorage.getItem('auth:login-in-progress') !== 'true'
            ) {
                refreshAccessToken()
                    .then((newToken) => {
                        setAccessToken(newToken);
                    })
                    .catch((refreshError) => {
                        if (refreshError.response?.status !== 401) {
                            console.warn('[SOCKET][reconnect deferred]', refreshError.message);
                            return;
                        }

                        void shutdownE2EEClient().catch(() => {});
                        setApiAccessToken(null);
                        localStorage.removeItem('user');
                        setAccessToken(null);
                        setUser(null);
                        setAuthRestoreError('');
                        socket.disconnect();
                        if (window.location.pathname !== '/login') {
                            window.location.href = '/login';
                        }
                    });
            }
        };

        socket.on('connect', handleConnect);
        socket.on('session:revoked', handleSessionRevoked);
        socket.on('connect_error', handleConnectError);
        socket.on('disconnect', handleSocketDisconnect);

        if (socket.connected) {
            syncSocketToken();
        } else {
            socket.connect();
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('session:revoked', handleSessionRevoked);
            socket.off('connect_error', handleConnectError);
            socket.off('disconnect', handleSocketDisconnect);

            // IMPORTANT:
            // Do not disconnect here merely because accessToken changed.
            // The next render updates socket.auth and Socket.IO can reconnect
            // without destroying the active call lifecycle.
        };
    }, [accessToken]);

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                user,
                loginUser,
                logoutUser,
                updateUser,
                isAuthenticated: !!accessToken,
                isAuthLoading,
                authRestoreError,
                retrySessionRestore: restoreSession,
                webRTCCall
            }}
        >
            {children}

        </AuthContext.Provider>
    );
};

export default AuthContext;