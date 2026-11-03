const test = require('node:test');
const assert = require('node:assert/strict');
const studentService = require('../service/studentService');
const controller = require('../controller/student_controller');

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('student portal uses only the authenticated user id', async () => {
    const original = studentService.getStudentPortalByUserId;
    const calls = [];
    studentService.getStudentPortalByUserId = async id => { calls.push(id); return { linked: false, student: null, enrollments: [] }; };
    try {
        const res = response();
        await controller.getMyStudentPortal({ user: { id: 42 } }, res);
        assert.deepEqual(calls, [42]);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { linked: false, student: null, enrollments: [] });
    } finally { studentService.getStudentPortalByUserId = original; }
});

test('missing account-link schema is reported without exposing SQL details', async () => {
    const original = studentService.getStudentPortalByUserId;
    studentService.getStudentPortalByUserId = async () => { const error = new Error('relation missing'); error.code = '42P01'; throw error; };
    try {
        const res = response();
        await controller.getMyStudentPortal({ user: { id: 42 } }, res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, 'STUDENT_LINK_SCHEMA_NOT_READY');
        assert.equal(res.body.message.includes('student_account_links'), false);
    } finally { studentService.getStudentPortalByUserId = original; }
});
