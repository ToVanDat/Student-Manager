import { Clock3, Globe, KeyRound, ShieldCheck } from 'lucide-react';

function SecuritySettings({ onOpenSessions }) {
    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-icon"><ShieldCheck size={20} /></div>
                <div><h2>Bảo mật</h2><p>Thông tin trạng thái bảo mật của phiên hiện tại.</p></div>
            </div>
            <div className="security-list">
                <div className="security-row"><div className="security-row-icon"><ShieldCheck size={20} /></div><div><strong>Authentication</strong><span>Tài khoản đang sử dụng JWT Authentication.</span></div><span className="status-badge success">Hoạt động</span></div>
                <div className="security-row"><div className="security-row-icon"><KeyRound size={20} /></div><div><strong>Access Token</strong><span>Access token được gửi trong Authorization Bearer header.</span></div><span className="status-badge success">JWT</span></div>
                <div className="security-row"><div className="security-row-icon"><Clock3 size={20} /></div><div><strong>Refresh Token</strong><span>Refresh token được dùng để duy trì phiên đăng nhập.</span></div><span className="status-badge success">Enabled</span></div>
                <div className="security-row"><div className="security-row-icon"><Globe size={20} /></div><div><strong>Session Management</strong><span>Mỗi lần đăng nhập được quản lý như một session riêng.</span></div><button className="secondary-button" onClick={onOpenSessions}>Xem session</button></div>
            </div>
        </div>
    );
}

export default SecuritySettings;