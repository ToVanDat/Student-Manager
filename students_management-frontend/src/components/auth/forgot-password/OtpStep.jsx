import { useLanguage } from '@/context/LanguageContext.jsx';

function OtpStep({ email, otp, onOtpChange, onSubmit, onBack, onResend, loading, resendCooldown }) {
    const { t } = useLanguage();
    return (
        <form data-auth-step="recovery-otp" aria-busy={loading} className="auth-form-content auth-step-transition flex w-full flex-col gap-4 sm:gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-2">
                <label htmlFor="recovery-otp" className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('otpCode')}</label>
                <input
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-center text-xl font-bold tracking-[6px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 disabled:opacity-60"
                    id="recovery-otp"
                    name="otp"
                    required
                    aria-describedby="recovery-otp-hint"
                    type="text"
                    value={otp}
                    onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, '').slice(0, 6))} // Keep the one-time code numeric and six digits.
                    placeholder={t("enterOtp")}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={loading}
                />
            </div>
            <p id="recovery-otp-hint" className="-mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('otpSentTo')}<br /><strong className="font-semibold text-slate-700">{email}</strong></p>
            <button className="flex min-h-[47px] w-full items-center justify-center rounded-[9px] bg-blue-700 px-4 py-2.5 text-[13px] font-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? t('verifying') : t('verifyOtp')}
            </button>
            <div className="flex w-full items-center justify-between gap-2">
                <button className="auth-step-link min-h-9 border-0 bg-transparent px-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:text-slate-400" type="button" onClick={onBack} disabled={loading}>← {t('changeEmail')}</button>
            </div>
            <div className="flex w-full items-center justify-center">
                <button className="auth-step-link min-h-9 border-0 bg-transparent px-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline" type="button" onClick={onResend} disabled={loading || resendCooldown > 0}>
                    {resendCooldown > 0 ? t('resendOtpIn', { seconds: resendCooldown }) : t('resendOtp')}
                </button>
            </div>
        </form>
    );
}

export default OtpStep;