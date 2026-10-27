const test = require('node:test');
const assert = require('node:assert/strict');
const aiConfig = require('../src/config/ai.js');
const {
    normalizeDocumentText,
    chunkDocumentText,
    getEmbeddingConfig,
    createDocumentEmbedding,
    getAllowedDocumentVisibility,
    assertRagSchemaReady,
    setDocumentArchived,
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
        endpoint: (aiConfig.ollama.baseUrl.endsWith('/') ? aiConfig.ollama.baseUrl.slice(0, -1) : aiConfig.ollama.baseUrl) + '/api/embed',
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
                assert.equal(url, (aiConfig.ollama.baseUrl.endsWith('/') ? aiConfig.ollama.baseUrl.slice(0, -1) : aiConfig.ollama.baseUrl) + '/api/embed');
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

test('createDocumentEmbedding aborts when the requesting client disconnects', async () => {
    const controller = new AbortController();
    let requestSignal;
    const fetchImpl = async (_url, options) => {
        requestSignal = options.signal;
        return new Promise((_resolve, reject) => {
            requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true });
            controller.abort(new Error('client disconnected'));
        });
    };

    await assert.rejects(
        createDocumentEmbedding('test', { fetchImpl, signal: controller.signal }),
        /client disconnected/
    );
    assert.equal(requestSignal.aborted, true);
});

test('document retrieval scope grants only explicitly recognized roles', () => {
    assert.deepEqual(getAllowedDocumentVisibility('user'), ['all', 'student']);
    assert.deepEqual(getAllowedDocumentVisibility('student'), ['all', 'student']);
    assert.deepEqual(getAllowedDocumentVisibility('admin'), ['all', 'student', 'admin']);
    for (const unknownRole of [undefined, null, '', 'manager', 'ADMIN']) {
        assert.deepEqual(getAllowedDocumentVisibility(unknownRole), []);
    }
});

test('RAG schema readiness fails closed until both tables and pgvector exist', () => {
    assert.doesNotThrow(() => assertRagSchemaReady({
        documents_ready: true,
        chunks_ready: true,
        vector_ready: true
    }));
    for (const readiness of [
        { documents_ready: false, chunks_ready: true, vector_ready: true },
        { documents_ready: true, chunks_ready: false, vector_ready: true },
        { documents_ready: true, chunks_ready: true, vector_ready: false },
        null
    ]) {
        assert.throws(() => assertRagSchemaReady(readiness), error =>
            error.status === 503 && error.code === 'RAG_SCHEMA_NOT_READY'
        );
    }
});


test('document archive and restore validate identifiers and preserve data', async () => {
    const documentId = '123e4567-e89b-42d3-a456-426614174000';
    const calls = [];
    const queryable = {
        query: async (sql, params) => {
            calls.push({ sql, params });
            return { rows: [{ id: documentId, status: sql.includes("SET status = 'archived'") ? 'archived' : 'ready' }] };
        }
    };

    await assert.rejects(
        setDocumentArchived({ documentId: 'not-a-uuid', archived: true, queryable }),
        error => error.status === 400
    );
    await assert.rejects(
        setDocumentArchived({ documentId, archived: 'yes', queryable }),
        error => error.status === 400
    );

    const archived = await setDocumentArchived({ documentId, archived: true, queryable });
    assert.equal(archived.status, 'archived');
    assert.match(calls[0].sql, /SET status = 'archived'/);
    assert.deepEqual(calls[0].params, [documentId]);

    const restored = await setDocumentArchived({ documentId, archived: false, queryable });
    assert.equal(restored.status, 'ready');
    assert.match(calls[1].sql, /EXISTS/);
    assert.match(calls[1].sql, /assistant_document_chunks/);
});

test('document restore reports missing archived records and duplicate conflicts safely', async () => {
    const documentId = '123e4567-e89b-42d3-a456-426614174000';
    await assert.rejects(
        setDocumentArchived({ documentId, archived: false, queryable: { query: async () => ({ rows: [] }) } }),
        error => error.status === 404
    );
    await assert.rejects(
        setDocumentArchived({
            documentId,
            archived: false,
            queryable: { query: async () => { const error = new Error('unique conflict'); error.code = '23505'; throw error; } }
        }),
        error => error.status === 409
    );
});
