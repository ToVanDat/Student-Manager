const pool = require('../src/config/database.js');


// Lấy tất cả khoa
const getAllDepartments = async () => {

    const result = await pool.query(`
        SELECT
            id,
            department_code,
            department_name
        FROM departments
        ORDER BY id
    `);

    return result.rows;
};


// Lấy khoa theo ID
const getDepartmentById = async (id) => {

    const result = await pool.query(`
        SELECT
            id,
            department_code,
            department_name
        FROM departments
        WHERE id = $1
    `, [id]);

    return result.rows[0];
};


// Thêm khoa
const createDepartment = async (data) => {

    const {
        department_code,
        department_name
    } = data;

    const result = await pool.query(`
        INSERT INTO departments
        (
            department_code,
            department_name
        )
        VALUES ($1, $2)
        RETURNING *
    `, [
        department_code,
        department_name
    ]);

    return result.rows[0];
};


// Cập nhật khoa
const updateDepartment = async (id, data) => {
    const allowedColumns = new Set([
        'department_code',
        'department_name'
    ]);
    const entries = Object.entries(data || {}).filter(([key]) => allowedColumns.has(key));

    if (entries.length === 0) return null;

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    values.push(id);

    const result = await pool.query(
        `UPDATE departments
         SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING *`,
        values
    );

    return result.rows[0];
};


// Xóa khoa
const deleteDepartment = async (id) => {

    const result = await pool.query(`
        DELETE FROM departments
        WHERE id = $1
        RETURNING *
    `, [id]);

    return result.rows[0];
};


module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};