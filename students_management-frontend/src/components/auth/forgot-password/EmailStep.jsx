function EmailStep({ email, onEmailChange, onSubmit, onLogin, loading }) {
    return (
        <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-field">
                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                />
            </div>
            <p className="forgot-description">Nhập email đã đăng ký để lấy lại mật khẩu.</p>
            <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? 'Đang gửi mã...' : 'Gửi yêu cầu'}
            </button>
            <div className="auth-actions single">
                <button type="button" onClick={onLogin} disabled={loading}>← Quay lại đăng nhập</button>
            </div>
        </form>
    );
}

export default EmailStep;