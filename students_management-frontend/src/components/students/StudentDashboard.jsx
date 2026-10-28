import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, GraduationCap, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { exportStudentsCsv } from '@/api/studentApi.js';
import { useLanguage } from '@/context/LanguageContext.jsx';
import StudentForm from '@/components/students/StudentForm.jsx';
import StudentTable from '@/components/students/StudentTable.jsx';
import StudentStats from '@/components/students/StudentStats.jsx';
import StudentSearch from '@/components/students/StudentSearch.jsx';
import StudentActivity from '@/components/students/StudentActivity.jsx';
import StudentClassStatistics from '@/components/students/StudentClassStatistics.jsx';
import StudentDetailsDialog from '@/components/students/StudentDetailsDialog.jsx';

function StudentDashboard({
    user,
    isAdmin = false,
    statistics,
    filteredCount,
    sortBy = 'id',
    sortOrder = 'asc',
    onSortChange,
    classFilter = '',
    genderFilter = '',
    classes = [],
    classesLoading = false,
    classesError = '',
    onClassFilterChange,
    onGenderFilterChange,
    onClearRosterFilters,
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
    const [viewingStudent, setViewingStudent] = useState(null);

    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        if (!isAdmin || exporting) return;
        setExporting(true);
        try {
            const blob = await exportStudentsCsv({
                search: search || undefined,
                classId: classFilter || undefined,
                gender: genderFilter || undefined
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'students-' + new Date().toISOString().slice(0, 10) + '.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success(t('downloadFile'));
        } catch (error) {
            let payload = error?.response?.data;
            if (payload instanceof Blob) {
                try {
                    payload = JSON.parse(await payload.text());
                } catch {
                    payload = null;
                }
            }
            toast.error(payload?.message || t('error'));
        } finally {
            setExporting(false);
        }
    };



    useEffect(() => {
        if (!isAdmin || !showForm) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = event => {
            if (event.key === 'Escape') onCloseForm?.();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isAdmin, showForm, onCloseForm]);

    return (
        <>
            <StudentStats user={user} statistics={statistics} filteredCount={filteredCount} />
            <div className="grid min-w-0 grid-cols-1 items-start gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_300px]">
                <div className="app-card min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-0 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-4 py-5 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/70">
                        <div className="flex min-w-0 items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-50 text-blue-800 ring-1 ring-inset ring-blue-200/70 dark:from-blue-950/80 dark:to-cyan-950/50 dark:text-blue-200 dark:ring-blue-900"><GraduationCap size={22} /></span><div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-blue-700 dark:text-blue-300">{t('studentManagement')}</p><h2 className="m-0 font-display text-lg font-bold text-slate-900 dark:text-white">{t('studentList')}</h2><p className="mt-1 mb-0 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('studentListDescription')}</p></div></div>
                        {isAdmin && <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><Download size={16} />{exporting ? t('loading') : 'CSV'} {t('downloadFile')}</button>
                            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-4 text-xs font-semibold text-white shadow-md shadow-blue-700/15 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25" onClick={onAdd}><Plus size={17} />{t('addStudent')}</button>
                        </div>}
                    </div>
                    <div className="px-4 pt-4 sm:px-6">
                        <StudentSearch value={search} onChange={onSearchChange} />
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{t('filterByClass')}</span>
                                <select
                                    value={classFilter}
                                    onChange={event => onClassFilterChange?.(event.target.value)}
                                    disabled={classesLoading}
                                    className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                >
                                    <option value="">{classesLoading ? t('loadingClasses') : t('allClasses')}</option>
                                    {classes.map(item => (
                                        <option key={item.id} value={String(item.id)}>
                                            {[item.class_code, item.class_name].filter(Boolean).join(' — ') || String(item.id)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{t('filterByGender')}</span>
                                <select
                                    value={genderFilter}
                                    onChange={event => onGenderFilterChange?.(event.target.value)}
                                    className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                >
                                    <option value="">{t('allGenders')}</option>
                                    <option value="Nam">{t('male')}</option>
                                    <option value="Nữ">{t('female')}</option>
                                </select>
                            </label>
                            {(classFilter || genderFilter) && (
                                <button
                                    type="button"
                                    onClick={onClearRosterFilters}
                                    className="self-end rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {t('clearFilters')}
                                </button>
                            )}
                        </div>
                        {classesError && <p role="status" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{classesError}</p>}
                    </div>
                    {error && <div role="alert" className="mx-4 mb-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs leading-5 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200 sm:mx-6"><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={onRetry} disabled={loading} className="min-h-9 shrink-0 rounded-lg border border-red-300 px-3 py-1.5 font-semibold transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/50">{t('retry')}</button></div>}
                    {loading && <div role="status" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><span className="size-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />{t('loadingStudentsData')}</div>}
                    <div className="w-full min-w-0">
                        <StudentTable
                            students={paginatedStudents}
                            firstRowNumber={firstStudentIndex}
                            onEdit={onEdit}
                            onView={setViewingStudent}
                            onDelete={onDelete}
                            canManage={isAdmin}
                            loading={loading}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={onSortChange}
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] text-muted sm:px-6 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                                {t('showing')} {firstStudentIndex}-{lastStudentIndex} {t('to')} {filteredCount} {t('resultsCount')}
                                {filteredCount !== statistics.totalStudents && ` (${t('total')}: ${statistics.totalStudents} ${t('totalStudentsSuffix')})`}
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
            {viewingStudent && (
                <StudentDetailsDialog
                    student={viewingStudent}
                    onClose={() => setViewingStudent(null)}
                    onEdit={student => {
                        setViewingStudent(null);
                        onEdit(student);
                    }}
                />
            )}
            {isAdmin && showForm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onCloseForm?.(); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="student-form-dialog-title" className="my-auto max-h-[min(90dvh,900px)] w-full max-w-[700px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-[22px] sm:px-[25px]">
                            <div><span className="text-[10px] font-bold tracking-widest text-blue-600">{t('studentManagement')}</span><h2 id="student-form-dialog-title" className="mt-1 mb-0 text-xl font-bold text-slate-900 dark:text-white">{selectedStudent ? t('updateStudent') : t('addStudent')}</h2></div>
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