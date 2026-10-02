import { ChevronRight, GraduationCap, Plus } from 'lucide-react';
import StudentForm from '@/components/students/StudentForm.jsx';
import StudentTable from '@/components/students/StudentTable.jsx';
import StudentStats from '@/components/students/StudentStats.jsx';
import StudentSearch from '@/components/students/StudentSearch.jsx';
import StudentActivity from '@/components/students/StudentActivity.jsx';
import StudentClassStatistics from '@/components/students/StudentClassStatistics.jsx';

function StudentDashboard({
    user,
    statistics,
    filteredCount,
    students,
    filteredStudents,
    error,
    search,
    onSearchChange,
    onAdd,
    onEdit,
    onDelete,
    classStatistics,
    showForm,
    selectedStudent,
    onSubmit,
    onCloseForm,
}) {
    return (
        <>
            <StudentStats user={user} statistics={statistics} filteredCount={filteredCount} />
            <div className="dashboard-grid">
                <div className="panel student-panel">
                    <div className="panel-header">
                        <div><h2>Danh sách sinh viên</h2><p>Quản lý thông tin và theo dõi học tập của sinh viên</p></div>
                        <button className="primary-button" onClick={onAdd}><Plus size={18} />Thêm sinh viên</button>
                    </div>
                    <StudentSearch value={search} onChange={onSearchChange} />
                    {error && <div className="dashboard-error">{error}</div>}
                    <div className="student-table-wrapper">
                        <StudentTable students={filteredStudents} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                    <div className="table-footer">
                        <span>Hiển thị {filteredStudents.length} trong tổng số {students.length} sinh viên</span>
                        <div className="pagination"><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>…</button><button>›</button></div>
                    </div>
                </div>
                <div className="right-column">
                    <StudentActivity />
                    <StudentClassStatistics classStatistics={classStatistics} />
                    <div className="quick-card">
                        <div className="quick-card-icon"><GraduationCap size={25} /></div>
                        <div><h3>Quản lý đào tạo</h3><p>Theo dõi lớp học, môn học và đăng ký học tập.</p></div>
                        <ChevronRight />
                    </div>
                </div>
            </div>
            {showForm && (
                <div className="modal-backdrop">
                    <div className="student-modal">
                        <div className="modal-header">
                            <div><span>QUẢN LÝ SINH VIÊN</span><h2>{selectedStudent ? 'Cập nhật sinh viên' : 'Thêm sinh viên'}</h2></div>
                            <button className="modal-close" onClick={onCloseForm}>×</button>
                        </div>
                        <div className="modal-body">
                            <StudentForm student={selectedStudent} onSubmit={onSubmit} onCancel={onCloseForm} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default StudentDashboard;