const test = require('node:test');
const assert = require('node:assert/strict');
const academicService = require('../service/academicService.js');

test('parseOptionalSemesterId accepts an omitted semester filter', () => {
    assert.deepEqual(academicService.parseOptionalSemesterId(undefined), { valid: true, value: null });
    assert.deepEqual(academicService.parseOptionalSemesterId(''), { valid: true, value: null });
});

test('parseOptionalSemesterId accepts positive safe integer IDs', () => {
    assert.deepEqual(academicService.parseOptionalSemesterId('12'), { valid: true, value: 12 });
    assert.deepEqual(academicService.parseOptionalSemesterId(1), { valid: true, value: 1 });
});

test('parseOptionalSemesterId rejects invalid, zero, negative and unsafe values', () => {
    for (const value of ['abc', '1.5', '0', '-1', '9007199254740992', {}, []]) {
        assert.equal(academicService.parseOptionalSemesterId(value).valid, false, String(value));
    }
});

test('getStudentByCode trims input before repository lookup', async () => {
    const repository = require('../repository/academicRepository.js');
    const original = repository.getStudentPortalByCode;
    let received;
    repository.getStudentPortalByCode = async (code, semesterId) => {
        received = { code, semesterId };
        return { status: 'not_found', student: null, grades: [], gradeCount: 0 };
    };

    try {
        const result = await academicService.getStudentByCode('  SV-001  ', 4);
        assert.equal(result.status, 'not_found');
        assert.deepEqual(received, { code: 'SV-001', semesterId: 4 });
    } finally {
        repository.getStudentPortalByCode = original;
    }
});

test('getStudentByCode rejects blank and oversized student codes before database access', async () => {
    const repository = require('../repository/academicRepository.js');
    const original = repository.getStudentPortalByCode;
    let called = false;
    repository.getStudentPortalByCode = async () => {
        called = true;
        return { status: 'not_found', student: null, grades: [], gradeCount: 0 };
    };

    try {
        await assert.rejects(
            academicService.getStudentByCode('   '),
            error => error.status === 400 && /Mã sinh viên/.test(error.message)
        );
        await assert.rejects(
            academicService.getStudentByCode('S'.repeat(101)),
            error => error.status === 400 && /Mã sinh viên/.test(error.message)
        );
        await assert.rejects(
            academicService.getStudentByCode(null),
            error => error.status === 400 && /Mã sinh viên/.test(error.message)
        );
        assert.equal(called, false);
    } finally {
        repository.getStudentPortalByCode = original;
    }
});

test('getMyGrades delegates the authenticated user ID and semester filter unchanged', async () => {
    const repository = require('../repository/academicRepository.js');
    const original = repository.getStudentPortalByUserId;
    let received;
    const expected = { status: 'not_linked', student: null, grades: [], gradeCount: 0 };
    repository.getStudentPortalByUserId = async (...args) => {
        received = args;
        return expected;
    };

    try {
        const result = await academicService.getMyGrades(42, 7);
        assert.equal(result, expected);
        assert.deepEqual(received, [42, 7]);
    } finally {
        repository.getStudentPortalByUserId = original;
    }
});
