const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTextDocument, getSafeSourceName } = require('../service/documentTextExtractor.js');

test('extractTextDocument accepts UTF-8 TXT and normalizes line endings/BOM', () => {
    const result = extractTextDocument({
        buffer: Buffer.from('\uFEFFQuy chế\r\n\r\nĐiều 1', 'utf8'),
        originalName: 'quy-che.TXT',
        mimeType: 'text/plain'
    });
    assert.equal(result.text, 'Quy chế\n\nĐiều 1');
    assert.equal(result.sourceName, 'quy-che.TXT');
    assert.equal(result.mimeType, 'text/plain');
    assert.equal(result.format, 'txt');
    assert.equal(result.paragraphCount, 2);
});

test('extractTextDocument rejects malformed UTF-8, binary data and empty files', () => {
    assert.throws(() => extractTextDocument({
        buffer: Buffer.from([0xc3, 0x28]),
        originalName: 'broken.txt',
        mimeType: 'text/plain'
    }), error => error.status === 400);
    assert.throws(() => extractTextDocument({
        buffer: Buffer.from('abc\u0000def'),
        originalName: 'binary.txt',
        mimeType: 'text/plain'
    }), error => error.status === 400);
    assert.throws(() => extractTextDocument({
        buffer: Buffer.alloc(0),
        originalName: 'empty.txt',
        mimeType: 'text/plain'
    }), error => error.status === 400);
});

test('extractTextDocument fails closed for renamed PDF/DOCX and unsupported MIME', () => {
    for (const [name, mimeType] of [
        ['scan.pdf', 'application/pdf'],
        ['report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['renamed.txt', 'application/pdf']
    ]) {
        assert.throws(() => extractTextDocument({
            buffer: Buffer.from('not actually text'),
            originalName: name,
            mimeType
        }), error => error.status === 415);
    }
});

test('extractTextDocument enforces byte limit and safe basename', () => {
    assert.throws(() => extractTextDocument({
        buffer: Buffer.alloc(1024 * 1024 + 1, 0x61),
        originalName: 'large.txt',
        mimeType: 'text/plain'
    }), error => error.status === 413);
    assert.equal(getSafeSourceName('../../private\\file.txt'), 'file.txt');
});
