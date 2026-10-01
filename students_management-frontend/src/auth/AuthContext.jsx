import {
    createContext,
    useEffect,
    useState
} from 'react';

import { logoutApi } from '../service/authApi.js';
import socket from '../socket/socket.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

    const [accessToken, setAccessToken] = useState(
        localStorage.getItem('accessToken')
    );

    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');

        return savedUser
            ? JSON.parse(savedUser)
            : null;
    });

//login
    const loginUser = (data) => {

        console.log('LOGIN DATA:', data);

        localStorage.setItem(
            'accessToken',
            data.accessToken
        );

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
                isAuthenticated: !!accessToken
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;