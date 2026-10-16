const pool = require('../src/config/database.js');

// Keep this repository aligned with semestersService/controller. The enrollment
// repository already consumes semester_name and academic_year from this table.
const getAllSemesters = async () => {
    const result = await pool.query(
        `SELECT id, semester_name, academic_year
         FROM semesters
         ORDER BY id`
    );
    return result.rows;
};

const getSemesterById = async (id) => {
    const result = await pool.query(
        `SELECT id, semester_name, academic_year
         FROM semesters
         WHERE id = $1`,
        [id]
    );
    return result.rows[0];
};

const createSemester = async (data) => {
    const { semester_name, academic_year } = data;
    const result = await pool.query(
        `INSERT INTO semesters (semester_name, academic_year)
         VALUES ($1, $2)
         RETURNING *`,
        [semester_name, academic_year]
    );
    return result.rows[0];
};

const updateSemester = async (id, data) => {
    const { semester_name, academic_year } = data;
    const result = await pool.query(
        `UPDATE semesters
         SET semester_name = $1,
             academic_year = $2
         WHERE id = $3
         RETURNING *`,
        [semester_name, academic_year, id]
    );
    return result.rows[0];
};

const deleteSemester = async (id) => {
    const result = await pool.query(
        `DELETE FROM semesters
         WHERE id = $1
         RETURNING *`,
        [id]
    );
    return result.rows[0];
};

module.exports = {
    getAllSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
};
