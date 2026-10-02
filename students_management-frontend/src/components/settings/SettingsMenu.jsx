import { KeyRound, Monitor, ShieldCheck, User } from 'lucide-react';

function SettingsMenu({ activeTab, onChange, activeSessions }) {
    const items = [
        { id: 'account', label: 'Tài khoản', Icon: User },
        { id: 'security', label: 'Bảo mật', Icon: ShieldCheck },
        { id: 'sessions', label: 'Phiên đăng nhập', Icon: Monitor },
        { id: 'password', label: 'Đổi mật khẩu', Icon: KeyRound },
    ];

    return (
        <aside className="settings-menu">
            {items.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className={activeTab === id ? 'settings-menu-item active' : 'settings-menu-item'}
                    onClick={() => onChange(id)}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                    {id === 'sessions' && activeSessions > 0 && (
                        <span className="settings-count">{activeSessions}</span>
                    )}
                </button>
            ))}
        </aside>
    );
}

export default SettingsMenu;