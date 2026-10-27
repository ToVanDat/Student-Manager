import { useLanguage } from '@/context/LanguageContext.jsx';

function ResetPasswordStep({ newPassword, onNewPasswordChange, confirmPassword, onConfirmPasswordChange, onSubmit, loading }) {
    const { t } = useLanguage();
    return (
        <form className="auth-form-content auth-step-transition flex w-full flex-col gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs font-semibold text-slate-700">{t('newPassword')}</label>
                <input
                    className="h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 disabled:opacity-60"
                    type="password"
                    value={newPassword}
                    onChange={(event) => onNewPasswordChange(event.target.value)}
                    placeholder={t("enterNewPassword")}
                    autoComplete="new-password"
                    disabled={loading}
                />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs font-semibold text-slate-700">{t('confirmPasswordLabel')}</label>
                <input
                    className="h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 disabled:opacity-60"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    placeholder={t("confirmPasswordPlaceholder")}
                    autoComplete="new-password"
                    disabled={loading}
                />
            </div>
            <p className="-mt-1 text-xs leading-relaxed text-slate-500">{t('resetPasswordDescription')}</p>
            <button className="flex min-h-[47px] w-full items-center justify-center rounded-[9px] bg-linear-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                {loading ? t('updating') : t('resetPassword')}
            </button>
        </form>
    );
}

export default ResetPasswordStep;