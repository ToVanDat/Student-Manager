import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ArrowRight, UserRound, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import AuthStepper from '@/components/auth/AuthStepper.jsx';

const REGISTER_STEPS = ['registerStepAccount', 'registerStepSecurity'];

function RegisterForm({
    username,
    onUsernameChange,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    confirmPassword,
    onConfirmPasswordChange,
    showPassword,
    onTogglePassword,
    showConfirmPassword,
    onToggleConfirmPassword,
    error,
    success,
    loading,
    onSubmit,
    onBackToLogin,
}) {
    const { t } = useLanguage();
    const [step, setStep] = useState(0);

    const handleStepSubmit = (event) => {
        if (step === 0) {
            event.preventDefault();
            setStep(1);
            return;
        }
        onSubmit(event);
    };

    const fieldClass = 'auth-step-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:opacity-60';

    return (
        <div data-ui-region="register-flow" className="w-full">
            <AuthStepper steps={REGISTER_STEPS} currentStep={step} />
            <form data-ui-region="register-form" data-auth-step={step === 0 ? 'register-account' : 'register-security'} className="auth-form-content auth-step-transition flex w-full flex-col gap-4 sm:gap-[18px]" onSubmit={handleStepSubmit} aria-busy={loading}>
                {step === 0 ? (
                    <>
                        <div className="mb-1 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm"><UserRound size={18} aria-hidden="true" /></span>
                            <div>
                                <p className="m-0 text-sm font-semibold text-slate-800">{t('registerAccountStepTitle')}</p>
                                <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">{t('registerAccountStepDescription')}</p>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <label htmlFor="register-username" className="text-sm font-semibold leading-5 text-slate-700">{t('username')}</label>
                            <input className={fieldClass} id="register-username" name="username" type="text" required autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder={t('enterUsernamePlaceholder')} autoComplete="username" disabled={loading} />
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <label htmlFor="register-email" className="text-sm font-semibold leading-5 text-slate-700">{t('email')}</label>
                            <input className={fieldClass} id="register-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" disabled={loading} />
                            <p className="m-0 text-xs leading-5 text-slate-500">{t('registerEmailHint')}</p>
                        </div>
                        <button className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                            {t('continue')} <ArrowRight size={17} aria-hidden="true" />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="mb-1 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm"><ShieldCheck size={18} aria-hidden="true" /></span>
                            <div>
                                <p className="m-0 text-sm font-semibold text-slate-800">{t('registerSecurityStepTitle')}</p>
                                <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">{t('registerSecurityStepDescription')}</p>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <label htmlFor="register-password" className="text-sm font-semibold leading-5 text-slate-700">{t('password')}</label>
                            <div className="relative w-full">
                                <input className={fieldClass + ' pr-14'} id="register-password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={t('enterPasswordPlaceholder')} disabled={loading} />
                                <button type="button" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40" disabled={loading} onClick={onTogglePassword} aria-label={showPassword ? t('hidePassword') : t('showPassword')} aria-pressed={showPassword}>
                                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <label htmlFor="register-confirm-password" className="text-sm font-semibold leading-5 text-slate-700">{t('confirmPasswordLabel')}</label>
                            <div className="relative w-full">
                                <input className={fieldClass + ' pr-14'} id="register-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} placeholder={t('confirmPasswordPlaceholder')} disabled={loading} />
                                <button type="button" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40" disabled={loading} onClick={onToggleConfirmPassword} aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')} aria-pressed={showConfirmPassword}>
                                    {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                        {error && <div role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
                        {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
                        <div className="mt-1 grid grid-cols-2 gap-3">
                            <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" type="button" onClick={() => setStep(0)} disabled={loading}>
                                <ArrowLeft size={16} aria-hidden="true" /> {t('back')}
                            </button>
                            <button className="flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                {loading ? t('loading') : t('registerNow')}
                            </button>
                        </div>
                    </>
                )}
                {error && step === 0 && <div role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
                {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
                    <span>{t('alreadyHaveAccount')}</span>
                    <button className="min-h-9 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" type="button" onClick={onBackToLogin} disabled={loading}>{t('backToLogin')}</button>
                </div>
            </form>
        </div>
    );
}

export default RegisterForm;
