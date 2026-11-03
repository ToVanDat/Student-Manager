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
