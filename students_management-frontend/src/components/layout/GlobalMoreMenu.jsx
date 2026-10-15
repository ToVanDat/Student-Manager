import { Bell, KeyRound, LogOut, Monitor, ShieldCheck, UserRound } from 'lucide-react';

const ITEMS = [
    { id: 'account', label: 'Thông tin tài khoản', Icon: UserRound },
    { id: 'notifications', label: 'Thông báo', Icon: Bell },
    { id: 'security', label: 'Bảo mật', Icon: ShieldCheck },
    { id: 'sessions', label: 'Phiên đăng nhập', Icon: Monitor },
    { id: 'password', label: 'Đổi mật khẩu', Icon: KeyRound },
];

export default function GlobalMoreMenu({ user, onSelectSettings, onLogout, compact = false }) {
    return (
        <div role="menu" aria-label="Menu toàn website" className={`absolute right-0 top-full z-[190] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${compact ? '' : ''}`}>
            <div className="flex items-center gap-3 px-3 py-3">
                {user?.avatar_url || user?.avatarUrl || user?.avatar ? (
                    <img src={user.avatar_url || user.avatarUrl || user.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{user?.username || 'Người dùng'}</span>
                    <span className="block truncate text-xs text-slate-500">{user?.email || 'Chưa cập nhật email'}</span>
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</span>
                </span>
            </div>
            <div className="my-1 border-t border-slate-100" />
            {ITEMS.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="menuitem" onClick={() => onSelectSettings?.(id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Icon size={17} className="shrink-0 text-slate-500" /><span>{label}</span>
                </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                <LogOut size={17} /><span>Đăng xuất</span>
            </button>
        </div>
    );
}
