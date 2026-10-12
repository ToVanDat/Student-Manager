const test = require('node:test');
const assert = require('node:assert/strict');

const upload = require('../middleware/uploadMiddleware');

test('upload policy defines the expected per-MIME size limits', () => {
    const limits = upload.MIME_LIMITS;
    assert.equal(limits['image/jpeg'], 20 * 1024 * 1024);
    assert.equal(limits['image/png'], 20 * 1024 * 1024);
    assert.equal(limits['video/mp4'], 500 * 1024 * 1024);
    assert.equal(limits['video/webm'], 500 * 1024 * 1024);
    assert.equal(limits['application/pdf'], 100 * 1024 * 1024);
    assert.equal(limits['audio/mpeg'], 100 * 1024 * 1024);
});

test('upload policy excludes executable and unknown MIME types', () => {
    const limits = upload.MIME_LIMITS;
    assert.equal(Object.hasOwn(limits, 'application/x-msdownload'), false);
    assert.equal(Object.hasOwn(limits, 'application/javascript'), false);
    assert.equal(Object.hasOwn(limits, 'application/octet-stream'), false);
});

test('every configured MIME has a positive safe-integer byte limit', () => {
    for (const [mime, limit] of Object.entries(upload.MIME_LIMITS)) {
        assert.ok(mime.includes('/'), 'MIME type should be well-formed');
        assert.ok(Number.isSafeInteger(limit) && limit > 0, `Invalid limit for ${mime}`);
    }
});
