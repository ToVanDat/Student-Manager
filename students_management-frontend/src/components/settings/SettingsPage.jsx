import { RefreshCw } from 'lucide-react';
import SettingsMenu from '@/components/settings/SettingsMenu.jsx';

function SettingsPage({ activeTab, onTabChange, activeSessions, loading, onRefresh, children }) {
    return (
        <div className="settings-page">
            <div className="settings-header">
                <div>
                    <span className="settings-kicker">ACCOUNT &amp; SECURITY</span>
                    <h1>Cài đặt tài khoản</h1>
                    <p>Quản lý thông tin tài khoản, bảo mật và các phiên đăng nhập.</p>
                </div>
                {activeTab === 'sessions' && (
                    <button className="settings-refresh-button" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={17} className={loading ? 'spin' : ''} />Làm mới
                    </button>
                )}
            </div>
            <div className="settings-layout">
                <SettingsMenu activeTab={activeTab} onChange={onTabChange} activeSessions={activeSessions} />
                {children}
            </div>
        </div>
    );
}

export default SettingsPage;