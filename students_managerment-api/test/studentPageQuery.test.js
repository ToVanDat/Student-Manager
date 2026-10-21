const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentPageFilters } = require('../repository/studentPageQuery.js');

test('student search uses PostgreSQL positional placeholders and parameter values', () => {
    const result = buildStudentPageFilters({ keyword: 'SV001' });

    assert.match(result.whereSql, /s\.student_code ILIKE \$1/);
    assert.match(result.whereSql, /s\.name ILIKE \$1/);
    assert.match(result.whereSql, /c\.class_name ILIKE \$1/);
    assert.deepEqual(result.values, ['%SV001%']);
});

test('class and gender filters use sequential placeholders after search', () => {
    const result = buildStudentPageFilters({
        keyword: 'An',
        classId: 3,
        gender: 'Nữ'
    });

    assert.match(result.whereSql, /s\.student_code ILIKE \$1/);
    assert.match(result.whereSql, /s\.class_id = \$2/);
    assert.match(result.whereSql, /LOWER\(\$3\)/);
    assert.deepEqual(result.values, ['%An%', 3, 'Nữ']);
});

test('filters can be combined without search and preserve positional numbering', () => {
    const result = buildStudentPageFilters({ classId: 7, gender: 'Nam' });

    assert.equal(result.whereSql, "WHERE s.class_id = $1 AND LOWER(BTRIM(COALESCE(s.gender, ''))) = LOWER($2)");
    assert.deepEqual(result.values, [7, 'Nam']);
});

test('no filters returns an empty WHERE clause', () => {
    assert.deepEqual(buildStudentPageFilters(), { whereSql: '', values: [] });
});
