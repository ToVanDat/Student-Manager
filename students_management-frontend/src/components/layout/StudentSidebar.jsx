import { resolveMediaUrl } from '@/utils/mediaUrl.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import {
    BarChart3,
    BookOpen,
    CalendarDays,
    ClipboardList,
    GraduationCap,
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
    return (
        <>
            {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 min-[801px]:hidden" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] -translate-x-full flex-col bg-[#f8faff] dark:bg-slate-950 px-[15px] py-[22px] text-[#263852] dark:text-slate-100 shadow-[8px_0_28px_rgba(38,56,82,0.06)] transition-[width,transform,padding] duration-200 min-[801px]:translate-x-0 ${collapsed ? 'min-[801px]:w-[72px] min-[801px]:px-2' : 'max-[1100px]:w-[220px]'} ${isOpen ? 'translate-x-0' : ''}`}>
                <div className={`mb-[30px] flex items-center gap-3 px-2 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''}`}>
                    <div className="flex size-[43px] items-center justify-center rounded-[13px] bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                        <GraduationCap size={27} className="text-white" />
                    </div>
                    <div className={collapsed ? 'min-[801px]:hidden flex flex-col' : 'flex flex-col'}>
                        <strong className="text-sm font-bold">StudentOS</strong>
                        <span className="mt-0.5 text-[10px] text-[#8190a7] dark:text-slate-400">{user?.role === 'admin' ? t('administrator') : t('user')}</span>
                    </div>
                </div>

                <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className={`px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('overviewGroup')}</div>
                    <button
                        title={t("home")}
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'dashboard' ? 'bg-[#dcecff] dark:bg-blue-950 text-[#1d4ed8] dark:text-blue-200 shadow-sm shadow-blue-100 dark:shadow-none' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}
                        onClick={() => onNavigate('dashboard')}
                    >
                        <Home size={19} />
                        <span className={collapsed ? 'min-[801px]:hidden' : ''}>{t("home")}</span>
                    </button>
                    <button
                        title={t("students")}
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'students' ? 'bg-[#dbeafe] dark:bg-blue-950 text-[#1d4ed8] dark:text-blue-200 shadow-sm shadow-blue-100 dark:shadow-none' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}
                        onClick={() => onNavigate('students')}
                    >
                        <Users size={19} />
                        <span className={collapsed ? 'min-[801px]:hidden' : ''}>{t("students")}</span>
                        <span className={`ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{totalStudents}</span>
                    </button>
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
                                    onClick={() => onNavigate(key)}
                                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === key ? 'bg-[#dbeafe] dark:bg-blue-950 text-[#1d4ed8] dark:text-blue-200 shadow-sm shadow-blue-100 dark:shadow-none' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}>
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
                                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === key ? 'bg-[#dbeafe] dark:bg-blue-950 text-[#1d4ed8] dark:text-blue-200 shadow-sm shadow-blue-100 dark:shadow-none' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}>
                                    <Icon size={19} /><span className={collapsed ? 'min-[801px]:hidden' : ''}>{label}</span>
                                </button>
                            ))}
                        </>
                    )}

                    {/* THÊM MỤC LIÊN LẠC / TIN NHẮN */}
                    <div className={`mt-5 px-2 pb-2 text-[10px] font-bold tracking-wider text-[#7b8ba5] dark:text-slate-400 ${collapsed ? 'min-[801px]:hidden' : ''}`}>{t('chat')}</div>
                    <button
                        title={t("chat")}
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''} ${activePage === 'chat' ? 'bg-[#dbeafe] dark:bg-blue-950 text-[#1d4ed8] dark:text-blue-200 font-semibold shadow-sm shadow-blue-100 dark:shadow-none' : 'text-[#334155] dark:text-slate-300 hover:bg-[#e8f1ff] dark:hover:bg-slate-800 hover:text-[#1d4ed8] dark:hover:text-blue-300'}`}
                        onClick={() => onNavigate('chat')}
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

                <div className={`flex shrink-0 items-center gap-3 border-t border-slate-200 px-1 pt-4 ${collapsed ? 'min-[801px]:justify-center min-[801px]:px-0' : ''}`}>
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