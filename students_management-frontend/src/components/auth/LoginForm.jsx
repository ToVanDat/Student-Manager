import { Eye, EyeOff, Fingerprint } from 'lucide-react';
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
        <form className="flex w-full flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label htmlFor="login-username" className="text-sm font-medium text-slate-700">{t('username')}</label>
                <input
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
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
                <label htmlFor="login-password" className="text-sm font-medium text-slate-700">{t('password')}</label>
                <div className="relative w-full">
                    <input
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
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
                        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
                <button type="button" className="shrink-0 rounded border-0 bg-transparent px-1 py-1 text-xs font-medium text-blue-700 hover:underline" onClick={onForgotPassword}>{t('forgotPassword')}</button>
            </div>
            {error && <div id="login-error" role="alert" aria-live="polite" className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
            {success && <div role="status" aria-live="polite" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">{success}</div>}
            <button className="mt-0.5 flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading} aria-describedby={error ? "login-error" : undefined}>
                {loading ? t('loading') : t('login')}
            </button>
            <button type="button" onClick={onFaceLogin} disabled={loading || !username.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Fingerprint size={18} /> Face ID / sinh trắc học (Passkey)
            </button>
            <p className="-mt-2 text-center text-[11px] leading-relaxed text-slate-400">Thiết bị sẽ xác minh bằng phương thức bảo mật sẵn có: Face ID, Windows Hello, vân tay hoặc PIN. Ứng dụng không nhận hay lưu ảnh khuôn mặt.</p>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <span>{t('noAccountYet')}</span>
                <button className="rounded border-0 bg-transparent px-2 py-1.5 text-xs font-semibold text-blue-700 hover:underline" type="button" onClick={onOpenRegister}>{t('registerNow')}</button>
            </div>
        </form>
    );
}

export default LoginForm;