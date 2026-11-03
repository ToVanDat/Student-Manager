const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../service/studentService');
const repository = require('../repository/studentRepository');

test('account link validation requires positive safe integer identifiers', async () => {
    for (const id of [0, -1, 'x', '1.2', '9007199254740992']) {
        assert.deepEqual(await service.createStudentAccountLink(id, 2, 1, { confirmIdentity: true }), { kind: 'invalid_id' });
    }
});

test('account link validation requires explicit identity confirmation and rejects extra fields', async () => {
    assert.deepEqual(await service.createStudentAccountLink(1, 2, 3, { confirmIdentity: false }), { kind: 'invalid_confirmation' });
    assert.deepEqual(await service.createStudentAccountLink(1, 2, 3, { confirmIdentity: true, studentId: 999 }), { kind: 'invalid_body' });
    assert.deepEqual(await service.createStudentAccountLink(1, 2, 3, { confirmIdentity: true, verificationNote: 'x'.repeat(501) }), { kind: 'invalid_confirmation' });
});

test('valid link request delegates authenticated actor and normalized note to repository', async () => {
    const original = repository.createVerifiedStudentAccountLink;
    const calls = [];
    repository.createVerifiedStudentAccountLink = async input => { calls.push(input); return { kind: 'ok', link: input }; };
    try {
        const result = await service.createStudentAccountLink('11', '22', '33', { confirmIdentity: true, verificationNote: ' Checked with registrar ' });
        assert.equal(result.kind, 'ok');
        assert.deepEqual(calls, [{ userId: 11, studentId: 22, actorId: 33, note: 'Checked with registrar' }]);
    } finally { repository.createVerifiedStudentAccountLink = original; }
});

test('unlink requires a meaningful reason and delegates to repository', async () => {
    assert.deepEqual(await service.unlinkStudentAccount(11, 33, { reason: 'short' }), { kind: 'invalid_reason' });
    const original = repository.removeStudentAccountLink;
    const calls = [];
    repository.removeStudentAccountLink = async input => { calls.push(input); return { kind: 'ok' }; };
    try {
        assert.deepEqual(await service.unlinkStudentAccount(11, 33, { reason: 'Identity correction' }), { kind: 'ok' });
        assert.deepEqual(calls, [{ userId: 11, actorId: 33, reason: 'Identity correction' }]);
    } finally { repository.removeStudentAccountLink = original; }
});
