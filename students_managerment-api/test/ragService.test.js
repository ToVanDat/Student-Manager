const test = require('node:test');
const assert = require('node:assert/strict');
const aiConfig = require('../src/config/ai.js');
const {
    normalizeDocumentText,
    chunkDocumentText,
    getEmbeddingConfig,
    createDocumentEmbedding,
    getAllowedDocumentVisibility,
    EMBEDDING_DIMENSIONS
} = require('../service/ragService.js');

test('normalizeDocumentText normalizes newlines and removes control characters', () => {
    assert.equal(normalizeDocumentText('  line one\r\nline two\u0000  '), 'line one\nline two');
});

test('normalizeDocumentText rejects empty and oversized documents', () => {
    assert.throws(() => normalizeDocumentText('  '), /empty/i);
    assert.throws(() => normalizeDocumentText('x'.repeat(2_000_001)), /maximum/i);
    assert.throws(() => normalizeDocumentText(null), TypeError);
});

test('chunkDocumentText produces bounded ordered chunks with overlap', () => {
    const source = Array.from({ length: 80 }, (_, i) => `Paragraph ${i}. This is a sample academic policy sentence.`).join('\n');
    const chunks = chunkDocumentText(source, { chunkSize: 300, overlap: 50 });
    assert.ok(chunks.length > 1);
    assert.deepEqual(chunks.map(chunk => chunk.chunk_index), chunks.map((_, index) => index));
    assert.ok(chunks.every(chunk => chunk.content.length <= 300));
    assert.ok(chunks.every(chunk => chunk.content.trim().length > 0));
    assert.ok(chunks.some((chunk, index) => index > 0 && source.includes(chunk.content)));
});

test('chunkDocumentText validates chunk size and overlap', () => {
    assert.throws(() => chunkDocumentText('a'.repeat(300), { chunkSize: 100 }), RangeError);
    assert.throws(() => chunkDocumentText('a'.repeat(300), { chunkSize: 200, overlap: 200 }), RangeError);
});

test('getEmbeddingConfig uses centralized AI runtime configuration', () => {
    assert.deepEqual(getEmbeddingConfig(), {
        endpoint: aiConfig.ollama.baseUrl.replace(/\\/$/, '') + '/api/embed',
        model: aiConfig.ollama.embeddingModel
    });
});

test('createDocumentEmbedding validates the 768-dimensional response', async () => {
    const oldUrl = process.env.OLLAMA_BASE_URL;
    try {
        delete process.env.OLLAMA_BASE_URL;
        const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
        const result = await createDocumentEmbedding('test', {
            fetchImpl: async (url, options) => {
                assert.equal(url, aiConfig.ollama.baseUrl.replace(/\\/$/, '') + '/api/embed');
                const body = JSON.parse(options.body);
                assert.equal(body.model, aiConfig.ollama.embeddingModel);
                assert.equal(body.input, 'test');
                return { ok: true, json: async () => ({ embeddings: [embedding] }) };
            }
        });
        assert.equal(result.length, EMBEDDING_DIMENSIONS);
        await assert.rejects(
            createDocumentEmbedding('test', {
                fetchImpl: async () => ({ ok: true, json: async () => ({ embeddings: [[1, 2, 3]] }) })
            }),
            error => error.status === 502
        );
    } finally {
        if (oldUrl === undefined) delete process.env.OLLAMA_BASE_URL;
        else process.env.OLLAMA_BASE_URL = oldUrl;
    }
});

test('document retrieval scope never exposes admin-only material to student users', () => {
    assert.deepEqual(getAllowedDocumentVisibility('user'), ['all', 'student']);
    assert.deepEqual(getAllowedDocumentVisibility('student'), ['all', 'student']);
    assert.deepEqual(getAllowedDocumentVisibility('admin'), ['all', 'student', 'admin']);
});
