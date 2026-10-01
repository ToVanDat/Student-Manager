const pool = require('../src/config/database.js');


// Lấy tất cả lớp
const getAllClasses = async () => {
    const result = await pool.query(`
        SELECT
            c.id,
            c.class_code,
            c.class_name,
            c.department_id,
            d.department_code,
            d.department_name
        FROM classes c
        JOIN departments d
            ON c.department_id = d.id
        ORDER BY c.id
    `);

    return result.rows;
};


// Lấy lớp theo ID
const getClassById = async (id) => {
    const result = await pool.query(`
        SELECT
            c.id,
            c.class_code,
            c.class_name,
            c.department_id,
            d.department_code,
            d.department_name
        FROM classes c
        JOIN departments d
            ON c.department_id = d.id
        WHERE c.id = $1
    `, [id]);

    return result.rows[0];
};


// Thêm lớp
const createClass = async (data) => {

    const {
        class_code,
        class_name,
        department_id
    } = data;

    const result = await pool.query(`
        INSERT INTO classes
        (
            class_code,
            class_name,
            department_id
        )
        VALUES ($1, $2, $3)
        RETURNING *
    `, [
        class_code,
        class_name,
        department_id
    ]);

    return result.rows[0];
};


// Cập nhật lớp
const updateClass = async (id, data) => {

    const {
        class_code,
        class_name,
        department_id
    } = data;

    const result = await pool.query(`
        UPDATE classes
        SET
            class_code = $1,
            class_name = $2,
            department_id = $3
        WHERE id = $4
        RETURNING *
    `, [
        class_code,
        class_name,
        department_id,
        id
    ]);

    return result.rows[0];
};


// Xóa lớp
const deleteClass = async (id) => {

    const result = await pool.query(`
        DELETE FROM classes
        WHERE id = $1
        RETURNING *
    `, [id]);

    return result.rows[0];
};


module.exports = {
    getAllClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};