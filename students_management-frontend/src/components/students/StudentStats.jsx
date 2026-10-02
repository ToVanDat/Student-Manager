import { BookOpen, CalendarDays, ChevronRight, Sparkles, User, Users } from 'lucide-react';

function StudentStats({ user, statistics, filteredCount }) {
    return (
        <>
            <div className="welcome-row">
                <div>
                    <div className="welcome-title">
                        <span>👋</span>
                        <h1>Xin chào, {user?.username || 'bạn'}!</h1>
                    </div>
                    <p>Chúc bạn có một ngày làm việc hiệu quả.</p>
                    <div className="current-date">
                        <CalendarDays size={16} />
                        {new Date().toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </div>
                </div>
                <div className="quote-banner">
                    <div className="quote-overlay" />
                    <div className="quote-content">
                        <span>“Tri thức là chìa khóa mở ra tương lai.”</span>
                        <button>Xem thêm<ChevronRight size={15} /></button>
                    </div>
                </div>
            </div>
            <div className="stats-grid">
                <div className="stat-card blue">
                    <div className="stat-icon"><Users size={23} /></div>
                    <div className="stat-info"><span>Tổng số sinh viên</span><strong>{statistics.totalStudents}</strong><small>Sinh viên đang quản lý</small></div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon"><BookOpen size={23} /></div>
                    <div className="stat-info"><span>Lớp học</span><strong>{statistics.totalClasses}</strong><small>Lớp đang có sinh viên</small></div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon"><User size={23} /></div>
                    <div className="stat-info"><span>Phân bố giới tính</span><strong>{statistics.male}<small className="inline"> Nam</small></strong><small>{statistics.female} nữ</small></div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon"><Sparkles size={23} /></div>
                    <div className="stat-info"><span>Dữ liệu hệ thống</span><strong>{filteredCount}</strong><small>Kết quả đang hiển thị</small></div>
                </div>
            </div>
        </>
    );
}

export default StudentStats;