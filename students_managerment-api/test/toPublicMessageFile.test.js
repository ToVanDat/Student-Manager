const test = require('node:test');
const assert = require('node:assert/strict');
const toPublicMessageFile = require('../utils/toPublicMessageFile');

test('public message file DTO exposes only client-safe metadata', () => {
    const input = {
        id: 17,
        message_id: 42,
        file_name: 'report.pdf',
        mime_type: 'application/pdf',
        file_size: 1234,
        created_at: '2026-10-25T09:00:00.000Z',
        storage_key: 'private/internal/path/report.pdf',
        file_path: '/srv/app/storage/uploads/chat/report.pdf',
        disk_path: '/srv/app/storage/uploads/chat/report.pdf'
    };

    const output = toPublicMessageFile(input);
    assert.deepEqual(output, {
        id: 17,
        message_id: 42,
        file_name: 'report.pdf',
        mime_type: 'application/pdf',
        file_size: 1234,
        created_at: '2026-10-25T09:00:00.000Z'
    });
    assert.equal(Object.hasOwn(output, 'storage_key'), false);
    assert.equal(Object.hasOwn(output, 'file_path'), false);
    assert.equal(Object.hasOwn(output, 'disk_path'), false);
});

test('public message file DTO handles nullish input', () => {
    assert.equal(toPublicMessageFile(null), null);
    assert.equal(toPublicMessageFile(undefined), null);
});
