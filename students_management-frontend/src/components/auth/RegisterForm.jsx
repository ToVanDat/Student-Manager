import { Eye, EyeOff } from 'lucide-react';

function RegisterForm({
    username,
    onUsernameChange,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    confirmPassword,
    onConfirmPasswordChange,
    showPassword,
    onTogglePassword,
    showConfirmPassword,
    onToggleConfirmPassword,
    error,
    success,
    loading,
    onSubmit,
    onBackToLogin,
}) {
    return (
        <form className="login-form" onSubmit={onSubmit}>
            <div className="login-field">
                <label>Username</label>
                <input type="text" value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="Nhập username" autoComplete="username" />
            </div>
            <div className="login-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="login-field">
                <label>Password</label>
                <div className="password-wrapper">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Nhập password" autoComplete="new-password" />
                    <button type="button" className="password-toggle" onClick={onTogglePassword} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                        {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            <div className="login-field">
                <label>Confirm Password</label>
                <div className="password-wrapper">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} placeholder="Nhập lại password" autoComplete="new-password" />
                    <button type="button" className="password-toggle" onClick={onToggleConfirmPassword} aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                        {showConfirmPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                    </button>
                </div>
            </div>
            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}
            <button className="login-button" type="submit" disabled={loading}>
                {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
            </button>
            <div className="login-links">
                <button type="button" onClick={onBackToLogin}>← Quay lại đăng nhập</button>
            </div>
        </form>
    );
}

export default RegisterForm;