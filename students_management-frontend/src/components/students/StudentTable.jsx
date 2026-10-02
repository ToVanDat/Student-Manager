// bang danh sach sinh vien
function StudentTable({ students, onEdit, onDelete }) {
    return (
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Mã SV</th>
                        <th>Họ tên</th>
                        <th>Email</th>
                        <th>Ngày sinh</th>
                        <th>Giới tính</th>
                        <th>Lớp</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    {students.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="empty">
                                Chưa có sinh viên
                            </td>
                        </tr>
                    ) : (
                        students.map((student) => (
                            <tr key={student.id}>
                                <td>{student.id}</td>

                                <td>{student.student_code}</td>

                                <td>{student.name}</td>

                                <td>{student.email}</td>

                                <td>
                                    {student.date_of_birth
                                        ? student.date_of_birth
                                        : '-'}
                                </td>

                                <td>
                                    {student.gender
                                        ? student.gender
                                        : '-'}
                                </td>

                                <td>
                                    {student.class_code
                                        ? `${student.class_code} - ${student.class_name}`
                                        : student.class_id}
                                </td>

                                <td className="actions">
                                    <button
                                        className="btn-edit"
                                        onClick={() => onEdit(student)}
                                    >
                                        Sửa
                                    </button>

                                    <button
                                        className="btn-delete"
                                        onClick={() => onDelete(student.id)}
                                    >
                                        Xóa
                                    </button>
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