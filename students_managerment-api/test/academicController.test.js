const test = require('node:test');
const assert = require('node:assert/strict');
const academicController = require('../controller/academicController.js');
const academicService = require('../service/academicService.js');

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

test('getMyGrades rejects invalid semesterId before calling the service', async () => {
    const original = academicService.getMyGrades;
    let called = false;
    academicService.getMyGrades = async () => { called = true; return {}; };
    const res = createResponse();

    try {
        await academicController.getMyGrades(
            { user: { id: 17 }, query: { semesterId: '1.2' } },
            res,
            error => { throw error; }
        );
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { message: 'semesterId phải là số nguyên dương' });
        assert.equal(called, false);
    } finally {
        academicService.getMyGrades = original;
    }
});

test('getMyGrades scopes the request to the authenticated user', async () => {
    const original = academicService.getMyGrades;
    let received;
    const expected = { status: 'not_linked', grades: [], gradeCount: 0 };
    academicService.getMyGrades = async (...args) => { received = args; return expected; };
    const res = createResponse();

    try {
        await academicController.getMyGrades(
            { user: { id: 17 }, query: { semesterId: '8' } },
            res,
            error => { throw error; }
        );
        assert.deepEqual(received, [17, 8]);
        assert.equal(res.body, expected);
    } finally {
        academicService.getMyGrades = original;
    }
});

test('getStudentByCode returns 404 for an unknown student code', async () => {
    const original = academicService.getStudentByCode;
    const expected = { status: 'not_found', student: null, grades: [], gradeCount: 0 };
    academicService.getStudentByCode = async () => expected;
    const res = createResponse();

    try {
        await academicController.getStudentByCode(
            { params: { studentCode: 'UNKNOWN' }, query: {} },
            res,
            error => { throw error; }
        );
        assert.equal(res.statusCode, 404);
        assert.equal(res.body, expected);
    } finally {
        academicService.getStudentByCode = original;
    }
});

test('getStudentByCode serializes service validation errors as HTTP 400', async () => {
    const original = academicService.getStudentByCode;
    academicService.getStudentByCode = async () => {
        const error = new Error('Mã sinh viên không hợp lệ');
        error.status = 400;
        throw error;
    };
    const res = createResponse();

    try {
        await academicController.getStudentByCode(
            { params: { studentCode: ' ' }, query: {} },
            res,
            error => { throw error; }
        );
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { message: 'Mã sinh viên không hợp lệ' });
    } finally {
        academicService.getStudentByCode = original;
    }
});

test('getMyProfile forwards unexpected service errors to Express error middleware', async () => {
    const original = academicService.getMyProfile;
    const expectedError = new Error('database unavailable');
    academicService.getMyProfile = async () => { throw expectedError; };
    const res = createResponse();
    let forwarded;

    try {
        await academicController.getMyProfile(
            { user: { id: 17 } },
            res,
            error => { forwarded = error; }
        );
        assert.equal(forwarded, expectedError);
    } finally {
        academicService.getMyProfile = original;
    }
});
