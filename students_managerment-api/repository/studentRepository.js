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
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};