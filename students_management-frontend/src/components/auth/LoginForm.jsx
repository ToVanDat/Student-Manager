import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';

function LoginForm({
    username,
    onUsernameChange,
    password,
    onPasswordChange,
    showPassword,
    onTogglePassword,
    rememberMe,
    onRememberChange,
    onForgotPassword,
    error,
    success,
    loading,
    onSubmit,
    onOpenRegister,
}) {
    const { t } = useLanguage();

    return (
        <form className="flex w-full flex-col gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="login-username" className="text-[12px] font-bold tracking-wide text-slate-700 dark:text-slate-200">{t('username')}</label>
                <input
                    className="h-[50px] w-full rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder={t("enterUsernamePlaceholder")}
                    autoComplete="username"
                />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="login-password" className="text-xs leading-[1.4] font-semibold text-slate-700">{t('password')}</label>
                <div className="relative w-full">
                    <input
                        className="h-[50px] w-full rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 pr-12 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        placeholder={t("enterPasswordPlaceholder")}
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        className="absolute top-1/2 right-2.5 flex size-[34px] -translate-y-1/2 items-center justify-center border-0 bg-transparent text-slate-500 opacity-70 transition hover:text-brand-600 hover:opacity-100"
                        onClick={onTogglePassword}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="-mt-0.5 flex w-full items-center justify-between gap-4">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-500">
                    <input className="size-4 accent-blue-600" type="checkbox" checked={rememberMe} onChange={(event) => onRememberChange(event.target.checked)} />
                    <span>{t('rememberAccount')}</span>
                </label>
                <button type="button" className="shrink-0 rounded border-0 bg-transparent px-1 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700" onClick={onForgotPassword}>{t('forgotPassword')}</button>
            </div>
            {error && <div id="login-error" role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
            {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
            <button className="mt-0.5 flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-700/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none" type="submit" disabled={loading} aria-describedby={error ? "login-error" : undefined}>
                {loading ? t('loading') : t('login')}
            </button>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <span>{t('noAccountYet')}</span>
                <button className="rounded-lg border-0 bg-transparent px-2 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 hover:text-blue-800" type="button" onClick={onOpenRegister}>{t('registerNow')}</button>
            </div>
        </form>
    );
}

export default LoginForm;