import { ChevronLeft, ChevronRight, GraduationCap, Plus } from 'lucide-react';
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
    paginatedStudents,
    currentPage,
    pageCount,
    pageSize,
    firstStudentIndex,
    lastStudentIndex,
    onPageChange,
    onPageSizeChange,
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
    const pageItems = Array.from(
        new Set([
            1,
            pageCount,
            ...Array.from(
                { length: Math.min(3, pageCount) },
                (_, index) => currentPage + index - 1,
            ).filter((page) => page > 1 && page < pageCount),
        ]),
    ).sort((left, right) => left - right);

    const pagesWithEllipses = pageItems.flatMap((page, index) => {
        const previousPage = pageItems[index - 1];
        return [
            ...(previousPage && page - previousPage > 1 ? [`ellipsis-${page}`] : []),
            page,
        ];
    });

    return (
        <>
            <StudentStats user={user} statistics={statistics} filteredCount={filteredCount} />
            <div className="grid grid-cols-1 items-start gap-5 min-[1600px]:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-panel dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-5">
                        <div><h2 className="m-0 font-display text-base font-bold text-ink dark:text-white">Danh sách sinh viên</h2><p className="mt-1 mb-0 text-xs text-muted">Quản lý thông tin và theo dõi học tập của sinh viên</p></div>
                        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-linear-to-r from-brand-600 to-brand-500 px-3.5 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition hover:-translate-y-px hover:shadow-lg hover:shadow-brand-600/25" onClick={onAdd}><Plus size={17} />Thêm sinh viên</button>
                    </div>
                    <div className="px-4 sm:px-5">
                        <StudentSearch value={search} onChange={onSearchChange} />
                    </div>
                    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}
                    <div className="w-full min-w-0">
                        <StudentTable
                            students={paginatedStudents}
                            firstRowNumber={firstStudentIndex}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-muted sm:px-5 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                                Hiển thị {firstStudentIndex}-{lastStudentIndex} trong {filteredStudents.length} kết quả
                                {filteredStudents.length !== students.length && ` (tổng ${students.length} sinh viên)`}
                            </span>
                            <label className="flex items-center gap-1.5">
                                <span>Số dòng</span>
                                <select
                                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    value={pageSize}
                                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                                    aria-label="Số sinh viên mỗi trang"
                                >
                                    {[10, 25, 50].map((size) => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <nav className="flex items-center gap-1" aria-label="Phân trang danh sách sinh viên">
                            <button
                                className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                                type="button"
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                                aria-label="Trang trước"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            {pagesWithEllipses.map((page) => (
                                typeof page === 'string' ? (
                                    <span className="flex size-8 items-center justify-center text-slate-400" key={page} aria-hidden="true">…</span>
                                ) : (
                                    <button
                                        className={`flex size-8 items-center justify-center rounded-md text-[11px] font-semibold ${page === currentPage ? 'bg-brand-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                        key={page}
                                        type="button"
                                        onClick={() => onPageChange(page)}
                                        aria-label={`Trang ${page}`}
                                        aria-current={page === currentPage ? 'page' : undefined}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                            <button
                                className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                                type="button"
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage >= pageCount}
                                aria-label="Trang sau"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </nav>
                    </div>
                </div>
                <div className="grid gap-[17px]">
                    <StudentActivity />
                    <StudentClassStatistics classStatistics={classStatistics} />
                    <div className="flex min-h-[100px] items-center gap-3 rounded-[13px] bg-linear-to-br from-[#5269e9] to-[#6256d9] p-[17px] text-white shadow-xl shadow-indigo-700/20">
                        <div className="flex size-[43px] shrink-0 items-center justify-center rounded-[11px] bg-white/15"><GraduationCap size={25} /></div>
                        <div className="min-w-0 flex-1"><h3 className="m-0 text-[13px] font-bold">Quản lý đào tạo</h3><p className="mt-1 mb-0 text-[9px] leading-[1.4] text-indigo-100">Theo dõi lớp học, môn học và đăng ký học tập.</p></div>
                        <ChevronRight className="shrink-0" size={18} />
                    </div>
                </div>
            </div>
            {showForm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-[18px] bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-[22px] sm:px-[25px]">
                            <div><span className="text-[10px] font-bold tracking-widest text-blue-600">QUẢN LÝ SINH VIÊN</span><h2 className="mt-1 mb-0 text-xl font-bold text-slate-900 dark:text-white">{selectedStudent ? 'Cập nhật sinh viên' : 'Thêm sinh viên'}</h2></div>
                            <button className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xl text-slate-500 hover:bg-red-100 hover:text-red-600 dark:bg-slate-800" onClick={onCloseForm} aria-label="Đóng">×</button>
                        </div>
                        <div className="px-5 py-5 sm:px-8">
                            <StudentForm student={selectedStudent} onSubmit={onSubmit} onCancel={onCloseForm} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default StudentDashboard;