import { useEffect } from 'react';
import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import {
    BarChart3,
    BookOpen,
    CalendarDays,
    ClipboardList,
    GraduationCap,
    Building2,
    Home,
    Layers,
    MessageSquare, // Import icon Tin nhắn
    Users,
    ShieldCheck,
    UserCog,
    ChartNoAxesColumn,
} from 'lucide-react';

function StudentSidebar({
    user,
    activePage,
    totalStudents,
    isOpen,
    onClose,
    onNavigate,
    onOpenSettings,
    collapsed = false,
    unreadCount = 0 // Thêm prop nhận số tin nhắn chưa đọc (nếu có)
}) {
    const { t } = useLanguage();

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleEscape = event => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
        <>
            {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 min-[801px]:hidden" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] -translate-x-full flex-col border-r border-slate-200/80 bg-white/95 px-4 py-5 text-slate-700 shadow-[12px_0_36px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-[width,transform,padding] duration-200 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100 min-[801px]:translate-x-0 ${collapsed ? 'min-[801px]:w-[72px] min-[801px]:px-2' : 'max-[1100px]:w-[220px]'} ${isOpen ? 'translate-x-0' : ''}`}>
                <div className={`mb-7 flex items-center gap-3 rounded-xl border-b border-slate-100 px-2 pb-5 dark:border-slate-800 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''}`}>
                    <div aria-label="Student Manager" className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-900/10 bg-gradient-to-br from-blue-700 to-cyan-700 shadow-md shadow-blue-900/15">
                        <GraduationCap size={27} strokeWidth={1.9} className="relative z-10 text-white" aria-hidden="true" />
                    </div>
                    <div className={collapsed ? 'min-[801px]:hidden flex flex-col' : 'flex flex-col'}>
                        <strong className="text-[14px] font-extrabold leading-tight tracking-[-.025em] text-[#183653] dark:text-white">Student Manager</strong>
                    </div>
                </div>

                <nav aria-label={t('mainNavigation')} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className={`px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('overviewGroup')}</div>
                    <button
                        title={t("home")}
                        className={`relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-all duration-150 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'dashboard' ? 'bg-blue-50 text-blue-800 font-semibold shadow-sm ring-1 ring-inset ring-blue-100 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-blue-600 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900 dark:before:bg-blue-400' : 'text-[#334155] dark:text-slate-300 hover:translate-x-0.5 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-slate-800/90 dark:hover:text-blue-200'}`}
                        aria-current={activePage === 'dashboard' ? 'page' : undefined}
                        onClick={() => { onNavigate('dashboard'); onClose?.(); }}
                    >
                        <Home size={19} />
                        <span className={collapsed ? 'min-[801px]:hidden' : ''}>{t("home")}</span>
                    </button>
                    {user?.role === 'admin' && (
                        <button
                            type="button"
                            title={t('manageStudents')}
                            className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'students' ? 'bg-[#e8f1fb] dark:bg-slate-800 text-[#174a7e] dark:text-blue-200 font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#174a7e] dark:before:bg-blue-400' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}
                            aria-current={activePage === 'students' ? 'page' : undefined}
                            onClick={() => { onNavigate('students'); onClose?.(); }}
                        >
                            <Users size={19} />
                            <span className={collapsed ? 'min-[801px]:hidden' : ''}>{t('manageStudents')}</span>
                            <span className={`ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{totalStudents}</span>
                        </button>
                    )}
                    {user?.role === 'admin' && (
                        <>
                            <div className={`mt-5 px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('trainingGroup')}</div>
                            {[
                                { key: 'classes', label: t('classes'), icon: Layers },
                                { key: 'departments', label: t('departments'), icon: GraduationCap },
                                { key: 'subjects', label: t('subjects'), icon: BookOpen },
                                { key: 'enrollments', label: t('enrollments'), icon: ClipboardList },
                                { key: 'semesters', label: t('semesters'), icon: CalendarDays },
                                { key: 'results', label: t('results'), icon: ChartNoAxesColumn },
                            ].map(({ key, label, icon: Icon }) => (
                                <button key={key} type="button" title={label} aria-label={label}
                                    aria-current={activePage === key ? 'page' : undefined}
                                    onClick={() => { onNavigate(key); onClose?.(); }}
                                    className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === key ? 'bg-[#e8f1fb] dark:bg-slate-800 text-[#174a7e] dark:text-blue-200 font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#174a7e] dark:before:bg-blue-400' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}>
                                    <Icon size={19} /><span className={collapsed ? 'min-[801px]:hidden' : ''}>{label}</span>
                                </button>
                            ))}
                            <div className={`mt-5 px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('systemGroup')}</div>
                            {[
                                { key: 'users', label: t('user'), icon: UserCog },
                                { key: 'permissions', label: t('security'), icon: ShieldCheck },
                            ].map(({ key, label, icon: Icon }) => (
                                <button key={key} type="button" title={label} aria-label={label}
                                    onClick={() => onNavigate(key)}
                                    className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === key ? 'bg-[#e8f1fb] dark:bg-slate-800 text-[#174a7e] dark:text-blue-200 font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#174a7e] dark:before:bg-blue-400' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}>
                                    <Icon size={19} /><span className={collapsed ? 'min-[801px]:hidden' : ''}>{label}</span>
                                </button>
                            ))}
                        </>
                    )}

                    {/* THÊM MỤC LIÊN LẠC / TIN NHẮN */}
                    <div className={`mt-5 px-2 pb-2 text-[10px] font-bold tracking-wider text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('chat')}</div>
                    <button
                        title={t("chat")}
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'chat' ? 'bg-[#e8f1fb] dark:bg-slate-800 text-[#174a7e] dark:text-blue-200 font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#174a7e] dark:before:bg-blue-400' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}
                        aria-current={activePage === 'chat' ? 'page' : undefined}
                        onClick={() => { onNavigate('chat'); onClose?.(); }}
                    >
                        <MessageSquare size={19} />
                        <span className={collapsed ? 'min-[801px]:hidden' : ''}>{t("chat")}</span>
                        {unreadCount > 0 && !collapsed && (
                            <span className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>


                </nav>

                <div className={`flex shrink-0 items-center gap-3 border-t border-slate-200 px-1 pt-4 dark:border-slate-800 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''}`}>
                    {user?.avatar_url || user?.avatar ? (
                        <img src={resolveMediaUrl(user.avatar_url || user.avatar)} alt={t("account")} className="size-9 shrink-0 rounded-full object-cover" />
                    ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                    )}
                    <div className={collapsed ? 'min-[801px]:hidden flex min-w-0 flex-col' : 'flex min-w-0 flex-col'}>
                        <strong className="truncate text-xs">{user?.username || 'User'}</strong>
                        <span className="mt-0.5 text-[10px] text-[#8190a7] dark:text-slate-400">
                            {user?.role === 'admin' ? t('administrator') : t('user')}
                        </span>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default StudentSidebar;