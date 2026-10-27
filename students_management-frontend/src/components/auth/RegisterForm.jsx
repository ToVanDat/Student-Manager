import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

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
    return (
        <form className="auth-form-content flex w-full flex-col gap-4 min-[451px]:gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="register-username" className="text-xs leading-[1.4] font-semibold text-slate-700">{t('username')}</label>
                <input className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" id="register-username" name="username" type="text" required autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder={t("enterUsernamePlaceholder")} autoComplete="username" />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="register-email" className="text-xs leading-[1.4] font-semibold text-slate-700">{t('email')}</label>
                <input className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" id="register-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="register-password" className="text-xs leading-[1.4] font-semibold text-slate-700">{t('password')}</label>
                <div className="relative w-full">
                    <input className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 pr-[50px] text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" id="register-password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={t("enterPasswordPlaceholder")} autoComplete="new-password" />
                    <button type="button" className="absolute top-1/2 right-2.5 flex size-[34px] -translate-y-1/2 items-center justify-center border-0 bg-transparent text-slate-500 opacity-70 transition hover:text-brand-600 hover:opacity-100" onClick={onTogglePassword} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="register-confirm-password" className="text-xs leading-[1.4] font-semibold text-slate-700">{t('confirmPasswordLabel')}</label>
                <div className="relative w-full">
                    <input className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 pr-[50px] text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" id="register-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} placeholder={t("confirmPasswordPlaceholder")} autoComplete="new-password" />
                    <button type="button" className="absolute top-1/2 right-2.5 flex size-[34px] -translate-y-1/2 items-center justify-center border-0 bg-transparent text-slate-500 opacity-70 transition hover:text-brand-600 hover:opacity-100" onClick={onToggleConfirmPassword} aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}>
                        {showConfirmPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            {error && <div role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
            {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
            <button className="mt-0.5 flex h-[47px] w-full items-center justify-center rounded-lg bg-linear-to-r from-brand-600 to-brand-500 px-4 text-[13px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-px hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none" type="submit" disabled={loading}>
                {loading ? t('loading') : t('registerNow')}
            </button>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <button className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline" type="button" onClick={onBackToLogin}>← {t('backToLogin')}</button>
            </div>
        </form>
    );
}

export default RegisterForm;