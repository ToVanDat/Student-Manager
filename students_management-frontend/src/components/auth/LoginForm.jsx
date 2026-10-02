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
        <form className="login-form" onSubmit={onSubmit}>
            <div className="login-field">
                <label>Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder="Nhập username"
                    autoComplete="username"
                />
            </div>
            <div className="login-field">
                <label>Password</label>
                <div className="password-wrapper">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        placeholder="Nhập password"
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        className="password-toggle"
                        onClick={onTogglePassword}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="remember-row">
                <label className="remember-label">
                    <input type="checkbox" checked={rememberMe} onChange={(event) => onRememberChange(event.target.checked)} />
                    <span className="remember-check" />
                    <span>Ghi nhớ tài khoản</span>
                </label>
                <button type="button" className="forgot-link" onClick={onForgotPassword}>Quên mật khẩu?</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}
            <button className="login-button" type="submit" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
            <div className="login-links">
                <span>Chưa có tài khoản?</span>
                <button type="button" onClick={onOpenRegister}>Tạo tài khoản</button>
            </div>
        </form>
    );
}

export default LoginForm;