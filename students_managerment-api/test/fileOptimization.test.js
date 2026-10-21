const test = require('node:test');
const assert = require('node:assert/strict');
const { optimizeUploadedFile } = require('../service/fileOptimizationService');

test('document, audio, GIF and unsupported formats preserve original bytes', async () => {
    for (const mimetype of [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/mpeg',
        'image/gif',
        'text/plain'
    ]) {
        const result = await optimizeUploadedFile({ path: 'unused', mimetype });
        assert.equal(result.optimized, false, mimetype);
        assert.equal(result.reason, 'preserved-original', mimetype);
    }
});

test('invalid input does not invoke an optimizer', async () => {
    assert.deepEqual(await optimizeUploadedFile(null), { optimized: false, reason: 'invalid-input' });
    assert.deepEqual(await optimizeUploadedFile({ path: '/tmp/file' }), { optimized: false, reason: 'invalid-input' });
});
