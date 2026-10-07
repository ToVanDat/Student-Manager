function EmailStep({ email, onEmailChange, onSubmit, onLogin, loading }) {
    return (
        <form className="flex w-full flex-col gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs font-semibold text-slate-700">Email</label>
                <input
                    className="h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 disabled:opacity-60"
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                />
            </div>
            <p className="-mt-1 text-xs leading-relaxed text-slate-500">Nhập email đã đăng ký để lấy lại mật khẩu.</p>
            <button className="flex min-h-[47px] w-full items-center justify-center rounded-[9px] bg-linear-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                {loading ? 'Đang gửi mã...' : 'Gửi yêu cầu'}
            </button>
            <div className="flex w-full items-center justify-center gap-2">
                <button className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:text-slate-400" type="button" onClick={onLogin} disabled={loading}>← Quay lại đăng nhập</button>
            </div>
        </form>
    );
}

export default EmailStep;