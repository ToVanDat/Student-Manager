// Student list table
import { useLanguage } from '@/context/LanguageContext.jsx';
function StudentTable({ students, firstRowNumber, onEdit, onDelete, canManage = false, loading = false }) {
    const { t } = useLanguage();
    return (
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                        <th className="w-12 px-2 py-3">{t('studentNumber')}</th>
                        <th className="w-20 px-2 py-3">{t('studentCodeShort')}</th>
                        <th className="w-28 px-2 py-3">{t('studentName')}</th>
                        <th className="w-40 px-2 py-3">Email</th>
                        <th className="w-32 px-2 py-3">{t('dateOfBirthShort')}</th>
                        <th className="w-20 px-2 py-3">{t('gender')}</th>
                        <th className="w-40 px-2 py-3">{t('className')}</th>
                        {canManage && <th className="w-28 px-2 py-3">{t('actions')}</th>}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-slate-400">{t('loadingStudents')}</td></tr>
                    ) : students.length === 0 ? (
                        <tr>
                            <td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                                {t('noStudentsShort')}
                            </td>
                        </tr>
                    ) : (
                        students.map((student, index) => (
                            <tr className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60" key={student.id}>
                                <td className="truncate px-2 py-3 text-slate-500">{firstRowNumber + index}</td>

                                <td className="truncate px-2 py-3 font-medium text-slate-700 dark:text-slate-200" title={student.student_code}>{student.student_code}</td>

                                <td className="truncate px-2 py-3 text-slate-700 dark:text-slate-200" title={student.name}>{student.name}</td>

                                <td className="truncate px-2 py-3 text-slate-500" title={student.email}>{student.email}</td>

                                <td className="truncate px-2 py-3 text-slate-500" title={student.date_of_birth || '-'}>
                                    {student.date_of_birth
                                        ? student.date_of_birth
                                        : '-'}
                                </td>

                                <td className="truncate px-2 py-3 text-slate-500" title={student.gender || '-'}>
                                    {student.gender
                                        ? student.gender
                                        : '-'}
                                </td>

                                <td className="truncate px-2 py-3 text-slate-500" title={student.class_code ? `${student.class_code} - ${student.class_name}` : String(student.class_id)}>
                                    {student.class_code
                                        ? `${student.class_code} - ${student.class_name}`
                                        : student.class_id}
                                </td>

                                {canManage && <td className="px-2 py-3">
                                    <div className="flex items-center gap-1">
                                    <button
                                        className="rounded-md bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600"
                                        onClick={() => onEdit(student)}
                                    >
                                        {t('edit')}
                                    </button>

                                    <button
                                        className="rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                                        onClick={() => onDelete(student.id)}
                                    >
                                        {t('delete')}
                                    </button>
                                    </div>
                                </td>}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default StudentTable;