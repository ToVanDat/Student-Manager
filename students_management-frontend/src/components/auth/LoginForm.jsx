import { Eye, EyeOff } from 'lucide-react';

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
    return (
        <form className="flex w-full flex-col gap-4 min-[451px]:gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs leading-[1.4] font-semibold text-slate-700">Username</label>
                <input
                    className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
                    type="text"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder="Nhập username"
                    autoComplete="username"
                />
            </div>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs leading-[1.4] font-semibold text-slate-700">Password</label>
                <div className="relative w-full">
                    <input
                        className="h-[46px] w-full rounded-lg border border-line bg-slate-50 px-3.5 pr-[50px] text-[13px] text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        placeholder="Nhập password"
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        className="absolute top-1/2 right-2.5 flex size-[34px] -translate-y-1/2 items-center justify-center border-0 bg-transparent text-slate-500 opacity-70 transition hover:text-brand-600 hover:opacity-100"
                        onClick={onTogglePassword}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="-mt-0.5 flex w-full items-center justify-between gap-4">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-500">
                    <input className="size-4 accent-blue-600" type="checkbox" checked={rememberMe} onChange={(event) => onRememberChange(event.target.checked)} />
                    <span>Ghi nhớ tài khoản</span>
                </label>
                <button type="button" className="shrink-0 rounded border-0 bg-transparent px-1 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700" onClick={onForgotPassword}>Quên mật khẩu?</button>
            </div>
            {error && <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">{error}</div>}
            {success && <div className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs leading-relaxed text-green-700">{success}</div>}
            <button className="mt-0.5 flex h-[47px] w-full items-center justify-center rounded-lg bg-linear-to-r from-brand-600 to-brand-500 px-4 text-[13px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-px hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none" type="submit" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <span>Chưa có tài khoản?</span>
                <button className="rounded border-0 bg-transparent px-1 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700" type="button" onClick={onOpenRegister}>Tạo tài khoản</button>
            </div>
        </form>
    );
}

export default LoginForm;