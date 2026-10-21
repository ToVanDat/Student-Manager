const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const service = require('../service/e2eeAttachmentService');

test('E2EE attachment ticket signatures are HMAC-SHA256 and tamper-evident', () => {
    const secret = 'test-secret-with-at-least-thirty-two-bytes';
    const payload = { v: 1, method: 'PUT', attachmentId: 'a3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22', ttl: 600 };
    const ticket = service.signTicket(payload, secret);
    const [encoded, signature] = ticket.split('.');
    assert.equal(ticket.split('.').length, 2);
    assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), payload);
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    assert.equal(signature, expected);
    assert.notEqual(service.signTicket({ ...payload, method: 'GET' }, secret), ticket);
});

test('E2EE attachment size ceiling is 500 MiB', () => {
    assert.equal(service.MAX_CIPHERTEXT_BYTES, 500 * 1024 * 1024);
});
