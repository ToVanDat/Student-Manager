import { useForgotPassword } from '@/hooks/useForgotPassword.js';
import EmailStep from '@/components/auth/forgot-password/EmailStep.jsx';
import OtpStep from '@/components/auth/forgot-password/OtpStep.jsx';
import ResetPasswordStep from '@/components/auth/forgot-password/ResetPasswordStep.jsx';
import AuthStepper from '@/components/auth/AuthStepper.jsx';

const FORGOT_STEPS = ['forgotStepEmail', 'forgotStepOtp', 'forgotStepPassword'];

function ForgotPasswordForm({ onLogin, setError, setSuccess }) {
    const flow = useForgotPassword({ onLogin, setError, setSuccess });
    const currentStep = flow.step === 'email' ? 0 : flow.step === 'otp' ? 1 : 2;

    return (
        <div data-ui-region="password-recovery" aria-busy={flow.loading} className="w-full">
            <div aria-live="polite" aria-atomic="true" className="sr-only">{`Step ${currentStep + 1} of ${FORGOT_STEPS.length}`}</div>
            <AuthStepper steps={FORGOT_STEPS} currentStep={currentStep} />
            {flow.step === 'email' && (
                <EmailStep
                    key={flow.step}
                    email={flow.email}
                    onEmailChange={flow.setEmail}
                    onSubmit={flow.handleSendOtp}
                    onLogin={onLogin}
                    loading={flow.loading}
                />
            )}
            {flow.step === 'otp' && (
                <OtpStep
                    key={flow.step}
                    email={flow.email}
                    otp={flow.otp}
                    onOtpChange={flow.setOtp}
                    onSubmit={flow.handleVerifyOtp}
                    onBack={flow.handleBackToEmail}
                    onResend={flow.handleResendOtp}
                    loading={flow.loading}
                    resendCooldown={flow.resendCooldown}
                />
            )}
            {flow.step === 'reset' && (
                <ResetPasswordStep
                    key={flow.step}
                    newPassword={flow.newPassword}
                    onNewPasswordChange={flow.setNewPassword}
                    confirmPassword={flow.confirmPassword}
                    onConfirmPasswordChange={flow.setConfirmPassword}
                    onSubmit={flow.handleResetPassword}
                    onBack={flow.handleBackToOtp}
                    loading={flow.loading}
                />
            )}
        </div>
    );
}

export default ForgotPasswordForm;