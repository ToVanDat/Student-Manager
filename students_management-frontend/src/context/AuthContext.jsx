import {
    createContext,
    useEffect,
    useState
} from 'react';

import { logoutApi } from '@/api/authApi.js';
import {
    refreshAccessToken,
    setAccessToken as setApiAccessToken
} from '@/api/client.js';
import socket from '@/socket/socket.js';
import useWebRTCCall from '@/hooks/useWebRTCCall.js';
import CallPanel from '@/components/call/CallPanel.jsx';

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

    const [accessToken, setAccessToken] = useState(
        localStorage.getItem('accessToken')
    );

    const [user, setUser] = useState(getStoredUser);

    // Đồng bộ khi Axios interceptor refresh token sau một request 401.
    useEffect(() => {
        const handleTokenChanged = (event) => {
            const nextToken = event.detail?.accessToken || null;
            setAccessToken(nextToken);

            if (!nextToken) {
                setUser(null);
            }
        };

        window.addEventListener(
            'auth:access-token-changed',
            handleTokenChanged
        );

        return () => {
            window.removeEventListener(
                'auth:access-token-changed',
                handleTokenChanged
            );
        };
    }, []);

//login
    const loginUser = (data) => {

        console.log('LOGIN DATA:', data);

        setApiAccessToken(data.accessToken);

        localStorage.setItem(
            'user',
            JSON.stringify(data.user)
        );

        setAccessToken(data.accessToken);
        setUser(data.user);
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

            socket.disconnect();

            localStorage.removeItem(
                'accessToken'
            );

            localStorage.removeItem(
                'user'
            );

            setAccessToken(null);
            setUser(null);
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
                        console.error(
                            'Không thể tự refresh Access Token:',
                            error
                        );

                        socket.disconnect();
                        localStorage.removeItem('accessToken');
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

    // =========================
    // SOCKET CONNECTION
    // =========================
    useEffect(() => {

        if (!accessToken) {
            socket.disconnect();
            return;
        }

        // Gửi access token đến backend
        socket.auth = {
            accessToken
        };

        // Kết nối Socket.IO
        socket.connect();

        // =========================
        // CONNECT
        // =========================
        const handleConnect = () => {

            console.log(
                'Socket connected:',
                socket.id
            );
        };

        // =========================
        // SESSION REVOKED
        // =========================
        const handleSessionRevoked = (data) => {

            console.log(
                'Session revoked:',
                data
            );

            alert(
                'Phiên đăng nhập của bạn đã kết thúc. ' +
                'Tài khoản vừa được đăng nhập trên một thiết bị khác.'
            );

            localStorage.removeItem(
                'accessToken'
            );

            localStorage.removeItem(
                'user'
            );

            setAccessToken(null);
            setUser(null);

            socket.disconnect();

            window.location.href = '/login';
        };

        // =========================
        // CONNECTION ERROR
        // =========================
        const handleConnectError = (error) => {

            console.error(
                'Socket connection error:',
                error.message
            );

            if (
                /Access Token|token|Session/i.test(error.message || '')
            ) {
                refreshAccessToken()
                    .then((newToken) => {
                        setAccessToken(newToken);
                    })
                    .catch(() => {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('user');
                        setAccessToken(null);
                        setUser(null);
                        window.location.href = '/login';
                    });
            }
        };

        const handleSocketDisconnect = (reason) => {
            // Server-side disconnect (ví dụ access token đã hết hạn).
            // Refresh rồi reconnect với token mới.
            if (
                reason === 'io server disconnect' ||
                reason === 'server namespace disconnect'
            ) {
                refreshAccessToken()
                    .then((newToken) => {
                        setAccessToken(newToken);
                    })
                    .catch(() => {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('user');
                        setAccessToken(null);
                        setUser(null);
                        window.location.href = '/login';
                    });
            }
        };

        socket.on(
            'connect',
            handleConnect
        );

        socket.on(
            'session:revoked',
            handleSessionRevoked
        );

        socket.on(
            'connect_error',
            handleConnectError
        );

        socket.on(
            'disconnect',
            handleSocketDisconnect
        );

        // =========================
        // CLEANUP
        // =========================
        return () => {

            socket.off(
                'connect',
                handleConnect
            );

            socket.off(
                'session:revoked',
                handleSessionRevoked
            );

            socket.off(
                'connect_error',
                handleConnectError
            );

            socket.off(
                'disconnect',
                handleSocketDisconnect
            );

            socket.disconnect();
        };

    }, [accessToken]);

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                user,
                loginUser,
                logoutUser,
                isAuthenticated: !!accessToken,
                webRTCCall
            }}
        >
            {children}

            {accessToken && (
                <CallPanel
                    {...webRTCCall}
                    targetUsername={webRTCCall.call?.remoteUsername || 'User'}
                />
            )}
        </AuthContext.Provider>
    );
};

export default AuthContext;