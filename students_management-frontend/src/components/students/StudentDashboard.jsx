import { ChevronLeft, ChevronRight, GraduationCap, Plus } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext.jsx';
import StudentForm from '@/components/students/StudentForm.jsx';
import StudentTable from '@/components/students/StudentTable.jsx';
import StudentStats from '@/components/students/StudentStats.jsx';
import StudentSearch from '@/components/students/StudentSearch.jsx';
import StudentActivity from '@/components/students/StudentActivity.jsx';
import StudentClassStatistics from '@/components/students/StudentClassStatistics.jsx';

function StudentDashboard({
    user,
    isAdmin = false,
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
    loading = false,
    onRetry,
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

    const { t } = useLanguage();
    return (
        <>
            <StudentStats user={user} statistics={statistics} filteredCount={filteredCount} />
            <div className="grid min-w-0 grid-cols-1 items-start gap-5 min-[1600px]:grid-cols-[minmax(0,1fr)_320px]">
                <div className="app-card min-w-0 overflow-hidden">
                    <div className="mb-0 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex min-w-0 items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"><GraduationCap size={22} /></span><div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-blue-700 dark:text-blue-300">{t('studentManagement')}</p><h2 className="m-0 font-display text-lg font-bold text-slate-900 dark:text-white">{t('studentList')}</h2><p className="mt-1 mb-0 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('studentListDescription')}</p></div></div>
                        {isAdmin && <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#174a7e] px-4 text-xs font-semibold text-white transition hover:bg-[#123b66]" onClick={onAdd}><Plus size={17} />{t('addStudent')}</button>}
                    </div>
                    <div className="px-4 pt-4 sm:px-6">
                        <StudentSearch value={search} onChange={onSearchChange} />
                    </div>
                    {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"><span>{error}</span><button type="button" onClick={onRetry} disabled={loading} className="rounded border border-red-300 px-3 py-1.5 font-semibold hover:bg-red-100 disabled:opacity-50">{t('retry')}</button></div>}
                    {loading && <div role="status" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><span className="size-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />{t('loadingStudentsData')}</div>}
                    <div className="w-full min-w-0">
                        <StudentTable
                            students={paginatedStudents}
                            firstRowNumber={firstStudentIndex}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            canManage={isAdmin}
                            loading={loading}
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] text-muted sm:px-6 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                                {t('showing')} {firstStudentIndex}-{lastStudentIndex} {t('to')} {filteredStudents.length} {t('resultsCount')}
                                {filteredStudents.length !== students.length && ` (${t('total')}: ${students.length} ${t('totalStudentsSuffix')})`}
                            </span>
                            <label className="flex items-center gap-1.5">
                                <span>{t('rows')}</span>
                                <select
                                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    value={pageSize}
                                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                                    aria-label={t("studentsPerPage")}
                                >
                                    {[10, 25, 50].map((size) => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <nav className="flex items-center gap-1" aria-label={t("studentPagination")}>
                            <button
                                className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                                type="button"
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                                aria-label={t("previousPage")}
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
                                        aria-label={`${t("page")} ${page}`}
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
                                aria-label={t("nextPage")}
                            >
                                <ChevronRight size={15} />
                            </button>
                        </nav>
                    </div>
                </div>
                <div className="grid gap-4">
                    <StudentActivity />
                    <StudentClassStatistics classStatistics={classStatistics} />
                    <div className="flex min-h-[100px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-800 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><GraduationCap size={25} /></div>
                        <div className="min-w-0 flex-1"><h3 className="m-0 text-[13px] font-semibold">{t("academicManagement")}</h3><p className="mt-1 mb-0 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('studentOverviewCard')}</p></div>
                    </div>
                </div>
            </div>
            {isAdmin && showForm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-[22px] sm:px-[25px]">
                            <div><span className="text-[10px] font-bold tracking-widest text-blue-600">{t('studentManagement')}</span><h2 className="mt-1 mb-0 text-xl font-bold text-slate-900 dark:text-white">{selectedStudent ? t('updateStudent') : t('addStudent')}</h2></div>
                            <button className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xl text-slate-500 hover:bg-red-100 hover:text-red-600 dark:bg-slate-800" onClick={onCloseForm} aria-label={t("close")}>×</button>
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