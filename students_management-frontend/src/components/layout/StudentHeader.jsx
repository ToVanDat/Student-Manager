import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useEffect, useRef, useState } from 'react';
import {
    Bell,
    Sun,
    Moon,
    Languages,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    MoreVertical,
    Search,
    User,
    CheckCheck,
} from 'lucide-react';
import { notificationApi } from '@/api/notificationApi.js';
import socket from '@/socket/socket.js';
import GlobalMoreMenu from '@/components/layout/GlobalMoreMenu.jsx';
import { useLanguage } from '@/context/LanguageContext.jsx';

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
    const { language, setLanguage, t } = useLanguage();
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationItems, setNotificationItems] = useState([]);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
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

    useEffect(() => {
        let active = true;
        const loadNotifications = async () => {
            setNotificationsLoading(true);
            try {
                const { data } = await notificationApi.getHistory(20, 0);
                if (!active) return;
                setNotificationItems(Array.isArray(data?.data) ? data.data : []);
                setNotificationUnreadCount(Number(data?.unreadCount) || 0);
            } catch (error) {
                console.error('Không tải được lịch sử thông báo:', error?.message);
            } finally {
                if (active) setNotificationsLoading(false);
            }
        };
        const handleNewNotification = item => {
            if (!item?.id) return;
            setNotificationItems(previous => [item, ...previous.filter(existing => existing.id !== item.id)].slice(0, 20));
            setNotificationUnreadCount(count => count + (item.is_read ? 0 : 1));
        };
        loadNotifications();
        socket.on('notification:new', handleNewNotification);
        return () => {
            active = false;
            socket.off('notification:new', handleNewNotification);
        };
    }, []);

    const handleNotificationClick = async item => {
        try {
            if (!item.is_read) {
                await notificationApi.markRead(item.id);
                setNotificationItems(previous => previous.map(existing => existing.id === item.id ? { ...existing, is_read: true } : existing));
                setNotificationUnreadCount(count => Math.max(0, count - 1));
            }
        } catch (error) {
            console.error('Không thể đánh dấu thông báo đã đọc:', error?.message);
        }
        setNotificationsOpen(false);
        onOpenNotifications?.(item);
    };

    const handleMarkAllNotificationsRead = async () => {
        try {
            await notificationApi.markAllRead();
            setNotificationItems(previous => previous.map(item => ({ ...item, is_read: true })));
            setNotificationUnreadCount(0);
        } catch (error) {
            console.error('Không thể đánh dấu tất cả thông báo đã đọc:', error?.message);
        }
    };

    const handleLogout = () => {
        setMenuOpen(false);
        onLogout();
    };

    return (
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-[#e9edf5] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 backdrop-blur-[16px] sm:px-6 lg:px-[30px]">
            <button className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#64748b] dark:text-slate-400 transition-colors hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] min-[801px]:hidden" onClick={onToggleSidebar} aria-label={t("openMenu")} title={t("openMenu")}>
                <Menu size={22} />
            </button>
            <button
                type="button"
                className="hidden size-9 shrink-0 items-center justify-center rounded-md text-[#64748b] dark:text-slate-400 transition-colors hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] min-[801px]:inline-flex"
                onClick={onToggleDesktopSidebar}
                aria-label={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            >
                {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="flex h-10 w-[45%] min-w-0 max-w-[460px] flex-1 items-center gap-2.5 rounded-lg border border-transparent bg-[#f1f5fb] dark:bg-slate-800 px-[13px] text-slate-400 transition focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:shadow-sm">
                <Search size={18} className="shrink-0" />
                <input
                    className="min-w-0 flex-1 border-0 bg-transparent text-xs text-[#293b55] dark:text-slate-100 outline-none placeholder:text-slate-400"
                    type="text"
                    placeholder={t("searchStudents")}
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <div className="relative">
                    <button type="button" onClick={() => setLanguageMenuOpen(open => !open)} className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#71829b] transition hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300" aria-label={t('quickLanguage')} title={t('quickLanguage')} aria-expanded={languageMenuOpen}>
                        <Languages size={18} /><span>{language.toUpperCase()}</span>
                    </button>
                    {languageMenuOpen && <div className="absolute right-0 top-[44px] z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900" role="menu" aria-label={t('language')}>
                        {[{ value: 'vi', label: t('vietnamese') }, { value: 'en', label: t('english') }].map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={language === option.value} onClick={() => { setLanguage(option.value); setLanguageMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${language === option.value ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}><span>{option.label}</span><span>{language === option.value ? '✓' : ''}</span></button>)}
                        <button type="button" onClick={() => { setLanguageMenuOpen(false); onOpenSettings('language'); }} className="mt-1 w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-slate-800">{t('language')} · {t('settingsTitle')}</button>
                    </div>}
                </div>
                <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#71829b] dark:text-slate-300 transition hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700 dark:hover:text-blue-300"
                    aria-label={darkMode ? t('themeLight') : t('themeDark')}
                    title={darkMode ? t('themeLight') : t('themeDark')}
                >
                    {darkMode ? <Sun size={19} /> : <Moon size={19} />}
                </button>
                <div className="relative">
                    <button type="button" onClick={() => setNotificationsOpen(open => !open)} className="relative flex size-9 items-center justify-center rounded-lg text-[#71829b] dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700 dark:hover:text-blue-300" aria-label={t('notifications')} aria-expanded={notificationsOpen}>
                        <Bell size={20} />
                        {notificationUnreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}</span>}
                    </button>
                    {notificationsOpen && (
                        <div className="absolute right-0 top-[48px] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e3eaf4] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                                <div>
                                    <strong className="text-sm text-[#293b55] dark:text-slate-100">{t('notifications')}</strong>
                                    <p className="mt-0.5 text-[11px] text-slate-400">{notificationUnreadCount} {t('unread')}</p>
                                </div>
                                <button type="button" onClick={handleMarkAllNotificationsRead} disabled={notificationUnreadCount === 0} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:cursor-not-allowed disabled:opacity-40" title={t("markAllRead")}>
                                    <CheckCheck size={14} /> Đọc tất cả
                                </button>
                            </div>
                            <div className="max-h-[min(65vh,26rem)] overflow-y-auto">
                                {notificationsLoading && notificationItems.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-xs text-slate-400">{t('loadingNotifications')}</p>
                                ) : notificationItems.length ? notificationItems.map(item => (
                                    <button key={item.id} type="button" onClick={() => handleNotificationClick(item)} className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-blue-50 ${item.is_read ? 'bg-white' : 'bg-blue-50/60'}`}>
                                        <span className="flex items-start gap-2">
                                            {!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" />}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-semibold text-[#293b55] dark:text-slate-100">{item.title}</span>
                                                <span className="mt-1 block break-words text-xs leading-5 text-[#71829b] dark:text-slate-400">{item.body}</span>
                                                <span className="mt-1 block text-[10px] text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
                                            </span>
                                        </span>
                                    </button>
                                )) : (
                                    <p className="px-4 py-8 text-center text-xs text-slate-400">{t('noNotifications')}</p>
                                )}
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                                <button type="button" onClick={() => { setNotificationsOpen(false); onOpenNotifications?.(); }} className="w-full rounded-lg px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40">{t('openNotifications')}</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={menuRef}>
                    <button
                        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[#f5f8ff] sm:gap-3"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        {user?.avatar_url || user?.avatar ? (
                            <img src={resolveMediaUrl(user.avatar_url || user.avatar)} alt={t("account")} className="size-8 shrink-0 rounded-full object-cover" />
                        ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dcecff] text-xs font-bold text-[#1d4ed8]">
                                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="hidden min-w-0 flex-col sm:flex">
                            <strong className="max-w-28 truncate text-xs text-[#293b55] dark:text-slate-100">{user?.username || 'User'}</strong>
                            <span className="text-[10px] text-[#71829b] dark:text-slate-400">
                                {user?.role === 'admin' ? t('administrator') : t('user')}
                            </span>
                        </div>
                        <MoreVertical size={20} />
                    </button>

                    {menuOpen && (
                        <GlobalMoreMenu
                            user={user}
                            onSelectSettings={(tab) => {
                                setMenuOpen(false);
                                onOpenSettings(tab);
                            }}
                            onLogout={handleLogout}
                        />
                    )}
                </div>
            </div>
        </header>
    );
}

export default StudentHeader;