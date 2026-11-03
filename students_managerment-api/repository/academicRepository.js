const pool = require('../src/config/database.js');

const STUDENT_PROFILE_SELECT = `
    SELECT s.id, s.student_code, s.name, s.email, s.date_of_birth, s.gender,
           s.class_id, c.class_code, c.class_name, d.department_code, d.department_name
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN departments d ON d.id = c.department_id
`;

const GRADE_SELECT = `
    SELECT e.id AS enrollment_id, sub.id AS subject_id, sub.subject_code,
           sub.subject_name, sub.credits, sem.id AS semester_id,
           sem.semester_name, sem.academic_year,
           e.midterm_score, e.final_score, e.total_score
    FROM enrollments e
    JOIN subjects sub ON sub.id = e.subject_id
    JOIN semesters sem ON sem.id = e.semester_id
`;

async function getVerifiedStudentByUserId(userId) {
    const result = await pool.query(
        `${STUDENT_PROFILE_SELECT}
         JOIN student_account_links sal ON sal.student_id = s.id
         WHERE sal.user_id = $1 AND sal.verified_at IS NOT NULL
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

async function getGradesByStudentId(studentId, semesterId = null) {
    const values = [studentId];
    const semesterFilter = semesterId === null ? '' : (values.push(semesterId), ' AND sem.id = $2');
    const result = await pool.query(
        `${GRADE_SELECT}
         WHERE e.student_id = $1${semesterFilter}
         ORDER BY sem.id DESC, sub.subject_code ASC, e.id ASC`,
        values
    );
    return result.rows;
}

async function getStudentPortalByUserId(userId, semesterId = null) {
    const student = await getVerifiedStudentByUserId(userId);
    if (!student) return { status: 'not_linked', student: null, grades: [], gradeCount: 0 };
    const grades = await getGradesByStudentId(student.id, semesterId);
    return { status: grades.length ? 'available' : 'no_enrollments', student, grades, gradeCount: grades.length };
}

async function getStudentPortalByCode(studentCode, semesterId = null) {
    const result = await pool.query(
        `${STUDENT_PROFILE_SELECT}
         WHERE LOWER(BTRIM(s.student_code)) = LOWER(BTRIM($1))
         LIMIT 2`,
        [studentCode]
    );
    if (!result.rows.length) return { status: 'not_found', student: null, grades: [], gradeCount: 0 };
    if (result.rows.length > 1) {
        const error = new Error('Mã sinh viên không duy nhất; cần xử lý dữ liệu trước khi tra cứu.');
        error.code = 'ACADEMIC_STUDENT_CODE_NOT_UNIQUE';
        throw error;
    }
    const student = result.rows[0];
    const grades = await getGradesByStudentId(student.id, semesterId);
    return { status: grades.length ? 'available' : 'no_enrollments', student, grades, gradeCount: grades.length };
}

module.exports = { getVerifiedStudentByUserId, getGradesByStudentId, getStudentPortalByUserId, getStudentPortalByCode };
