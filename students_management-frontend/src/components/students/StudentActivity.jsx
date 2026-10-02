import { ClipboardList, Pencil, Plus, Users } from 'lucide-react';

function StudentActivity() {
    return (
        <div className="panel activity-panel">
            <div className="panel-header compact">
                <div><h2>Hoạt động gần đây</h2></div>
                <button className="text-button">Xem tất cả</button>
            </div>
            <div className="activity-list">
                <div className="activity-item">
                    <div className="activity-icon green"><Plus size={17} /></div>
                    <div><strong>Thêm mới sinh viên</strong><span>Hệ thống quản lý</span></div>
                    <small>Vừa xong</small>
                </div>
                <div className="activity-item">
                    <div className="activity-icon blue"><Pencil size={16} /></div>
                    <div><strong>Cập nhật thông tin</strong><span>Dữ liệu sinh viên</span></div>
                    <small>Gần đây</small>
                </div>
                <div className="activity-item">
                    <div className="activity-icon purple"><ClipboardList size={16} /></div>
                    <div><strong>Quản lý đăng ký học</strong><span>Theo dõi học tập</span></div>
                    <small>Hôm nay</small>
                </div>
                <div className="activity-item">
                    <div className="activity-icon orange"><Users size={16} /></div>
                    <div><strong>Quản lý sinh viên</strong><span>Danh sách hiện tại</span></div>
                    <small>Hôm nay</small>
                </div>
            </div>
        </div>
    );
}

export default StudentActivity;