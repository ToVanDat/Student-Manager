const test = require('node:test');
const assert = require('node:assert/strict');

const databaseModulePath = require.resolve('../src/config/database');
const repositoryModulePath = require.resolve('../repository/academicRepository');

const calls = [];
let responses = [];
const fakePool = {
    query: async (sql, values = []) => {
        calls.push({ sql: String(sql), values });
        if (!responses.length) throw new Error('Unexpected database query in test');
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
    }
};

require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: fakePool
};
delete require.cache[repositoryModulePath];
const repository = require('../repository/academicRepository');

const setup = (...nextResponses) => {
    calls.length = 0;
    responses = [...nextResponses];
};

test('admin student-code lookup normalizes the code and parameterizes the query', async () => {
    setup(
        { rows: [{ id: 9, student_code: 'SV009' }] },
        { rows: [] }
    );

    const result = await repository.getStudentPortalByCode(' sv009 ');

    assert.equal(result.status, 'no_enrollments');
    assert.equal(result.student.student_code, 'SV009');
    assert.deepEqual(result.grades, []);
    assert.equal(calls.length, 2);
    assert.match(calls[0].sql, /LOWER\(BTRIM\(s\.student_code\)\) = LOWER\(BTRIM\(\$1\)\)/);
    assert.deepEqual(calls[0].values, [' sv009 ']);
    assert.deepEqual(calls[1].values, [9]);
});

test('unknown student code returns not_found without querying enrollment records', async () => {
    setup({ rows: [] });

    const result = await repository.getStudentPortalByCode('UNKNOWN');

    assert.deepEqual(result, {
        status: 'not_found',
        student: null,
        grades: [],
        gradeCount: 0
    });
    assert.equal(calls.length, 1);
});

test('duplicate normalized student codes fail closed instead of returning an arbitrary student', async () => {
    setup({
        rows: [
            { id: 9, student_code: 'SV009' },
            { id: 10, student_code: ' sv009 ' }
        ]
    });

    await assert.rejects(
        repository.getStudentPortalByCode('SV009'),
        error => error.code === 'ACADEMIC_STUDENT_CODE_NOT_UNIQUE'
    );
    assert.equal(calls.length, 1);
});

test('semester-scoped student-code lookup passes the semester ID as a separate SQL parameter', async () => {
    setup(
        { rows: [{ id: 9, student_code: 'SV009' }] },
        { rows: [{ enrollment_id: 31, semester_id: 4, total_score: '8.0' }] }
    );

    const result = await repository.getStudentPortalByCode('SV009', 4);

    assert.equal(result.status, 'available');
    assert.deepEqual(calls[1].values, [9, 4]);
    assert.match(calls[1].sql, /WHERE e\.student_id = \$1 AND sem\.id = \$2/);
});

test('grade lookup without semester filter binds only the student ID', async () => {
    setup({ rows: [] });

    await repository.getGradesByStudentId(9);

    assert.deepEqual(calls[0].values, [9]);
    assert.match(calls[0].sql, /WHERE e\.student_id = \$1\s+ORDER BY/);
    assert.doesNotMatch(calls[0].sql, /sem\.id = \$2/);
});
