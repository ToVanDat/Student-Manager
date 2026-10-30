import { Eye, EyeOff, Camera, LoaderCircle, ShieldCheck } from 'lucide-react';
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
    onFaceLogin,
    onOpenRegister,
}) {
    const { t } = useLanguage();

    return (
        <form className="auth-form-content flex w-full flex-col gap-4" onSubmit={onSubmit} aria-busy={loading}>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="login-username" className="text-sm font-medium text-slate-700">{t('username')}</label>
                <input
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    disabled={loading}
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder={t("enterUsernamePlaceholder")}
                    autoComplete="username"
                />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="login-password" className="text-sm font-medium text-slate-700">{t('password')}</label>
                <div className="relative w-full">
                    <input
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={loading}
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        placeholder={t("enterPasswordPlaceholder")}
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        onClick={onTogglePassword}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                        aria-pressed={showPassword}
                        disabled={loading}
                    >
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="-mt-0.5 flex w-full items-center justify-between gap-4">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-500">
                    <input className="size-4 accent-blue-600" type="checkbox" checked={rememberMe} disabled={loading} onChange={(event) => onRememberChange(event.target.checked)} />
                    <span>{t('rememberAccount')}</span>
                </label>
                <button type="button" className="shrink-0 rounded border-0 bg-transparent px-1 py-1 text-xs font-medium text-blue-700 hover:underline" onClick={onForgotPassword} disabled={loading}>{t('forgotPassword')}</button>
            </div>
            {error && <div id="login-error" role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
            {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
            <button className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-px hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading} aria-describedby={error ? "login-error" : undefined}>
                {loading ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />{t("loading")}</> : t("login")}
            </button>
            <button type="button" onClick={onFaceLogin} disabled={loading || !username.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <Camera size={18} aria-hidden="true" /> Đăng nhập bằng Face Login
            </button>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <span>{t('noAccountYet')}</span>
                <button className="rounded border-0 bg-transparent px-2 py-1.5 text-xs font-semibold text-blue-700 hover:underline" type="button" onClick={onOpenRegister}>{t('registerNow')}</button>
            </div>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={13} aria-hidden="true" />{t('loginSecurityNote')}</p>
        </form>
    );
}

export default LoginForm;