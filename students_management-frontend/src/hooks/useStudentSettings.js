import { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { apiClient } from '@/api/client.js';
import {
    getSessionsApi,
    revokeOtherSessionsApi,
    revokeSessionApi,
} from '@/api/sessionApi.js';

export function useStudentSettings(user, updateUser) {
    const [settingsTab, setSettingsTab] = useState('account');
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [accountForm, setAccountForm] = useState({
        username: user?.username || '',
        full_name: user?.full_name || '',
        email: user?.email || '',
    });
    const [accountSaving, setAccountSaving] = useState(false);
    const [accountMessage, setAccountMessage] = useState('');
    const [accountError, setAccountError] = useState('');
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        setAccountForm({
            username: user?.username || '',
            full_name: user?.full_name || '',
            email: user?.email || '',
        });
    }, [user]);

    const loadSessions = async () => {
        try {
            setSessionsLoading(true);
            setSessionsError('');

            const data = await getSessionsApi();
            const sessionList = Array.isArray(data)
                ? data
                : Array.isArray(data?.sessions)
                  ? data.sessions
                  : [];

            setSessions(sessionList);
            // The backend derives this from the verified access token. AT is
            // intentionally memory-only, so the UI must not read localStorage.
            setCurrentSessionId(data?.currentSessionId ?? null);
        } catch (error) {
            console.error('LOAD SESSIONS ERROR:', error);
            setSessionsError(
                error.response?.data?.message ||
                    'Không thể tải danh sách phiên đăng nhập.',
            );
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleRevokeSession = async (sessionId) => {
        if (!sessionId || !window.confirm('Bạn có chắc muốn đăng xuất phiên này?')) {
            return;
        }

        try {
            await revokeSessionApi(sessionId);
            await loadSessions();
        } catch (error) {
            console.error('REVOKE SESSION ERROR:', error);
            alert(error.response?.data?.message || 'Không thể đăng xuất phiên này.');
        }
    };

    const handleRevokeOtherSessions = async () => {
        if (!window.confirm('Bạn có chắc muốn đăng xuất tất cả thiết bị khác?')) {
            return;
        }

        try {
            await revokeOtherSessionsApi();
            await loadSessions();
        } catch (error) {
            console.error('REVOKE OTHER SESSIONS ERROR:', error);
            alert(
                error.response?.data?.message ||
                    'Không thể đăng xuất các thiết bị khác.',
            );
        }
    };

    const handleUpdateAccount = async (event) => {
        event.preventDefault();
        setAccountMessage('');
        setAccountError('');

        const fullName = String(accountForm.full_name || '').trim();
        const email = String(accountForm.email || '').trim().toLowerCase();
        if (!fullName) {
            setAccountError('Vui lòng nhập tên hiển thị.');
            return;
        }
        if (fullName.length > 120) {
            setAccountError('Tên hiển thị không được vượt quá 120 ký tự.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            setAccountError('Vui lòng nhập địa chỉ email hợp lệ.');
            return;
        }

        setAccountSaving(true);
        try {
            const response = await apiClient.patch('/api/auth/me', {
                full_name: fullName,
                email,
            });

            if (response.data?.user) {
                updateUser?.(response.data.user);
                setAccountForm({
                    username: response.data.user.username || user?.username || '',
                    full_name: response.data.user.full_name || '',
                    email: response.data.user.email || '',
                });
            }
            setAccountMessage('Cập nhật thông tin tài khoản thành công.');
        } catch (error) {
            console.error('UPDATE ACCOUNT ERROR:', error);
            setAccountError(error.response?.data?.message || 'Cập nhật tài khoản thất bại.');
        } finally {
            setAccountSaving(false);
        }
    };

    const handleChangePassword = async (event) => {
        event.preventDefault();
        setPasswordMessage('');
        setPasswordError('');

        if (
            !passwordForm.currentPassword ||
            !passwordForm.newPassword ||
            !passwordForm.confirmPassword
        ) {
            setPasswordError('Vui lòng nhập đầy đủ thông tin.');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('Mật khẩu xác nhận không khớp.');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
            return;
        }

        try {
            setPasswordSaving(true);
            await apiClient.post(
                '/api/auth/change-password',
                {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                },
            );

            setPasswordMessage('Đổi mật khẩu thành công.');
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error) {
            console.error('CHANGE PASSWORD ERROR:', error);
            setPasswordError(
                error.response?.data?.message || 'Đổi mật khẩu thất bại.',
            );
        } finally {
            setPasswordSaving(false);
        }
    };

    const formatSessionDate = (value) => {
        if (!value) {
            return 'Không có dữ liệu';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Không xác định';
        }

        return date.toLocaleString('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    const getSessionIcon = (session) => {
        const value =
            `${session?.device_name || ''} ${session?.user_agent || ''}`.toLowerCase();

        if (
            value.includes('mobile') ||
            value.includes('android') ||
            value.includes('iphone')
        ) {
            return Smartphone;
        }

        return Monitor;
    };

    return {
        settingsTab,
        setSettingsTab,
        sessions,
        sessionsLoading,
        sessionsError,
        currentSessionId,
        accountForm,
        setAccountForm,
        accountSaving,
        accountMessage,
        accountError,
        passwordForm,
        setPasswordForm,
        passwordSaving,
        passwordMessage,
        passwordError,
        loadSessions,
        handleRevokeSession,
        handleRevokeOtherSessions,
        handleUpdateAccount,
        handleChangePassword,
        formatSessionDate,
        getSessionIcon,
    };
}