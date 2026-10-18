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

module.exports = {
    getAllStudents,
    getStudentPage,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};
