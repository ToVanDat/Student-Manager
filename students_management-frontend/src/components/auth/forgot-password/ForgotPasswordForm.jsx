import { useForgotPassword } from '@/hooks/useForgotPassword.js';
import EmailStep from '@/components/auth/forgot-password/EmailStep.jsx';
import OtpStep from '@/components/auth/forgot-password/OtpStep.jsx';
import ResetPasswordStep from '@/components/auth/forgot-password/ResetPasswordStep.jsx';

function ForgotPasswordForm({ onLogin, setError, setSuccess }) {
    const flow = useForgotPassword({ onLogin, setError, setSuccess });

    if (flow.step === 'email') {
        return (
            <EmailStep
                email={flow.email}
                onEmailChange={flow.setEmail}
                onSubmit={flow.handleSendOtp}
                onLogin={onLogin}
                loading={flow.loading}
            />
        );
    }

    if (flow.step === 'otp') {
        return (
            <OtpStep
                email={flow.email}
                otp={flow.otp}
                onOtpChange={flow.setOtp}
                onSubmit={flow.handleVerifyOtp}
                onBack={flow.handleBackToEmail}
                onResend={flow.handleResendOtp}
                loading={flow.loading}
                resendCooldown={flow.resendCooldown}
            />
        );
    }

    return (
        <ResetPasswordStep
            newPassword={flow.newPassword}
            onNewPasswordChange={flow.setNewPassword}
            confirmPassword={flow.confirmPassword}
            onConfirmPasswordChange={flow.setConfirmPassword}
            onSubmit={flow.handleResetPassword}
            loading={flow.loading}
        />
    );
}

export default ForgotPasswordForm;