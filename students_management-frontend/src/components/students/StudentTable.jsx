// bang danh sach sinh vien
function StudentTable({ students, firstRowNumber, onEdit, onDelete }) {
    return (
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                        <th className="w-12 px-2 py-3">STT</th>
                        <th className="w-20 px-2 py-3">Mã SV</th>
                        <th className="w-28 px-2 py-3">Họ tên</th>
                        <th className="w-40 px-2 py-3">Email</th>
                        <th className="w-32 px-2 py-3">Ngày sinh</th>
                        <th className="w-20 px-2 py-3">Giới tính</th>
                        <th className="w-40 px-2 py-3">Lớp</th>
                        <th className="w-28 px-2 py-3">Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    {students.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="px-4 py-10 text-center text-slate-400">
                                Chưa có sinh viên
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

                                <td className="px-2 py-3">
                                    <div className="flex items-center gap-1">
                                    <button
                                        className="rounded-md bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600"
                                        onClick={() => onEdit(student)}
                                    >
                                        Sửa
                                    </button>

                                    <button
                                        className="rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                                        onClick={() => onDelete(student.id)}
                                    >
                                        Xóa
                                    </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default StudentTable;