import { CheckCircle2, Mail, Save, User } from 'lucide-react';

function AccountSettings({ user, form, onChange, onSubmit, saving, message }) {
    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-icon"><User size={20} /></div>
                <div><h2>Thông tin tài khoản</h2><p>Cập nhật thông tin cơ bản của tài khoản.</p></div>
            </div>
            <form className="settings-form" onSubmit={onSubmit}>
                <div className="settings-field">
                    <label>Username</label>
                    <div className="settings-input-wrap">
                        <User size={17} />
                        <input type="text" value={form.username} onChange={(event) => onChange({ ...form, username: event.target.value })} required />
                    </div>
                </div>
                <div className="settings-field">
                    <label>Email</label>
                    <div className="settings-input-wrap">
                        <Mail size={17} />
                        <input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required />
                    </div>
                </div>
                <div className="settings-user-meta">
                    <div><span>Role</span><strong>{user?.role || 'user'}</strong></div>
                    <div><span>User ID</span><strong>{user?.id || user?.userId || '—'}</strong></div>
                </div>
                {message && <div className="settings-message"><CheckCircle2 size={17} />{message}</div>}
                <div className="settings-actions">
                    <button type="submit" className="primary-button" disabled={saving}>
                        <Save size={17} />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AccountSettings;