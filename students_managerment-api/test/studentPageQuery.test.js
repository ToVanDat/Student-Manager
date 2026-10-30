const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentPageFilters } = require('../repository/studentPageQuery.js');
const { buildStudentsCsv, toCsvCell } = require('../service/studentCsv.js');

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


test('student CSV has UTF-8 BOM, stable headers and quoted data cells', () => {
    const csv = buildStudentsCsv([{
        student_code: 'SV001',
        name: 'Nguyễn, An',
        email: 'an@example.test',
        date_of_birth: '2004-02-03',
        gender: 'Nam',
        class_code: 'CTK44',
        class_name: 'Công nghệ thông tin'
    }]);

    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /"student_code","name","email"/);
    assert.match(csv, /"Nguyễn, An"/);
    assert.match(csv, /"Công nghệ thông tin"\r\n$/);
});

test('student CSV escapes embedded quotes and preserves cell newlines', () => {
    assert.equal(toCsvCell('An "A", B\nC'), '"An ""A"", B\nC"');
});

test('student CSV neutralizes spreadsheet formula prefixes and leading whitespace', () => {
    for (const value of ['=1+1', '+SUM(A1:A2)', '-1+2', '@cmd', '  =1+1', '\t@SUM(A1)']) {
        assert.equal(toCsvCell(value).startsWith('"\'') , true);
    }
});

test('student CSV maps nullish values to empty cells and Date values to ISO days', () => {
    assert.equal(toCsvCell(null), '""');
    assert.equal(toCsvCell(undefined), '""');
    assert.equal(toCsvCell(new Date('2026-10-28T12:30:00.000Z')), '"2026-10-28"');
});
