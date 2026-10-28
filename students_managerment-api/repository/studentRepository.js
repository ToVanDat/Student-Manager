const pool = require('../src/config/database');
const { buildStudentPageFilters } = require('./studentPageQuery');

const getAllStudents = async () => {
    const result = await pool.query(`
        SELECT
            s.id,
            s.student_code,
            s.name,
            s.email,
            s.date_of_birth,
            s.gender,
            s.class_id,
            c.class_code,
            c.class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        ORDER BY s.id
    `);

    return result.rows;
};

const getStudentPage = async ({
    page = 1,
    pageSize = 10,
    search = '',
    sortBy = 'id',
    sortOrder = 'asc',
    classId = null,
    gender = ''
} = {}) => {
    const requestedPage = Number(page);
    const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedPageSize = Number(pageSize);
    const safePageSize = [10, 25, 50].includes(requestedPageSize) ? requestedPageSize : 10;
    const keyword = String(search || '').trim();
    const requestedClassId = Number(classId);
    const safeClassId = classId !== null && classId !== '' &&
        Number.isSafeInteger(requestedClassId) && requestedClassId > 0
        ? requestedClassId
        : null;
    const safeGender = ['Nam', 'Nữ'].includes(gender) ? gender : '';
    const offset = (safePage - 1) * safePageSize;

    // SQL identifiers must come from this allowlist; user input never enters SQL syntax.
    const sortColumns = {
        id: 's.id',
        student_code: 's.student_code',
        name: 's.name',
        email: 's.email',
        date_of_birth: 's.date_of_birth',
        gender: 's.gender',
        class_code: 'c.class_code',
        class_name: 'c.class_name'
    };
    const orderColumn = sortColumns[sortBy] || sortColumns.id;
    const orderDirection = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const { whereSql, values: filterValues } = buildStudentPageFilters({
        keyword,
        classId: safeClassId,
        gender: safeGender
    });
    const countValues = [...filterValues];
    const limitPosition = filterValues.length + 1;
    const offsetPosition = filterValues.length + 2;
    const listValues = [...filterValues, safePageSize, offset];

    const [listResult, countResult, statsResult, classesResult, recentResult] = await Promise.all([
        pool.query(
            `SELECT
                s.id,
                s.student_code,
                s.name,
                s.email,
                s.date_of_birth,
                s.gender,
                s.class_id,
                c.class_code,
                c.class_name
             FROM students s
             JOIN classes c ON c.id = s.class_id
             ${whereSql}
             ORDER BY ${orderColumn} ${orderDirection} NULLS LAST, s.id ASC
             LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
            listValues
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM students s
             JOIN classes c ON c.id = s.class_id
             ${whereSql}`,
            countValues
        ),
        // Dashboard statistics are intentionally global, not narrowed by roster filters.
        pool.query(
            `SELECT
                COUNT(*)::int AS total_students,
                COUNT(DISTINCT class_id)::int AS total_classes,
                COUNT(*) FILTER (WHERE LOWER(BTRIM(COALESCE(gender, ''))) IN ('nam', 'male'))::int AS male,
                COUNT(*) FILTER (WHERE LOWER(BTRIM(COALESCE(gender, ''))) IN ('nữ', 'nu', 'female'))::int AS female
             FROM students`
        ),
        pool.query(
            `SELECT c.class_code AS code, c.class_name AS name, COUNT(s.id)::int AS count
             FROM classes c
             LEFT JOIN students s ON s.class_id = c.id
             GROUP BY c.id, c.class_code, c.class_name
             HAVING COUNT(s.id) > 0
             ORDER BY COUNT(s.id) DESC, c.class_code ASC`
        ),
        // Avoid assuming a created_at column that is not consistently present in tracked migrations.
        pool.query(
            `SELECT
                s.id, s.student_code, s.name, s.email, s.class_id,
                c.class_code, c.class_name
             FROM students s
             JOIN classes c ON c.id = s.class_id
             ORDER BY s.id DESC
             LIMIT 5`
        )
    ]);

    const totalCount = Number(countResult.rows[0]?.total) || 0;
    return {
        data: listResult.rows,
        pagination: {
            page: safePage,
            pageSize: safePageSize,
            totalCount,
            pageCount: Math.max(1, Math.ceil(totalCount / safePageSize))
        },
        statistics: {
            totalStudents: Number(statsResult.rows[0]?.total_students) || 0,
            totalClasses: Number(statsResult.rows[0]?.total_classes) || 0,
            male: Number(statsResult.rows[0]?.male) || 0,
            female: Number(statsResult.rows[0]?.female) || 0
        },
        classStatistics: classesResult.rows,
        recentStudents: recentResult.rows
    };
};

const STUDENT_EXPORT_MAX_ROWS = 20000;

const getStudentExportRows = async ({ search = '', classId = null, gender = '' } = {}) => {
    const { whereSql, values } = buildStudentPageFilters({
        keyword: String(search || '').trim(),
        classId,
        gender
    });
    const limitPosition = values.length + 1;
    const result = await pool.query(
        `SELECT
            s.id,
            s.student_code,
            s.name,
            s.email,
            s.date_of_birth,
            s.gender,
            s.class_id,
            c.class_code,
            c.class_name,
            COUNT(*) OVER()::int AS total_count
         FROM students s
         JOIN classes c ON c.id = s.class_id
         ${whereSql}
         ORDER BY s.id ASC
         LIMIT $${limitPosition}`,
        [...values, STUDENT_EXPORT_MAX_ROWS + 1]
    );

    const totalCount = Number(result.rows[0]?.total_count) || 0;
    if (totalCount > STUDENT_EXPORT_MAX_ROWS) {
        return { kind: 'too_many', totalCount, maxRows: STUDENT_EXPORT_MAX_ROWS };
    }

    const rows = result.rows.map(({ total_count, ...student }) => student);
    return { kind: 'ok', rows, totalCount };
};


const getStudentImportReferenceData = async ({ studentCodes = [], emails = [], classCodes = [] } = {}) => {
    const normalizedCodes = [...new Set(studentCodes.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
    const normalizedEmails = [...new Set(emails.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
    const normalizedClasses = [...new Set(classCodes.map(value => String(value).trim().toLowerCase()).filter(Boolean))];

    const [classesResult, codesResult, emailsResult] = await Promise.all([
        pool.query(
            `SELECT id, class_code
             FROM classes
             WHERE LOWER(BTRIM(class_code)) = ANY($1::text[])`,
            [normalizedClasses]
        ),
        pool.query(
            `SELECT LOWER(BTRIM(student_code)) AS value
             FROM students
             WHERE LOWER(BTRIM(student_code)) = ANY($1::text[])`,
            [normalizedCodes]
        ),
        pool.query(
            `SELECT LOWER(BTRIM(email)) AS value
             FROM students
             WHERE LOWER(BTRIM(email)) = ANY($1::text[])`,
            [normalizedEmails]
        )
    ]);

    return {
        classes: classesResult.rows,
        existingStudentCodes: codesResult.rows.map(row => row.value),
        existingEmails: emailsResult.rows.map(row => row.value)
    };
};

const createStudentsFromImport = async (rows = []) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        const classCodes = [...new Set(rows.map(row => row.class_code.toLowerCase()))];
        const classResult = await client.query(
            `SELECT id, class_code
             FROM classes
             WHERE LOWER(BTRIM(class_code)) = ANY($1::text[])
             FOR SHARE`,
            [classCodes]
        );
        const classIds = new Map(classResult.rows.map(row => [row.class_code.trim().toLowerCase(), row.id]));
        const missingClasses = classCodes.filter(code => !classIds.has(code));
        if (missingClasses.length) {
            const error = new Error('Một hoặc nhiều mã lớp không còn tồn tại. Hãy xem trước tệp lại.');
            error.code = 'STUDENT_IMPORT_CONFLICT';
            throw error;
        }

        const studentCodes = rows.map(row => row.student_code.trim().toLowerCase());
        const emails = rows.map(row => row.email.trim().toLowerCase());
        const [codesResult, emailsResult] = await Promise.all([
            client.query(
                `SELECT LOWER(BTRIM(student_code)) AS value
                 FROM students
                 WHERE LOWER(BTRIM(student_code)) = ANY($1::text[])
                 FOR SHARE`,
                [studentCodes]
            ),
            client.query(
                `SELECT LOWER(BTRIM(email)) AS value
                 FROM students
                 WHERE LOWER(BTRIM(email)) = ANY($1::text[])
                 FOR SHARE`,
                [emails]
            )
        ]);
        if (codesResult.rowCount || emailsResult.rowCount) {
            const error = new Error('Mã sinh viên hoặc email đã được sử dụng. Không có bản ghi nào được nhập.');
            error.code = 'STUDENT_IMPORT_CONFLICT';
            throw error;
        }

        for (const row of rows) {
            await client.query(
                `INSERT INTO students (
                    student_code, name, email, date_of_birth, gender, class_id
                 ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    row.student_code,
                    row.name,
                    row.email,
                    row.date_of_birth,
                    row.gender,
                    classIds.get(row.class_code.toLowerCase())
                ]
            );
        }

        await client.query('COMMIT');
        return { importedCount: rows.length };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error?.code === '40001' || error?.code === '23505' || error?.code === '23503') {
            const conflict = new Error('Dữ liệu đã thay đổi hoặc bị trùng trong lúc nhập. Không có bản ghi nào được nhập; hãy xem trước và thử lại.');
            conflict.code = 'STUDENT_IMPORT_CONFLICT';
            throw conflict;
        }
        throw error;
    } finally {
        client.release();
    }
};

const getStudentById = async (id) => {
    const result = await pool.query(`
        SELECT
            s.id,
            s.student_code,
            s.name,
            s.email,
            s.date_of_birth,
            s.gender,
            s.class_id,
            c.class_code,
            c.class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = $1
    `, [id]);

    return result.rows[0];
};

const createStudent = async (data) => {
    const {
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    } = data;

    const result = await pool.query(`
        INSERT INTO students (
            student_code,
            name,
            email,
            date_of_birth,
            gender,
            class_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [student_code, name, email, date_of_birth, gender, class_id]);

    return result.rows[0];
};

const updateStudent = async (id, data) => {
    // Update only explicitly supplied fields. Do not assume an updated_at column exists.
    const allowedColumns = new Set([
        'student_code',
        'name',
        'email',
        'date_of_birth',
        'gender',
        'class_id'
    ]);
    const entries = Object.entries(data || {}).filter(([key]) => allowedColumns.has(key));

    if (entries.length === 0) return null;

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    values.push(id);

    const result = await pool.query(
        `UPDATE students
         SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING *`,
        values
    );

    return result.rows[0];
};

const deleteStudent = async (id) => {
    const result = await pool.query(`
        DELETE FROM students
        WHERE id = $1
        RETURNING *
    `, [id]);

    return result.rows[0];
};

const getStudentPortalByUserId = async (userId) => {
    // Only a verified, backend-created mapping may expose a student's private academic record.
    // Never infer ownership from matching email addresses or browser-supplied student IDs.
    const studentResult = await pool.query(`
        SELECT s.id, s.student_code, s.name, s.email, s.date_of_birth, s.gender,
               s.class_id, c.class_code, c.class_name, d.department_code, d.department_name
        FROM student_account_links sal
        JOIN students s ON s.id = sal.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN departments d ON d.id = c.department_id
        WHERE sal.user_id = $1 AND sal.verified_at IS NOT NULL
        LIMIT 1
    `, [userId]);
    const student = studentResult.rows[0] || null;
    if (!student) return { linked: false, student: null, enrollments: [] };

    const enrollmentResult = await pool.query(`
        SELECT e.id, e.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               e.semester_id, sem.semester_name, sem.academic_year,
               e.midterm_score, e.final_score, e.total_score
        FROM enrollments e
        JOIN subjects sub ON sub.id = e.subject_id
        JOIN semesters sem ON sem.id = e.semester_id
        WHERE e.student_id = $1
        ORDER BY sem.id DESC, sub.subject_code ASC, e.id ASC
    `, [student.id]);
    return { linked: true, student, enrollments: enrollmentResult.rows };
};


const listStudentAccountLinkAdminData = async (search = '') => {
    const term = String(search || '').trim();
    const pattern = `%${term}%`;
    const [linkedResult, usersResult, studentsResult, auditResult] = await Promise.all([
        pool.query(`
            SELECT sal.user_id, sal.student_id, sal.verified_at, sal.verification_method,
                   sal.verification_note, sal.verified_by,
                   u.username, u.full_name, u.email,
                   st.student_code, st.name AS student_name, st.email AS student_email,
                   st.class_id, c.class_code, c.class_name,
                   verifier.username AS verified_by_username
            FROM student_account_links sal
            JOIN users u ON u.id = sal.user_id
            JOIN students st ON st.id = sal.student_id
            LEFT JOIN classes c ON c.id = st.class_id
            LEFT JOIN users verifier ON verifier.id = sal.verified_by
            WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2
                   OR u.full_name ILIKE $2 OR st.student_code ILIKE $2
                   OR st.name ILIKE $2 OR st.email ILIKE $2)
            ORDER BY sal.verified_at DESC, sal.user_id DESC
            LIMIT 100
        `, [term, pattern]),
        pool.query(`
            SELECT u.id, u.username, u.full_name, u.email
            FROM users u
            WHERE u.role = 'user' AND u.is_active = TRUE
              AND NOT EXISTS (SELECT 1 FROM student_account_links sal WHERE sal.user_id = u.id)
              AND ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2 OR u.full_name ILIKE $2)
            ORDER BY u.username ASC
            LIMIT 50
        `, [term, pattern]),
        pool.query(`
            SELECT st.id, st.student_code, st.name, st.email, st.class_id,
                   c.class_code, c.class_name
            FROM students st
            LEFT JOIN classes c ON c.id = st.class_id
            WHERE NOT EXISTS (SELECT 1 FROM student_account_links sal WHERE sal.student_id = st.id)
              AND ($1 = '' OR st.student_code ILIKE $2 OR st.name ILIKE $2 OR st.email ILIKE $2)
            ORDER BY st.student_code ASC
            LIMIT 50
        `, [term, pattern]),
        pool.query(`
            SELECT a.id, a.action, a.user_id, a.student_id, a.verification_method,
                   a.note, a.occurred_at, actor.username AS actor_username,
                   u.username, st.student_code, st.name AS student_name
            FROM student_account_link_audit a
            LEFT JOIN users actor ON actor.id::text = a.actor_user_id
            LEFT JOIN users u ON u.id::text = a.user_id
            LEFT JOIN students st ON st.id::text = a.student_id
            ORDER BY a.occurred_at DESC, a.id DESC
            LIMIT 20
        `)
    ]);

    return {
        linked: linkedResult.rows,
        availableUsers: usersResult.rows,
        availableStudents: studentsResult.rows,
        audit: auditResult.rows
    };
};

const createVerifiedStudentAccountLink = async ({ userId, studentId, actorId, note }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query(
            'SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (!userResult.rowCount || userResult.rows[0].role !== 'user' || !userResult.rows[0].is_active) {
            await client.query('ROLLBACK');
            return { kind: 'user_unavailable' };
        }

        const studentResult = await client.query(
            'SELECT id FROM students WHERE id = $1 FOR UPDATE',
            [studentId]
        );
        if (!studentResult.rowCount) {
            await client.query('ROLLBACK');
            return { kind: 'student_not_found' };
        }

        const existing = await client.query(
            'SELECT user_id, student_id FROM student_account_links WHERE user_id = $1 OR student_id = $2 FOR UPDATE',
            [userId, studentId]
        );
        if (existing.rowCount) {
            await client.query('ROLLBACK');
            return { kind: 'already_linked' };
        }

        const inserted = await client.query(`
            INSERT INTO student_account_links
                (user_id, student_id, verified_at, verified_by, verification_method, verification_note)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 'admin_manual_review', $4)
            RETURNING user_id, student_id, verified_at, verified_by, verification_method, verification_note
        `, [userId, studentId, actorId, note || null]);

        await client.query(`
            INSERT INTO student_account_link_audit
                (action, user_id, student_id, actor_user_id, verification_method, note)
            VALUES ('linked', $1::text, $2::text, $3::text, 'admin_manual_review', $4)
        `, [userId, studentId, actorId, note || null]);
        await client.query('COMMIT');
        return { kind: 'ok', link: inserted.rows[0] };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const removeStudentAccountLink = async ({ userId, actorId, reason }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const deleted = await client.query(
            'DELETE FROM student_account_links WHERE user_id = $1 RETURNING user_id, student_id',
            [userId]
        );
        if (!deleted.rowCount) {
            await client.query('ROLLBACK');
            return { kind: 'not_found' };
        }
        const link = deleted.rows[0];
        await client.query(`
            INSERT INTO student_account_link_audit
                (action, user_id, student_id, actor_user_id, verification_method, note)
            VALUES ('unlinked', $1::text, $2::text, $3::text, 'admin_manual_review', $4)
        `, [link.user_id, link.student_id, actorId, reason]);
        await client.query('COMMIT');
        return { kind: 'ok', userId: link.user_id, studentId: link.student_id };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getAllStudents,
    getStudentPage,
    getStudentExportRows,
    getStudentImportReferenceData,
    createStudentsFromImport,
    getStudentPortalByUserId,
    listStudentAccountLinkAdminData,
    createVerifiedStudentAccountLink,
    removeStudentAccountLink,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};
