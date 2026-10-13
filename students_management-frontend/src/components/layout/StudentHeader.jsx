import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useEffect, useRef, useState } from 'react';
import {
    Bell,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    MoreVertical,
    Search,
    Settings,
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
    sidebarCollapsed = false,
    onToggleDesktopSidebar,
    unreadCount = 0,
    onOpenNotifications,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
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
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-[#e9edf5] bg-white px-4 backdrop-blur-[16px] sm:px-6 lg:px-[30px]">
            <button className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#e8f1ff] hover:text-[#1d4ed8] min-[801px]:hidden" onClick={onToggleSidebar} aria-label="Mở menu" title="Mở menu">
                <Menu size={22} />
            </button>
            <button
                type="button"
                className="hidden size-9 shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#e8f1ff] hover:text-[#1d4ed8] min-[801px]:inline-flex"
                onClick={onToggleDesktopSidebar}
                aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                title={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            >
                {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="flex h-10 w-[45%] min-w-0 max-w-[460px] flex-1 items-center gap-2.5 rounded-lg border border-transparent bg-[#f1f5fb] px-[13px] text-slate-400 transition focus-within:border-brand-500 focus-within:bg-white focus-within:shadow-sm">
                <Search size={18} className="shrink-0" />
                <input
                    className="min-w-0 flex-1 border-0 bg-transparent text-xs text-[#293b55] outline-none placeholder:text-slate-400"
                    type="text"
                    placeholder="Tìm kiếm sinh viên, lớp học, mã sinh viên, email..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <button onClick={() => setNotificationsOpen(open => !open)} className="relative flex size-9 items-center justify-center rounded-lg text-[#71829b] hover:bg-brand-50 hover:text-brand-700" aria-label="Thông báo">
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </button>
                {notificationsOpen && (
                    <div className="absolute top-[62px] right-[130px] z-50 w-80 rounded-xl border border-[#e3eaf4] bg-white p-3 shadow-xl">
                        <div className="flex items-center justify-between px-2 py-1">
                            <strong className="text-sm text-[#293b55]">Thông báo</strong>
                            <span className="text-[11px] text-slate-400">{unreadCount} chưa đọc</span>
                        </div>
                        {unreadCount > 0 ? (
                            <button onClick={() => { setNotificationsOpen(false); onOpenNotifications?.(); }} className="mt-2 w-full rounded-lg bg-blue-50 p-3 text-left hover:bg-blue-100">
                                <p className="text-xs font-semibold text-[#293b55]">Tin nhắn mới</p>
                                <p className="mt-1 text-[11px] text-[#71829b]">Bạn có {unreadCount} tin nhắn chưa đọc.</p>
                            </button>
                        ) : (
                            <p className="px-2 py-6 text-center text-xs text-slate-400">Không có thông báo mới</p>
                        )}
                    </div>
                )}

                <div className="relative" ref={menuRef}>
                    <button
                        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[#f5f8ff] sm:gap-3"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        {user?.avatar_url || user?.avatar ? (
                            <img src={resolveMediaUrl(user.avatar_url || user.avatar)} alt="Avatar tài khoản" className="size-8 shrink-0 rounded-full object-cover" />
                        ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dcecff] text-xs font-bold text-[#1d4ed8]">
                                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="hidden min-w-0 flex-col sm:flex">
                            <strong className="max-w-28 truncate text-xs text-[#293b55]">{user?.username || 'User'}</strong>
                            <span className="text-[10px] text-[#71829b]">
                                {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                            </span>
                        </div>
                        <MoreVertical size={20} />
                    </button>

                    {menuOpen && (
                        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-[#e3eaf4] bg-white p-2 shadow-xl">
                            <div className="flex items-center gap-3 p-2">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="min-w-0">
                                    <strong className="block truncate text-xs text-[#293b55]">{user?.username || 'User'}</strong>
                                    <span className="block truncate text-[11px] text-[#71829b]">{user?.email || 'user@example.com'}</span>
                                </div>
                            </div>
                            <div className="my-1 border-t border-[#e8eef7]" />
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onOpenSettings();
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#64748b] hover:bg-[#f5f8ff]"
                            >
                                <User size={18} />
                                <span>Thông tin người dùng</span>
                            </button>
                            <button
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#64748b] hover:bg-[#f5f8ff]"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onOpenSettings();
                                }}
                            >
                                <Settings size={18} />
                                <span>Cài đặt tài khoản</span>
                            </button>
                            <div className="my-1 border-t border-[#e8eef7]" />
                            <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={handleLogout}>
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