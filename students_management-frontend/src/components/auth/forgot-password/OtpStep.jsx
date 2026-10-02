function OtpStep({ email, otp, onOtpChange, onSubmit, onBack, onResend, loading, resendCooldown }) {
    return (
        <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-field">
                <label>Mã OTP</label>
                <input
                    type="text"
                    value={otp}
                    onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Nhập mã OTP"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={loading}
                />
            </div>
            <p className="forgot-description">Mã OTP đã được gửi đến:<br /><strong>{email}</strong></p>
            <button className="auth-submit" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? 'Đang xác nhận...' : 'Xác nhận OTP'}
            </button>
            <div className="auth-actions">
                <button type="button" onClick={onBack} disabled={loading}>← Đổi email</button>
            </div>
            <div className="auth-actions single">
                <button type="button" onClick={onResend} disabled={loading || resendCooldown > 0}>
                    {resendCooldown > 0 ? `Gửi lại mã OTP sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </button>
            </div>
        </form>
    );
}

export default OtpStep;