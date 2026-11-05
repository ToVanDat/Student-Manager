import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function ResetPasswordStep({ newPassword, onNewPasswordChange, confirmPassword, onConfirmPasswordChange, onSubmit, onBack, loading }) {
    const { t } = useLanguage();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const fieldClass = 'auth-step-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 pr-14 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

    return (
        <form data-auth-step="recovery-reset" aria-busy={loading} className="auth-form-content auth-step-transition flex w-full flex-col gap-4 sm:gap-[18px]" onSubmit={onSubmit}>
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 dark:border-blue-900 dark:bg-blue-950/30">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm"><ShieldCheck size={18} aria-hidden="true" /></span>
                <div>
                    <p className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('resetPassword')}</p>
                    <p className="mb-0 mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{t('resetPasswordDescription')}</p>
                </div>
            </div>
            <div className="flex w-full flex-col gap-2">
                <label htmlFor="recovery-new-password" className="text-sm font-semibold leading-5 text-slate-700 dark:text-slate-200">{t('newPassword')}</label>
                <div className="relative">
                    <input className={fieldClass} id="recovery-new-password" name="newPassword" type={showPassword ? 'text' : 'password'} aria-describedby="recovery-password-hint" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} placeholder={t('enterNewPassword')} autoComplete="new-password" disabled={loading} />
                    <button type="button" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40" onClick={() => setShowPassword(value => !value)} disabled={loading} aria-label={showPassword ? t('hidePassword') : t('showPassword')} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
                </div>
                <p id="recovery-password-hint" className="m-0 text-xs leading-5 text-slate-500">{t('passwordMinimumHint')}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
                <label htmlFor="recovery-confirm-password" className="text-sm font-semibold leading-5 text-slate-700 dark:text-slate-200">{t('confirmPasswordLabel')}</label>
                <div className="relative">
                    <input className={fieldClass} id="recovery-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} placeholder={t('confirmPasswordPlaceholder')} autoComplete="new-password" disabled={loading} />
                    <button type="button" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40" onClick={() => setShowConfirmPassword(value => !value)} disabled={loading} aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
                </div>
            </div>
            <button className="auth-step-link min-h-10 self-center rounded-lg border-0 bg-transparent px-3 text-xs font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:text-slate-400" type="button" onClick={onBack} disabled={loading}>← {t('backToOtp')}</button>
            <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>{loading ? t('updating') : t('resetPassword')}</button>
        </form>
    );
}

export default ResetPasswordStep;