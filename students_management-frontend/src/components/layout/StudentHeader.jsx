import { useEffect, useRef, useState } from 'react';
import {
    Bell,
    LogOut,
    Menu,
    Moon,
    MoreVertical,
    Search,
    Settings,
    Sun,
    User,
} from 'lucide-react';

function StudentHeader({
    user,
    search,
    onSearchChange,
    darkMode,
    onToggleDarkMode,
    onOpenSettings,
    onLogout,
    onToggleSidebar,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        setMenuOpen(false);
        onLogout();
    };

    return (
        <header className="top-header">
            <button className="mobile-menu" onClick={onToggleSidebar}>
                <Menu size={22} />
            </button>

            <div className="global-search">
                <Search size={19} />
                <input
                    type="text"
                    placeholder="Tìm kiếm sinh viên, lớp học, mã sinh viên, email..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="header-actions">
                <button className="header-icon">
                    <Bell size={20} />
                    <span className="notification-dot">2</span>
                </button>
                <button className="header-icon" onClick={onToggleDarkMode}>
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="user-menu-wrapper" ref={menuRef}>
                    <button
                        className="user-menu-trigger"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <div className="user-avatar">
                            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="header-user-info">
                            <strong>{user?.username || 'User'}</strong>
                            <span>
                                {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                            </span>
                        </div>
                        <MoreVertical size={20} />
                    </button>

                    {menuOpen && (
                        <div className="user-dropdown">
                            <div className="dropdown-user">
                                <div className="user-avatar large">
                                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <strong>{user?.username || 'User'}</strong>
                                    <span>{user?.email || 'user@example.com'}</span>
                                </div>
                            </div>
                            <div className="dropdown-divider" />
                            <button>
                                <User size={18} />
                                <span>Thông tin người dùng</span>
                            </button>
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    onOpenSettings();
                                }}
                            >
                                <Settings size={18} />
                                <span>Cài đặt tài khoản</span>
                            </button>
                            <div className="dropdown-divider" />
                            <button className="logout-item" onClick={handleLogout}>
                                <LogOut size={18} />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default StudentHeader;