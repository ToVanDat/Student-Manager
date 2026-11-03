import { useForgotPassword } from '@/hooks/useForgotPassword.js';
import EmailStep from '@/components/auth/forgot-password/EmailStep.jsx';
import OtpStep from '@/components/auth/forgot-password/OtpStep.jsx';
import ResetPasswordStep from '@/components/auth/forgot-password/ResetPasswordStep.jsx';
import AuthStepper from '@/components/auth/AuthStepper.jsx';

const FORGOT_STEPS = ['forgotStepEmail', 'forgotStepOtp', 'forgotStepPassword'];

function ForgotPasswordForm({ onLogin, setError, setSuccess, error, success }) {
    const flow = useForgotPassword({ onLogin, setError, setSuccess });
    const currentStep = flow.step === 'email' ? 0 : flow.step === 'otp' ? 1 : 2;

    return (
        <div data-ui-region="password-recovery" aria-busy={flow.loading} className="w-full">
            {error && <div role="alert" aria-live="polite" className="mb-4 w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
            {success && <div role="status" aria-live="polite" className="mb-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
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