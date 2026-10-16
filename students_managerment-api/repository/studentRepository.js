const pool = require('../src/config/database');

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
        JOIN classes c
            ON s.class_id = c.id
        ORDER BY s.id
    `);

    return result.rows;
};


const getStudentPage = async ({ page = 1, pageSize = 10, search = '', sortBy = 'id', sortOrder = 'asc' } = {}) => {
    const safePage = Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safePageSize = [10, 25, 50].includes(Number(pageSize)) ? Number(pageSize) : 10;
    const keyword = String(search || '').trim();
    const offset = (safePage - 1) * safePageSize;

    // SQL identifiers can only come from this allowlist; user input never enters SQL syntax.
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
    const whereSql = keyword
        ? `WHERE (
            s.student_code ILIKE $1
            OR s.name ILIKE $1
            OR s.email ILIKE $1
            OR c.class_code ILIKE $1
            OR c.class_name ILIKE $1
        )`
        : '';
    const searchValue = `%${keyword}%`;
    const countValues = keyword ? [searchValue] : [];
    const listValues = keyword
        ? [searchValue, safePageSize, offset]
        : [safePageSize, offset];
    const limitPosition = keyword ? '$2' : '$1';
    const offsetPosition = keyword ? '$3' : '$2';

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
             LIMIT ${limitPosition} OFFSET ${offsetPosition}`,
            listValues
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM students s
             JOIN classes c ON c.id = s.class_id
             ${whereSql}`,
            countValues
        ),
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
        // IDs are monotonically assigned in the current schema; avoid assuming a created_at column
        // that is not consistently included in the tracked SQL migrations.
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
        JOIN classes c
            ON s.class_id = c.id
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
        INSERT INTO students
        (
            student_code,
            name,
            email,
            date_of_birth,
            gender,
            class_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    ]);

    return result.rows[0];
};


const updateStudent = async (id, data) => {
    const {
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id
    } = data;

    const result = await pool.query(`
        UPDATE students
        SET
            student_code = $1,
            name = $2,
            email = $3,
            date_of_birth = $4,
            gender = $5,
            class_id = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
    `, [
        student_code,
        name,
        email,
        date_of_birth,
        gender,
        class_id,
        id
    ]);

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