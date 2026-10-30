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

function setup(nextResponses) {
    calls.length = 0;
    responses = [...nextResponses];
}

test('own student lookup requires the authenticated user verified account link', async () => {
    setup([{ rows: [{ id: 9, student_code: 'SV009' }] }]);
    const student = await repository.getVerifiedStudentByUserId(42);
    assert.equal(student.student_code, 'SV009');
    assert.match(calls[0].sql, /JOIN student_account_links sal ON sal.student_id = s\.id/);
    assert.match(calls[0].sql, /sal\.user_id = \$1/);
    assert.match(calls[0].sql, /sal\.verified_at IS NOT NULL/);
    assert.deepEqual(calls[0].values, [42]);
    assert.doesNotMatch(calls[0].sql, /email\s*=\s*email/i);
});

test('missing verified link returns not_linked and never queries enrollment data', async () => {
    setup([{ rows: [] }]);
    const result = await repository.getStudentPortalByUserId(42);
    assert.deepEqual(result, { status: 'not_linked', student: null, grades: [], gradeCount: 0 });
    assert.equal(calls.length, 1);
});

test('grade lookup parameterizes optional semester filter', async () => {
    setup([{ rows: [{ enrollment_id: 1, total_score: '8.5' }] }]);
    const rows = await repository.getGradesByStudentId(9, 3);
    assert.equal(rows.length, 1);
    assert.match(calls[0].sql, /WHERE e\.student_id = \$1 AND sem\.id = \$2/);
    assert.deepEqual(calls[0].values, [9, 3]);
});

test('empty enrollment result is represented as no_enrollments rather than invented grades', async () => {
    setup([
        { rows: [{ id: 9, student_code: 'SV009' }] },
        { rows: [] }
    ]);
    const result = await repository.getStudentPortalByUserId(42);
    assert.equal(result.status, 'no_enrollments');
    assert.equal(result.gradeCount, 0);
    assert.deepEqual(result.grades, []);
    assert.equal(calls.length, 2);
});
