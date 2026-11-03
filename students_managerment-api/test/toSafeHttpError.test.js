const test = require('node:test');
const assert = require('node:assert/strict');
const { toSafeHttpError } = require('../service/toSafeHttpError');

test('preserves safe client error status and message', () => {
    assert.deepEqual(toSafeHttpError({ statusCode: 403, message: 'Không có quyền' }, 'Lỗi nội bộ'), {
        statusCode: 403,
        message: 'Không có quyền'
    });
});

test('does not expose internal server error messages', () => {
    assert.deepEqual(toSafeHttpError({ statusCode: 500, message: 'SELECT * FROM secrets' }, 'Không thể xử lý yêu cầu'), {
        statusCode: 500,
        message: 'Không thể xử lý yêu cầu'
    });
});

test('maps invalid or non-client statuses to a generic 500 response', () => {
    for (const error of [
        new Error('database password'),
        { statusCode: 700, message: 'internal' },
        { status: 503, message: 'upstream host details' }
    ]) {
        assert.deepEqual(toSafeHttpError(error, 'Có lỗi xảy ra'), {
            statusCode: 500,
            message: 'Có lỗi xảy ra'
        });
    }
});

test('accepts valid client status from the status property', () => {
    assert.deepEqual(toSafeHttpError({ status: 404, message: 'Không tìm thấy' }, 'Lỗi nội bộ'), {
        statusCode: 404,
        message: 'Không tìm thấy'
    });
});
