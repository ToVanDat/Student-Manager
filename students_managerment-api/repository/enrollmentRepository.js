const pool = require('../src/config/database.js');


// Lấy tất cả đăng ký môn học
const getAllEnrollments = async () => {

    const result = await pool.query(`
        SELECT
            e.id,
            e.student_id,
            s.student_code,
            s.name AS student_name,

            e.subject_id,
            sub.subject_code,
            sub.subject_name,

            e.semester_id,
            sem.semester_name,
            sem.academic_year,

            e.midterm_score,
            e.final_score,
            e.total_score

        FROM enrollments e

        JOIN students s
            ON e.student_id = s.id

        JOIN subjects sub
            ON e.subject_id = sub.id

        JOIN semesters sem
            ON e.semester_id = sem.id

        ORDER BY e.id
    `);

    return result.rows;
};


// Lấy đăng ký môn học theo ID
const getEnrollmentById = async (id) => {

    const result = await pool.query(`
        SELECT
            e.id,
            e.student_id,
            s.student_code,
            s.name AS student_name,

            e.subject_id,
            sub.subject_code,
            sub.subject_name,

            e.semester_id,
            sem.semester_name,
            sem.academic_year,

            e.midterm_score,
            e.final_score,
            e.total_score

        FROM enrollments e

        JOIN students s
            ON e.student_id = s.id

        JOIN subjects sub
            ON e.subject_id = sub.id

        JOIN semesters sem
            ON e.semester_id = sem.id

        WHERE e.id = $1
    `, [id]);

    return result.rows[0];
};


// Thêm đăng ký môn học
const createEnrollment = async (data) => {

    const {
        student_id,
        subject_id,
        semester_id,
        midterm_score,
        final_score,
        total_score
    } = data;

    const result = await pool.query(`
        INSERT INTO enrollments
        (
            student_id,
            subject_id,
            semester_id,
            midterm_score,
            final_score,
            total_score
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [
        student_id,
        subject_id,
        semester_id,
        midterm_score,
        final_score,
        total_score
    ]);

    return result.rows[0];
};


// Cập nhật đăng ký môn học
const updateEnrollment = async (id, data) => {

    const {
        student_id,
        subject_id,
        semester_id,
        midterm_score,
        final_score,
        total_score
    } = data;

    const result = await pool.query(`
        UPDATE enrollments
        SET
            student_id = $1,
            subject_id = $2,
            semester_id = $3,
            midterm_score = $4,
            final_score = $5,
            total_score = $6
        WHERE id = $7
        RETURNING *
    `, [
        student_id,
        subject_id,
        semester_id,
        midterm_score,
        final_score,
        total_score,
        id
    ]);

    return result.rows[0];
};


// Xóa đăng ký môn học
const deleteEnrollment = async (id) => {

    const result = await pool.query(`
        DELETE FROM enrollments
        WHERE id = $1
        RETURNING *
    `, [id]);

    return result.rows[0];
};


module.exports = {
    getAllEnrollments,
    getEnrollmentById,
    createEnrollment,
    updateEnrollment,
    deleteEnrollment
};