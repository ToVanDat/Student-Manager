import {
    BarChart3,
    BookOpen,
    CalendarDays,
    ChevronRight,
    ClipboardList,
    GraduationCap,
    Home,
    Layers,
    Settings,
    Sparkles,
    Users,
} from 'lucide-react';

function StudentSidebar({
    user,
    activePage,
    totalStudents,
    isOpen,
    onClose,
    onNavigate,
    onOpenSettings,
}) {
    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside className={isOpen ? 'sidebar sidebar-open' : 'sidebar'}>
                <div className="brand">
                    <div className="brand-logo">
                        <GraduationCap size={27} />
                    </div>
                    <div>
                        <strong>StudentOS</strong>
                        <span>Academic Management</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-title">TỔNG QUAN</div>
                    <button
                        className={activePage === 'dashboard' ? 'nav-item active' : 'nav-item'}
                        onClick={onNavigate}
                    >
                        <Home size={19} />
                        <span>Trang chủ</span>
                    </button>
                    <button
                        className={activePage === 'students' ? 'nav-item active' : 'nav-item'}
                        onClick={onNavigate}
                    >
                        <Users size={19} />
                        <span>Sinh viên</span>
                        <span className="nav-badge">{totalStudents}</span>
                    </button>
                    <button className="nav-item">
                        <Layers size={19} />
                        <span>Lớp học</span>
                    </button>
                    <button className="nav-item">
                        <GraduationCap size={19} />
                        <span>Khoa - Ngành</span>
                    </button>

                    <div className="nav-section-title second">QUẢN LÝ ĐÀO TẠO</div>
                    <button className="nav-item">
                        <BookOpen size={19} />
                        <span>Môn học</span>
                    </button>
                    <button className="nav-item">
                        <ClipboardList size={19} />
                        <span>Đăng ký học</span>
                    </button>
                    <button className="nav-item">
                        <CalendarDays size={19} />
                        <span>Học kỳ</span>
                    </button>
                    <button className="nav-item">
                        <BarChart3 size={19} />
                        <span>Báo cáo</span>
                    </button>
                    <button
                        className={activePage === 'settings' ? 'nav-item active' : 'nav-item'}
                        onClick={onOpenSettings}
                    >
                        <Settings size={19} />
                        <span>Cài đặt</span>
                    </button>
                </nav>

                <div className="learning-card">
                    <div className="learning-card-content">
                        <span className="learning-label">HỌC TẬP</span>
                        <h3>Học tập là hành trình không có điểm dừng</h3>
                        <button>
                            Khám phá
                            <ChevronRight size={15} />
                        </button>
                    </div>
                    <div className="learning-decoration">
                        <Sparkles size={70} />
                    </div>
                </div>

                <div className="sidebar-footer">
                    <div className="footer-avatar">
                        {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="footer-user">
                        <strong>{user?.username || 'User'}</strong>
                        <span>
                            {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                        </span>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default StudentSidebar;