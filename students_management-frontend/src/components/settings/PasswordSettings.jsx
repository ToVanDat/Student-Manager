import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

const fields = [
    ['currentPassword', 'Mật khẩu hiện tại', 'current-password'],
    ['newPassword', 'Mật khẩu mới', 'new-password'],
    ['confirmPassword', 'Xác nhận mật khẩu mới', 'new-password'],
];

function PasswordSettings({ form, onChange, onSubmit, saving, message, error }) {
    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-icon"><KeyRound size={20} /></div>
                <div><h2>Đổi mật khẩu</h2><p>Sử dụng mật khẩu mạnh và không chia sẻ mật khẩu với người khác.</p></div>
            </div>
            <form className="settings-form" onSubmit={onSubmit}>
                {fields.map(([name, label, autoComplete]) => (
                    <div className="settings-field" key={name}>
                        <label>{label}</label>
                        <div className="settings-input-wrap">
                            <KeyRound size={17} />
                            <input type="password" value={form[name]} onChange={(event) => onChange({ ...form, [name]: event.target.value })} autoComplete={autoComplete} />
                        </div>
                    </div>
                ))}
                {error && <div className="settings-error"><AlertCircle size={17} />{error}</div>}
                {message && <div className="settings-message"><CheckCircle2 size={17} />{message}</div>}
                <div className="password-rules"><strong>Yêu cầu mật khẩu</strong><span>• Ít nhất 8 ký tự</span><span>• Không sử dụng mật khẩu quá dễ đoán</span></div>
                <div className="settings-actions"><button type="submit" className="primary-button" disabled={saving}><KeyRound size={17} />{saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button></div>
            </form>
        </div>
    );
}

export default PasswordSettings;