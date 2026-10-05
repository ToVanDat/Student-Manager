import { KeyRound, Monitor, ShieldCheck, User } from 'lucide-react';

function SettingsMenu({ activeTab, onChange, activeSessions }) {
    const items = [
        { id: 'account', label: 'Tài khoản', Icon: User },
        { id: 'security', label: 'Bảo mật', Icon: ShieldCheck },
        { id: 'sessions', label: 'Phiên đăng nhập', Icon: Monitor },
        { id: 'password', label: 'Đổi mật khẩu', Icon: KeyRound },
    ];

    return (
        <aside className="sticky top-5 grid gap-1 rounded-xl border border-line bg-white p-2 shadow-panel max-[900px]:static max-[900px]:grid-cols-2 max-[640px]:grid-cols-1 dark:border-slate-700 dark:bg-slate-900">
            {items.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className={`relative flex min-h-[42px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-semibold transition ${activeTab === id ? 'bg-brand-50 text-brand-700 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-600 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                    onClick={() => onChange(id)}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                    {id === 'sessions' && activeSessions > 0 && (
                        <span className="ml-auto inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-200">{activeSessions}</span>
                    )}
                </button>
            ))}
        </aside>
    );
}

export default SettingsMenu;