// Build parameterized WHERE clauses for the paginated student roster.
// Keep all user-provided values in the values array; only fixed SQL fragments are interpolated.
const buildStudentPageFilters = ({ keyword = '', classId = null, gender = '' } = {}) => {
    const values = [];
    const conditions = [];

    if (keyword) {
        values.push(`%${keyword}%`);
        const placeholder = '$' + values.length;
        conditions.push(`(
            s.student_code ILIKE ${placeholder}
            OR s.name ILIKE ${placeholder}
            OR s.email ILIKE ${placeholder}
            OR c.class_code ILIKE ${placeholder}
            OR c.class_name ILIKE ${placeholder}
        )`);
    }

    if (classId !== null && classId !== '') {
        values.push(classId);
        conditions.push(`s.class_id = $${values.length}`);
    }

    if (gender) {
        values.push(gender);
        conditions.push(`LOWER(BTRIM(COALESCE(s.gender, ''))) = LOWER($${values.length})`);
    }

    return {
        whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
        values
    };
};

module.exports = { buildStudentPageFilters };
