import { useEffect, useRef, useState } from 'react';
import {
    forgotPasswordApi,
    resetPasswordApi,
    verifyResetOtpApi,
} from '@/api/authApi.js';

export function useForgotPassword({ onLogin, setError, setSuccess }) {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const loginTimer = useRef(null);

    useEffect(() => () => clearTimeout(loginTimer.current), []);

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;

        const timer = setInterval(() => {
            setResendCooldown((remaining) => Math.max(0, remaining - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [resendCooldown]);

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const handleSendOtp = async (event) => {
        event.preventDefault();
        clearMessages();

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError('Vui lòng nhập email');
            return;
        }

        setLoading(true);
        try {
            const data = await forgotPasswordApi(normalizedEmail);
            setEmail(normalizedEmail);
            setSuccess(data.message || 'Mã OTP đã được gửi đến email của bạn.');
            setStep('otp');
            setResendCooldown(60);
        } catch (error) {
            console.error('FORGOT PASSWORD ERROR:', error);
            setError(error.response?.data?.message || 'Không thể xử lý yêu cầu');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        clearMessages();

        if (!otp.trim()) {
            setError('Vui lòng nhập mã OTP');
            return;
        }
        if (!/^\d{6}$/.test(otp)) {
            setError('Mã OTP phải gồm 6 số');
            return;
        }

        setLoading(true);
        try {
            const data = await verifyResetOtpApi(email, otp);
            if (!data?.resetToken) {
                setError('Xác thực OTP thành công nhưng không nhận được reset token');
                return;
            }
            setResetToken(data.resetToken);
            setSuccess(data.message || 'Xác thực OTP thành công.');
            setStep('reset');
        } catch (error) {
            console.error('VERIFY OTP ERROR:', error);
            setError(error.response?.data?.message || 'Mã OTP không hợp lệ');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (loading || resendCooldown > 0) return;
        clearMessages();

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError('Email không hợp lệ');
            return;
        }

        setLoading(true);
        try {
            const data = await forgotPasswordApi(normalizedEmail);
            setSuccess(data.message || 'Mã OTP mới đã được gửi.');
            setResendCooldown(60);
            setOtp('');
        } catch (error) {
            console.error('RESEND OTP ERROR:', error);
            setError(error.response?.data?.message || 'Không thể gửi lại mã OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        clearMessages();

        if (!newPassword) {
            setError('Vui lòng nhập mật khẩu mới');
            return;
        }
        if (newPassword.length < 8) {
            setError('Mật khẩu mới phải có ít nhất 8 ký tự');
            return;
        }
        if (!confirmPassword) {
            setError('Vui lòng xác nhận mật khẩu');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }
        if (!resetToken) {
            setError('Phiên đặt lại mật khẩu không hợp lệ');
            return;
        }

        setLoading(true);
        try {
            const data = await resetPasswordApi(resetToken, newPassword);
            setSuccess(data.message || 'Đặt lại mật khẩu thành công.');
            setOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setResetToken('');
            setResendCooldown(0);
            loginTimer.current = setTimeout(onLogin, 2000);
        } catch (error) {
            console.error('RESET PASSWORD ERROR:', error);
            setError(error.response?.data?.message || 'Không thể đặt lại mật khẩu');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToEmail = () => {
        clearMessages();
        setOtp('');
        setResetToken('');
        setResendCooldown(0);
        setStep('email');
    };

    return {
        step,
        email,
        setEmail,
        otp,
        setOtp,
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        loading,
        resendCooldown,
        handleSendOtp,
        handleVerifyOtp,
        handleResendOtp,
        handleResetPassword,
        handleBackToEmail,
    };
}