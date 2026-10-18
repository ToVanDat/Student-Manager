const test = require('node:test');
const assert = require('node:assert/strict');
const validateStudent = require('../middleware/studentValidation');

const basePayload = () => ({
    student_code: 'SV001',
    name: 'Nguyen Van An',
    email: 'an@example.edu',
    date_of_birth: '2004-05-20',
    gender: 'Nam',
    class_id: 1
});

const runValidation = (body) => {
    let statusCode = 200;
    let responseBody = null;
    let passed = false;
    const req = { body };
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        }
    };

    validateStudent(req, res, () => { passed = true; });
    return { statusCode, responseBody, passed };
};

runValidation.partial = (body) => {
    let statusCode = 200;
    let responseBody = null;
    let passed = false;
    const req = { body };
    const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { responseBody = payload; return this; }
    };
    validateStudent.partial(req, res, () => { passed = true; });
    return { statusCode, responseBody, passed };
};

test('accepts a valid student create/update payload', () => {
    const result = runValidation(basePayload());
    assert.equal(result.passed, true);
    assert.equal(result.statusCode, 200);
});

test('returns 400 field errors rather than throwing for non-string fields', () => {
    const result = runValidation({
        ...basePayload(),
        student_code: 123,
        name: { value: 'An' },
        email: null
    });

    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 400);
    assert.ok(result.responseBody.errors.student_code);
    assert.ok(result.responseBody.errors.name);
    assert.ok(result.responseBody.errors.email);
});

test('rejects invalid class identifiers and unsupported gender values', () => {
    const result = runValidation({
        ...basePayload(),
        class_id: 1.5,
        gender: 'unknown'
    });

    assert.equal(result.statusCode, 400);
    assert.ok(result.responseBody.errors.class_id);
    assert.ok(result.responseBody.errors.gender);
});

test('rejects future birth dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const result = runValidation({
        ...basePayload(),
        date_of_birth: futureDate.toISOString().slice(0, 10)
    });

    assert.equal(result.statusCode, 400);
    assert.ok(result.responseBody.errors.date_of_birth);
});


test('accepts a partial update with only one supplied field', () => {
    const result = runValidation.partial({ name: 'Nguyen Van An' });
    assert.equal(result.passed, true);
    assert.equal(result.statusCode, 200);
});

test('validates supplied fields in a partial update without requiring omitted fields', () => {
    const result = runValidation.partial({ email: 'not-an-email' });
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 400);
    assert.ok(result.responseBody.errors.email);
    assert.equal(result.responseBody.errors.name, undefined);
});

test('rejects an empty partial update', () => {
    const result = runValidation.partial({});
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 400);
});

test('rejects impossible calendar dates', () => {
    const result = runValidation({ ...basePayload(), date_of_birth: '2004-02-31' });
    assert.equal(result.passed, false);
    assert.ok(result.responseBody.errors.date_of_birth);
});


test('rejects unsupported fields instead of silently ignoring them', () => {
    const result = runValidation({ ...basePayload(), is_admin: true });
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.responseBody.errors.body, /is_admin/);
});

test('rejects unsupported fields in a partial update', () => {
    const result = runValidation.partial({ name: 'Nguyen Van An', role: 'admin' });
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.responseBody.errors.body, /role/);
});
