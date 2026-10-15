import { Bell, KeyRound, LogOut, Monitor, Moon, ShieldCheck, UserRound } from 'lucide-react';
import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useLanguage } from '@/context/LanguageContext.jsx';

export default function GlobalMoreMenu({ user, onSelectSettings, onLogout }) {
    const { t } = useLanguage();
    const ITEMS = [
        { id: 'account', label: t('account'), Icon: UserRound },
        { id: 'notifications', label: t('notifications'), Icon: Bell },
        { id: 'security', label: t('security'), Icon: ShieldCheck },
        { id: 'sessions', label: t('sessions'), Icon: Monitor },
        { id: 'password', label: t('password'), Icon: KeyRound },
        { id: 'appearance', label: t('appearance'), Icon: Moon },
        { id: 'language', label: t('language'), Icon: Monitor },
    ];
    return (
        <div role="menu" aria-label="Menu toàn website" className="absolute right-0 top-full z-[190] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
            <div className="flex items-center gap-3 px-3 py-3">
                {user?.avatar_url || user?.avatarUrl || user?.avatar ? (
                    <img src={resolveMediaUrl(user.avatar_url || user.avatarUrl || user.avatar)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-sm font-bold text-blue-700 dark:text-blue-300">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.username || 'Người dùng'}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Chưa cập nhật email'}</span>
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">{user?.role === 'admin' ? t('administrator') : t('user')}</span>
                </span>
            </div>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            {ITEMS.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="menuitem" onClick={() => onSelectSettings?.(id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Icon size={17} className="shrink-0 text-slate-500 dark:text-slate-400" /><span>{label}</span>
                </button>
            ))}
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                <LogOut size={17} /><span>{t('logout')}</span>
            </button>
        </div>
    );
}
