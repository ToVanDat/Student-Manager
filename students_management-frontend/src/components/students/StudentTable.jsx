import { useLanguage } from '@/context/LanguageContext.jsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Trash2, GraduationCap } from 'lucide-react';

function StudentTable({
    students,
    firstRowNumber,
    onView,
    onEdit,
    onDelete,
    canManage = false,
    loading = false,
    sortBy = 'id',
    sortOrder = 'asc',
    onSortChange,
}) {
    const { t } = useLanguage();
    const emptyMessage = loading ? t('loadingStudents') : t('noStudentsShort');
    const sortOptions = [
        { value: 'id', label: t('studentNumber') },
        { value: 'student_code', label: t('studentCodeShort') },
        { value: 'name', label: t('studentName') },
        { value: 'email', label: 'Email' },
        { value: 'date_of_birth', label: t('dateOfBirthShort') },
        { value: 'gender', label: t('gender') },
        { value: 'class_code', label: t('className') },
    ];
    const renderSortHeader = (column, label, widthClass) => (
        <th
            key={column}
            className={`${widthClass} px-3 py-3.5 font-semibold`}
            aria-sort={sortBy === column ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <button
                type="button"
                onClick={() => onSortChange?.(column)}
                className="inline-flex max-w-full items-center gap-1.5 text-left hover:text-brand-700 dark:hover:text-blue-300"
                aria-label={`${t('sortBy')} ${label}`}
            >
                <span className="truncate">{label}</span>
                {sortBy !== column ? <ArrowUpDown size={13} className="shrink-0 opacity-40" /> : sortOrder === 'asc' ? <ArrowUp size={13} className="shrink-0" /> : <ArrowDown size={13} className="shrink-0" />}
            </button>
        </th>
    );

    return (
        <div className="w-full min-w-0">
            <div className="flex items-center justify-end gap-2 px-4 pb-3 lg:hidden">
                <label htmlFor="student-mobile-sort" className="text-xs text-slate-500 dark:text-slate-400">{t('sortBy')}</label>
                <select
                    id="student-mobile-sort"
                    value={sortOptions.some(option => option.value === sortBy) ? sortBy : 'id'}
                    onChange={event => onSortChange?.(event.target.value)}
                    className="max-w-[58%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                    {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button
                    type="button"
                    onClick={() => onSortChange?.(sortBy)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    title={sortOrder === 'asc' ? t('sortDescending') : t('sortAscending')}
                    aria-label={sortOrder === 'asc' ? t('sortDescending') : t('sortAscending')}
                >
                    {sortOrder === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                </button>
            </div>
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:hidden">
                {loading || students.length === 0 ? (
                    <div className="app-card col-span-full border-dashed px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</div>
                ) : students.map((student, index) => (
                    <article key={student.id} className="app-card min-w-0 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"><GraduationCap size={20} /></div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{student.name || '-'}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-blue-700 dark:text-blue-300">{student.student_code || '-'}</p>
                            </div>
                            <span className="text-[10px] text-slate-400">#{firstRowNumber + index}</span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                            <div className="min-w-0"><dt className="text-[10px] text-slate-400">Email</dt><dd className="mt-1 break-words text-slate-700 dark:text-slate-300">{student.email || '-'}</dd></div>
                            <div><dt className="text-[10px] text-slate-400">{t('dateOfBirthShort')}</dt><dd className="mt-1 text-slate-700 dark:text-slate-300">{student.date_of_birth || '-'}</dd></div>
                            <div><dt className="text-[10px] text-slate-400">{t('gender')}</dt><dd className="mt-1 text-slate-700 dark:text-slate-300">{student.gender || '-'}</dd></div>
                            <div className="min-w-0"><dt className="text-[10px] text-slate-400">{t('className')}</dt><dd className="mt-1 break-words text-slate-700 dark:text-slate-300">{student.class_code ? student.class_code + ' - ' + student.class_name : (student.class_id || '-')}</dd></div>
                        </dl>
                        {onView && <button type="button" className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => onView(student)}><Eye size={14} />{t('viewDetails')}</button>}
                        {canManage && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <button type="button" className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/50" onClick={() => onEdit(student)}><Pencil size={14} />{t('edit')}</button>
                            <button type="button" className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50" onClick={() => onDelete(student.id)}><Trash2 size={14} />{t('delete')}</button>
                        </div>}
                    </article>
                ))}
            </div>

            <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
                <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                            {renderSortHeader('id', t('studentNumber'), 'w-12')}
                            {renderSortHeader('student_code', t('studentCodeShort'), 'w-24')}
                            {renderSortHeader('name', t('studentName'), 'w-36')}
                            {renderSortHeader('email', 'Email', 'w-44')}
                            {renderSortHeader('date_of_birth', t('dateOfBirthShort'), 'w-32')}
                            {renderSortHeader('gender', t('gender'), 'w-20')}
                            {renderSortHeader('class_code', t('className'), 'w-40')}
                            {(canManage || onView) && <th className={`${canManage ? 'w-32' : 'w-12'} px-3 py-3.5`}>{canManage ? t('actions') : t('viewDetails')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={(canManage || onView) ? 8 : 7} className="px-4 py-10 text-center text-slate-400">{t('loadingStudents')}</td></tr>
                        ) : students.length === 0 ? (
                            <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-slate-400">{t('noStudentsShort')}</td></tr>
                        ) : students.map((student, index) => (
                            <tr className="border-t border-slate-100 transition-colors hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-slate-800/60" key={student.id}>
                                <td className="truncate px-3 py-3.5 text-slate-500">{firstRowNumber + index}</td>
                                <td className="truncate px-3 py-3.5 font-semibold text-slate-700 dark:text-slate-200" title={student.student_code}>{student.student_code}</td>
                                <td className="truncate px-3 py-3.5 font-medium text-slate-800 dark:text-slate-200" title={student.name}>{student.name}</td>
                                <td className="truncate px-3 py-3.5 text-slate-500" title={student.email}>{student.email}</td>
                                <td className="truncate px-3 py-3.5 text-slate-500">{student.date_of_birth || '-'}</td>
                                <td className="truncate px-3 py-3.5 text-slate-500">{student.gender || '-'}</td>
                                <td className="truncate px-3 py-3.5 text-slate-500" title={student.class_code ? student.class_code + ' - ' + student.class_name : String(student.class_id)}>{student.class_code ? student.class_code + ' - ' + student.class_name : student.class_id}</td>
                                {(canManage || onView) && <td className="px-3 py-3">
                                    <div className="flex items-center gap-1.5">
                                        {onView && <button type="button" title={t('viewDetails')} aria-label={t('viewDetails') + ' ' + (student.name || '')} className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => onView(student)}><Eye size={14} /></button>}
                                        {canManage && <button type="button" title={t('edit')} aria-label={t('edit') + ' ' + (student.name || '')} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/50" onClick={() => onEdit(student)}><Pencil size={12} />{t('edit')}</button>}
                                        {canManage && <button type="button" title={t('delete')} aria-label={t('delete') + ' ' + (student.name || '')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50" onClick={() => onDelete(student.id)}><Trash2 size={12} />{t('delete')}</button>}
                                    </div>
                                </td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default StudentTable;
