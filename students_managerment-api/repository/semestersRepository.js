const pool = require('../src/config/database.js');


// Lấy tất cả môn học
const getAllSubjects = async () => {

    const result = await pool.query(`
        SELECT
            id,
            subject_code,
            subject_name,
            credits
        FROM subjects
        ORDER BY id
    `);

    return result.rows;
};


// Lấy môn học theo ID
const getSubjectById = async (id) => {

    const result = await pool.query(`
        SELECT
            id,
            subject_code,
            subject_name,
            credits
        FROM subjects
        WHERE id = $1
    `, [id]);

    return result.rows[0];
};


// Thêm môn học
const createSubject = async (data) => {

    const {
        subject_code,
        subject_name,
        credits
    } = data;

    const result = await pool.query(`
        INSERT INTO subjects
        (
            subject_code,
            subject_name,
            credits
        )
        VALUES ($1, $2, $3)
        RETURNING *
    `, [
        subject_code,
        subject_name,
        credits
    ]);

    return result.rows[0];
};


// Cập nhật môn học
const updateSubject = async (id, data) => {

    const {
        subject_code,
        subject_name,
        credits
    } = data;

    const result = await pool.query(`
        UPDATE subjects
        SET
            subject_code = $1,
            subject_name = $2,
            credits = $3
        WHERE id = $4
        RETURNING *
    `, [
        subject_code,
        subject_name,
        credits,
        id
    ]);

    return result.rows[0];
};


// Xóa môn học
const deleteSubject = async (id) => {

    const result = await pool.query(`
        DELETE FROM subjects
        WHERE id = $1
        RETURNING *
    `, [id]);

    return result.rows[0];
};


module.exports = {
    getAllSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
};