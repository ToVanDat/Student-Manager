function OtpStep({ email, otp, onOtpChange, onSubmit, onBack, onResend, loading, resendCooldown }) {
    return (
        <form className="flex w-full flex-col gap-[18px]" onSubmit={onSubmit}>
            <div className="flex w-full flex-col gap-[7px]">
                <label className="text-xs font-semibold text-slate-700">Mã OTP</label>
                <input
                    className="h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-center text-xl font-bold tracking-[6px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 disabled:opacity-60"
                    type="text"
                    value={otp}
                    onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, '').slice(0, 6))} // legth otp
                    placeholder="Nhập mã OTP"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={loading}
                />
            </div>
            <p className="-mt-1 text-xs leading-relaxed text-slate-500">Mã OTP đã được gửi đến:<br /><strong className="font-semibold text-slate-700">{email}</strong></p>
            <button className="flex min-h-[47px] w-full items-center justify-center rounded-[9px] bg-linear-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? 'Đang xác nhận...' : 'Xác nhận OTP'}
            </button>
            <div className="flex w-full items-center justify-between gap-2">
                <button className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:text-slate-400" type="button" onClick={onBack} disabled={loading}>← Đổi email</button>
            </div>
            <div className="flex w-full items-center justify-center">
                <button className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline" type="button" onClick={onResend} disabled={loading || resendCooldown > 0}>
                    {resendCooldown > 0 ? `Gửi lại mã OTP sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </button>
            </div>
        </form>
    );
}

export default OtpStep;