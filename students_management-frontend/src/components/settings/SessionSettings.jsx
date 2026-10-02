import { AlertCircle, CheckCircle2, LogOut, Monitor, RefreshCw } from 'lucide-react';

function SessionSettings({
    sessions,
    loading,
    error,
    currentSessionId,
    onRefresh,
    onRevoke,
    onRevokeOthers,
    formatDate,
    getDeviceIcon,
}) {
    const activeSessions = sessions.filter((session) => !session.revoked_at);
    const revokedSessions = sessions.filter((session) => session.revoked_at);

    return (
        <div className="settings-card">
            <div className="settings-card-header session-main-header">
                <div className="settings-card-title-row">
                    <div className="settings-card-icon"><Monitor size={20} /></div>
                    <div><h2>Phiên đăng nhập</h2><p>Các thiết bị đang và đã đăng nhập vào tài khoản.</p></div>
                </div>
                <button className="danger-outline-button" onClick={onRevokeOthers} disabled={loading || activeSessions.filter((session) => session.id !== currentSessionId).length === 0}>
                    <LogOut size={16} />Đăng xuất thiết bị khác
                </button>
            </div>
            <div className="session-summary">
                <div className="session-summary-item"><strong>{activeSessions.length}</strong><span>Phiên đang hoạt động</span></div>
                <div className="session-summary-item"><strong>{revokedSessions.length}</strong><span>Phiên đã thu hồi</span></div>
                <div className="session-summary-item"><strong>{sessions.length}</strong><span>Tổng số phiên</span></div>
            </div>
            {error && <div className="settings-error"><AlertCircle size={18} />{error}</div>}
            {loading ? (
                <div className="session-loading"><div className="loading-spinner" /><p>Đang tải danh sách phiên đăng nhập...</p></div>
            ) : sessions.length === 0 ? (
                <div className="session-empty">
                    <Monitor size={42} /><h3>Chưa có dữ liệu session</h3><p>Không tìm thấy phiên đăng nhập nào.</p>
                    <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} />Tải lại</button>
                </div>
            ) : (
                <div className="session-list">
                    {sessions.map((session) => {
                        const isCurrent = session.id === currentSessionId;
                        const isRevoked = Boolean(session.revoked_at);
                        const DeviceIcon = getDeviceIcon(session);

                        return (
                            <div className={`session-card ${isCurrent ? 'current' : ''} ${isRevoked ? 'revoked' : ''}`} key={session.id}>
                                <div className="session-device-icon"><DeviceIcon size={24} /></div>
                                <div className="session-details">
                                    <div className="session-title-row">
                                        <div>
                                            <h3>{session.device_name || 'Thiết bị không xác định'}</h3>
                                            <div className="session-badges">
                                                {isCurrent && <span className="status-badge current"><CheckCircle2 size={13} />Thiết bị hiện tại</span>}
                                                {!isRevoked && !isCurrent && <span className="status-badge success">Đang hoạt động</span>}
                                                {isRevoked && <span className="status-badge revoked">Đã thu hồi</span>}
                                            </div>
                                        </div>
                                        {!isCurrent && !isRevoked && <button className="session-revoke-button" onClick={() => onRevoke(session.id)}><LogOut size={16} />Đăng xuất</button>}
                                    </div>
                                    <div className="session-meta-grid">
                                        <div><span>Trình duyệt</span><strong>{session.user_agent || 'Không xác định'}</strong></div>
                                        <div><span>Địa chỉ IP</span><strong>{session.ip_address || 'Không xác định'}</strong></div>
                                        <div><span>Đăng nhập</span><strong>{formatDate(session.created_at)}</strong></div>
                                        <div><span>Hoạt động cuối</span><strong>{formatDate(session.last_used_at)}</strong></div>
                                        {isRevoked && <div><span>Thu hồi</span><strong>{formatDate(session.revoked_at)}</strong></div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default SessionSettings;