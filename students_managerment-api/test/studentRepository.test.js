const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const databaseModulePath = require.resolve('../src/config/database');
const repositoryModulePath = require.resolve('../repository/studentRepository');

const calls = [];
let responses = [];

const fakePool = {
    query: async (sql, values = []) => {
        calls.push({ sql: String(sql), values });
        if (responses.length === 0) throw new Error('Unexpected database query in test');
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
    }
};

// Inject a fake pool before loading the repository. No PostgreSQL connection or
// live database is used by this test file.
require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: fakePool
};
delete require.cache[repositoryModulePath];
const repository = require('../repository/studentRepository');

const pageResponses = ({
    rows = [],
    total = 0,
    stats = {},
    classStats = [],
    recent = []
} = {}) => [
    { rows },
    { rows: [{ total }] },
    { rows: [{
        total_students: stats.total_students ?? 0,
        total_classes: stats.total_classes ?? 0,
        male: stats.male ?? 0,
        female: stats.female ?? 0
    }] },
    { rows: classStats },
    { rows: recent }
];

const setup = (nextResponses) => {
    calls.length = 0;
    responses = [...nextResponses];
};

test('page query applies parameterized search, class and gender filters', async () => {
    setup(pageResponses({ total: 1 }));
    const result = await repository.getStudentPage({
        page: 2,
        pageSize: 25,
        search: '  SV001 ',
        classId: 7,
        gender: 'Nữ'
    });

    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.pageSize, 25);
    assert.equal(result.pagination.totalCount, 1);
    assert.equal(calls.length, 5);

    const listQuery = calls[0];
    assert.match(listQuery.sql, /s\.student_code ILIKE \$1/);
    assert.match(listQuery.sql, /s\.class_id = \$2/);
    assert.match(listQuery.sql, /LOWER\(BTRIM\(COALESCE\(s\.gender, ''\)\)\) = LOWER\(\$3\)/);
    assert.match(listQuery.sql, /LIMIT \$4 OFFSET \$5/);
    assert.deepEqual(listQuery.values, ['%SV001%', 7, 'Nữ', 25, 25]);
    assert.deepEqual(calls[1].values, ['%SV001%', 7, 'Nữ']);
});

test('untrusted sort identifiers fall back to id and order is normalized', async () => {
    setup(pageResponses());
    await repository.getStudentPage({ sortBy: 'name; DROP TABLE students', sortOrder: 'desc' });

    assert.match(calls[0].sql, /ORDER BY s\.id DESC NULLS LAST, s\.id ASC/);
    assert.doesNotMatch(calls[0].sql, /DROP TABLE/i);
});

test('invalid page values and page sizes fall back to safe defaults at repository boundary', async () => {
    setup(pageResponses());
    const result = await repository.getStudentPage({
        page: -5,
        pageSize: 999,
        classId: 'not-a-number',
        gender: 'unknown'
    });

    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.pageSize, 10);
    assert.deepEqual(calls[0].values, [10, 0]);
});

test('empty result and page beyond last page return stable pagination metadata', async () => {
    setup(pageResponses({ total: 0 }));
    const result = await repository.getStudentPage({ page: 12, pageSize: 10 });

    assert.deepEqual(result.data, []);
    assert.deepEqual(result.pagination, {
        page: 12,
        pageSize: 10,
        totalCount: 0,
        pageCount: 1
    });
    assert.deepEqual(calls[0].values, [10, 110]);
});

test('dashboard statistics remain global when roster filters are present', async () => {
    setup(pageResponses({ total: 1, stats: { total_students: 18, total_classes: 4, male: 9, female: 8 } }));
    const result = await repository.getStudentPage({ search: 'An', classId: 3 });

    assert.equal(result.statistics.totalStudents, 18);
    assert.equal(result.statistics.totalClasses, 4);
    assert.doesNotMatch(calls[2].sql, /WHERE/i);
    assert.deepEqual(calls[2].values, []);
});

test('getStudentById uses a parameterized id', async () => {
    setup([{ rows: [{ id: 4, student_code: 'SV004' }] }]);
    const student = await repository.getStudentById('4');

    assert.equal(student.id, 4);
    assert.match(calls[0].sql, /WHERE s\.id = \$1/);
    assert.deepEqual(calls[0].values, ['4']);
});

test('updateStudent only updates allowlisted fields and safely handles empty payload', async () => {
    setup([{ rows: [{ id: 4, name: 'Updated' }] }]);
    const updated = await repository.updateStudent(4, {
        name: 'Updated',
        'name = name; DROP TABLE students --': 'ignored'
    });

    assert.equal(updated.name, 'Updated');
    assert.match(calls[0].sql, /SET name = \$1/);
    assert.doesNotMatch(calls[0].sql, /DROP TABLE/i);
    assert.deepEqual(calls[0].values, ['Updated', 4]);

    setup([]);
    assert.equal(await repository.updateStudent(4, { unknown_field: 'x' }), null);
    assert.equal(calls.length, 0);
});

test('create and delete use parameterized SQL', async () => {
    setup([{ rows: [{ id: 1, student_code: 'SV001' }] }]);
    await repository.createStudent({
        student_code: 'SV001', name: 'Test', email: 'test@example.com',
        date_of_birth: null, gender: 'Nam', class_id: 2
    });
    assert.match(calls[0].sql, /INSERT INTO students/);
    assert.deepEqual(calls[0].values, ['SV001', 'Test', 'test@example.com', null, 'Nam', 2]);

    setup([{ rows: [{ id: 1 }] }]);
    await repository.deleteStudent(1);
    assert.match(calls[0].sql, /DELETE FROM students\s+WHERE id = \$1/);
    assert.deepEqual(calls[0].values, [1]);
});
