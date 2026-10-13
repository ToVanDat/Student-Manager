import {
    BarChart3,
    BookOpen,
    CalendarDays,
    ChevronRight,
    ClipboardList,
    GraduationCap,
    Home,
    Layers,
    MessageSquare, // Import icon Tin nhắn
    Settings,
    Sparkles,
    Users,
    ShieldCheck,
    Bell,
    UserCog,
    ChartNoAxesColumn,
    Phone,
} from 'lucide-react';

function StudentSidebar({
    user,
    activePage,
    totalStudents,
    isOpen,
    onClose,
    onNavigate,
    onOpenSettings,
    unreadCount = 0 // Thêm prop nhận số tin nhắn chưa đọc (nếu có)
}) {
    return (
        <>
            {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 min-[801px]:hidden" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] -translate-x-full flex-col bg-[#f8faff] px-[15px] py-[22px] text-[#263852] shadow-[8px_0_28px_rgba(38,56,82,0.06)] transition-transform duration-200 min-[801px]:translate-x-0 max-[1100px]:w-[220px] ${isOpen ? 'translate-x-0' : ''}`}>
                <div className="mb-[30px] flex items-center gap-3 px-2">
                    <div className="flex size-[43px] items-center justify-center rounded-[13px] bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                        <GraduationCap size={27} />
                    </div>
                    <div className="flex flex-col">
                        <strong className="text-sm font-bold">StudentOS</strong>
                        <span className="mt-0.5 text-[10px] text-[#8190a7]">{user?.role === 'admin' ? 'Admin Console' : 'Student Portal'}</span>
                    </div>
                </div>

                <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5]">TỔNG QUAN</div>
                    <button
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === 'dashboard' ? 'bg-[#dcecff] text-[#1d4ed8] shadow-sm shadow-blue-100' : 'text-[#64748b] hover:bg-[#eaf3ff] hover:text-[#1d4ed8]'}`}
                        onClick={() => onNavigate('dashboard')}
                    >
                        <Home size={19} />
                        <span>Trang chủ</span>
                    </button>
                    <button
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === 'students' ? 'bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/25' : 'text-slate-300 hover:bg-[#eaf3ff] hover:text-white'}`}
                        onClick={() => onNavigate('students')}
                    >
                        <Users size={19} />
                        <span>Sinh viên</span>
                        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{totalStudents}</span>
                    </button>
                    {user?.role === 'admin' && (
                        <>
                            <div className="mt-5 px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5]">QUẢN LÝ ĐÀO TẠO</div>
                            {[
                                { key: 'classes', label: 'Quản lý lớp học', icon: Layers },
                                { key: 'departments', label: 'Quản lý khoa - ngành', icon: GraduationCap },
                                { key: 'subjects', label: 'Quản lý môn học', icon: BookOpen },
                                { key: 'enrollments', label: 'Đăng ký học', icon: ClipboardList },
                                { key: 'semesters', label: 'Học kỳ', icon: CalendarDays },
                                { key: 'results', label: 'Kết quả học tập', icon: ChartNoAxesColumn },
                            ].map(({ key, label, icon: Icon }) => (
                                <button key={key} type="button" onClick={() => onNavigate(key)}
                                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === key ? 'bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/25' : 'text-slate-300 hover:bg-[#eaf3ff] hover:text-white'}`}>
                                    <Icon size={19} /><span>{label}</span>
                                </button>
                            ))}
                            <div className="mt-5 px-2 pb-2 text-[10px] font-bold tracking-[.12em] text-[#7b8ba5]">QUẢN TRỊ HỆ THỐNG</div>
                            {[
                                { key: 'users', label: 'Người dùng', icon: UserCog },
                                { key: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
                                { key: 'notifications', label: 'Thông báo', icon: Bell },
                                { key: 'calls', label: 'Cuộc gọi', icon: Phone },
                            ].map(({ key, label, icon: Icon }) => (
                                <button key={key} type="button" onClick={() => onNavigate(key)}
                                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === key ? 'bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/25' : 'text-slate-300 hover:bg-[#eaf3ff] hover:text-white'}`}>
                                    <Icon size={19} /><span>{label}</span>
                                </button>
                            ))}
                        </>
                    )}

                    {/* THÊM MỤC LIÊN LẠC / TIN NHẮN */}
                    <div className="mt-5 px-2 pb-2 text-[10px] font-bold tracking-wider text-[#7b8ba5]">LIÊN LẠC</div>
                    <button
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === 'chat' ? 'bg-linear-to-r from-blue-600 to-blue-500 text-white font-semibold shadow-md shadow-blue-950/25' : 'text-slate-300 hover:bg-[#eaf3ff] hover:text-white'}`}
                        onClick={() => onNavigate('chat')}
                    >
                        <MessageSquare size={19} />
                        <span>Tin nhắn</span>
                        {unreadCount > 0 && (
                            <span className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition ${activePage === 'settings' ? 'bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/25' : 'text-slate-300 hover:bg-[#eaf3ff] hover:text-white'}`}
                        onClick={onOpenSettings}
                    >
                        <Settings size={19} />
                        <span>Cài đặt</span>
                    </button>
                </nav>

                <div className="relative mt-auto mb-4 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-white/[.08] to-white/[.02] p-4 shadow-lg shadow-black/10">
                    <div className="relative z-10">
                        <span className="text-[9px] font-bold tracking-widest text-cyan-300">HỌC TẬP</span>
                        <h3 className="my-2 text-xs leading-relaxed font-semibold">Học tập là hành trình không có điểm dừng</h3>
                        <button className="flex items-center gap-1 border-0 bg-transparent p-0 text-[10px] font-semibold text-blue-200 hover:text-white">
                            Khám phá
                            <ChevronRight size={15} />
                        </button>
                    </div>
                    <Sparkles className="absolute -right-3 -bottom-3 text-white/10" size={64} />
                </div>

                <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-1 pt-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-100">
                        {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <strong className="truncate text-xs">{user?.username || 'User'}</strong>
                        <span className="mt-0.5 text-[10px] text-[#8190a7]">
                            {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                        </span>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default StudentSidebar;