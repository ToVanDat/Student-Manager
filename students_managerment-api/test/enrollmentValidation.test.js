const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnrollment } = require('../middleware/enrollmentValidation');

test('accepts a complete enrollment with optional empty scores', () => {
    const result = validateEnrollment({
        student_id: 1, subject_id: '2', semester_id: 3,
        midterm_score: 8.5, final_score: '', total_score: null
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, {
        student_id: 1, subject_id: 2, semester_id: 3,
        midterm_score: 8.5, final_score: null, total_score: null
    });
});

test('rejects missing or invalid relationship identifiers', () => {
    const result = validateEnrollment({ student_id: 0, subject_id: 1.2, semester_id: 'abc' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.student_id);
    assert.ok(result.errors.subject_id);
    assert.ok(result.errors.semester_id);
});

test('accepts partial score updates without requiring relationship IDs', () => {
    const result = validateEnrollment({ final_score: 9 }, { partial: true });
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, { final_score: 9 });
});

test('rejects empty patches, non-finite scores, and unsupported fields', () => {
    assert.equal(validateEnrollment({}, { partial: true }).valid, false);
    const result = validateEnrollment({ final_score: 'NaN', ignored: true }, { partial: true });
    assert.equal(result.valid, false);
    assert.ok(result.errors.final_score);
    assert.ok(result.errors.ignored);
});

test('allows explicitly clearing a score with null', () => {
    const result = validateEnrollment({ midterm_score: null }, { partial: true });
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, { midterm_score: null });
});

test('rejects boolean identifiers rather than coercing true to ID 1', () => {
    const result = validateEnrollment({ student_id: true, subject_id: 2, semester_id: 3 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.student_id);
});


test('rejects scores outside the academic 0–10 scale', () => {
    for (const score of [-0.01, 10.01, 11, -1]) {
        const result = validateEnrollment({ final_score: score }, { partial: true });
        assert.equal(result.valid, false, `score ${score} must be rejected`);
        assert.ok(result.errors.final_score);
    }
});

test('accepts boundary scores 0 and 10', () => {
    for (const score of [0, 10]) {
        const result = validateEnrollment({ final_score: score }, { partial: true });
        assert.equal(result.valid, true);
        assert.equal(result.data.final_score, score);
    }
});
