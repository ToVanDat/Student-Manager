function ResetPasswordStep({ newPassword, onNewPasswordChange, confirmPassword, onConfirmPasswordChange, onSubmit, loading }) {
    return (
        <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-field">
                <label>Mật khẩu mới</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => onNewPasswordChange(event.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    autoComplete="new-password"
                    disabled={loading}
                />
            </div>
            <div className="auth-field">
                <label>Xác nhận mật khẩu</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    disabled={loading}
                />
            </div>
            <p className="forgot-description">Nhập mật khẩu mới cho tài khoản của bạn.</p>
            <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
        </form>
    );
}

export default ResetPasswordStep;