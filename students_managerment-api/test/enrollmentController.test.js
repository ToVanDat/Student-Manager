const test = require('node:test');
const assert = require('node:assert/strict');
const enrollmentService = require('../service/enrollmentService');
const controller = require('../controller/enrollment_controller');

function responseRecorder() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

test('delete enrollment returns 409 when a foreign key prevents deletion', async () => {
    const original = enrollmentService.deleteEnrollment;
    enrollmentService.deleteEnrollment = async () => {
        const error = new Error('foreign key violation');
        error.code = '23503';
        throw error;
    };

    try {
        const res = responseRecorder();
        await controller.deleteEnrollment({ params: { id: '12' } }, res);

        assert.equal(res.statusCode, 409);
        assert.match(res.body.message, /đang được tham chiếu/);
    } finally {
        enrollmentService.deleteEnrollment = original;
    }
});

test('delete enrollment rejects malformed IDs before accessing the service', async () => {
    const original = enrollmentService.deleteEnrollment;
    let called = false;
    enrollmentService.deleteEnrollment = async () => {
        called = true;
        return null;
    };

    try {
        const res = responseRecorder();
        await controller.deleteEnrollment({ params: { id: '1.5' } }, res);

        assert.equal(res.statusCode, 400);
        assert.equal(called, false);
    } finally {
        enrollmentService.deleteEnrollment = original;
    }
});
