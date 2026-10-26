const crypto = require('crypto');
const pool = require('../src/config/database.js');
const aiConfig = require('../src/config/ai.js');
const MAX_DOCUMENT_CHARS = aiConfig.rag.maxDocumentChars;
const DEFAULT_CHUNK_SIZE = aiConfig.rag.chunkSize;
const DEFAULT_CHUNK_OVERLAP = aiConfig.rag.chunkOverlap;
const MAX_DOCUMENT_CHUNKS = aiConfig.rag.maxChunksPerDocument;
const EMBEDDING_DIMENSIONS = aiConfig.ollama.embeddingDimensions;
// A single Node process may run only one document-ingestion embedding loop at a time.
let documentIngestionInProgress = false;

function normalizeDocumentText(value) {
    if (typeof value !== 'string') throw new TypeError('Document text must be a string');
    const normalized = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    if (!normalized) throw new Error('Document is empty');
    if (normalized.length > MAX_DOCUMENT_CHARS) throw new Error('Document exceeds the maximum text size');
    return normalized;
}

function chunkDocumentText(value, {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_CHUNK_OVERLAP
} = {}) {
    const text = normalizeDocumentText(value);
    if (!Number.isInteger(chunkSize) || chunkSize < 200 || chunkSize > 8000) {
        throw new RangeError('chunkSize must be an integer between 200 and 8000');
    }
    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
        throw new RangeError('overlap must be a non-negative integer smaller than chunkSize');
    }

    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);
        if (end < text.length) {
            const boundary = text.lastIndexOf('\n', end);
            const sentenceBoundary = Math.max(
                text.lastIndexOf('. ', end),
                text.lastIndexOf('? ', end),
                text.lastIndexOf('! ', end)
            );
            const preferred = Math.max(boundary, sentenceBoundary);
            if (preferred > start + Math.floor(chunkSize * 0.6)) end = preferred + 1;
        }
        const content = text.slice(start, end).trim();
        if (content) chunks.push({ chunk_index: chunks.length, content });
        if (end >= text.length) break;
        start = Math.max(start + 1, end - overlap);
    }
    return chunks;
}

function getEmbeddingConfig() {
    const rawUrl = aiConfig.ollama.baseUrl;
    let url;
    try { url = new URL(rawUrl); }
    catch {
        const error = new Error('OLLAMA_BASE_URL không hợp lệ');
        error.status = 503;
        throw error;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
        || url.search || url.hash
        || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname))) {
        const error = new Error('OLLAMA_BASE_URL phải là loopback HTTP hoặc HTTPS hợp lệ');
        error.status = 503;
        throw error;
    }
    return {
        endpoint: url.toString().replace(/\/$/, '') + '/api/embed',
        model: aiConfig.ollama.embeddingModel
    };
}

function createEmbeddingAbortSignal(clientSignal, timeoutMs) {
    const controller = new AbortController();
    const abortFromClient = () => {
        if (!controller.signal.aborted) {
            controller.abort(clientSignal?.reason || new Error('Chat request client disconnected'));
        }
    };
    if (clientSignal?.aborted) abortFromClient();
    else clientSignal?.addEventListener('abort', abortFromClient, { once: true });
    const timeout = setTimeout(() => {
        if (!controller.signal.aborted) controller.abort(new Error('Ollama embedding request timed out'));
    }, timeoutMs);
    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timeout);
            clientSignal?.removeEventListener('abort', abortFromClient);
        }
    };
}

async function createDocumentEmbedding(text, { fetchImpl = fetch, signal = null } = {}) {
    const config = getEmbeddingConfig();
    const requestAbort = createEmbeddingAbortSignal(signal, aiConfig.ollama.requestTimeoutMs);
    let response;
    try {
        response = await fetchImpl(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: requestAbort.signal,
            body: JSON.stringify({ model: config.model, input: text })
        });
    } finally {
        requestAbort.cleanup();
    }
    if (!response.ok) {
        const error = new Error('Không thể tạo embedding. Kiểm tra Ollama và OLLAMA_EMBEDDING_MODEL.');
        error.status = 503;
        throw error;
    }
    const payload = await response.json();
    const embedding = payload?.embeddings?.[0];
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS
        || !embedding.every(value => Number.isFinite(value))) {
        const error = new Error('Embedding model phải trả về vector 768 chiều hợp lệ');
        error.status = 502;
        throw error;
    }
    return embedding;
}


async function ingestTextDocument({ title, sourceName, text: sourceText, visibility, createdBy }) {
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        const error = new Error('Tiêu đề tài liệu phải có từ 1 đến 200 ký tự');
        error.status = 400;
        throw error;
    }
    if (!['all', 'student', 'admin'].includes(visibility)) {
        const error = new Error('Phạm vi tài liệu không hợp lệ');
        error.status = 400;
        throw error;
    }
    if (typeof sourceName !== 'string' || !sourceName.trim() || sourceName.length > 255) {
        const error = new Error('Tên tệp không hợp lệ');
        error.status = 400;
        throw error;
    }
    const normalized = normalizeDocumentText(sourceText);
    const chunks = chunkDocumentText(normalized);
    if (!chunks.length || chunks.length > MAX_DOCUMENT_CHUNKS) {
        const error = new Error(`Tài liệu vượt quá giới hạn ${MAX_DOCUMENT_CHUNKS} đoạn`);
        error.status = 413;
        throw error;
    }

    // Reject overlapping ingestion jobs in this Node process. This prevents
    // multiple admin uploads from multiplying embedding memory/CPU pressure.
    // This is intentionally not described as a distributed lock across replicas.
    if (documentIngestionInProgress) {
        const error = new Error('Hệ thống đang nạp một tài liệu khác. Vui lòng thử lại sau.');
        error.status = 503;
        throw error;
    }

    documentIngestionInProgress = true;
    let indexedChunks;
    try {
        // Compute vectors before opening the database transaction so slow Ollama
        // inference does not hold a PostgreSQL connection or transaction lock.
        indexedChunks = [];
        for (const chunk of chunks) {
            indexedChunks.push({ ...chunk, embedding: await createDocumentEmbedding(chunk.content) });
        }
    } finally {
        documentIngestionInProgress = false;
    }

    const sourceSha256 = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    const client = await pool.connect();
    let inTransaction = false;
    try {
        await client.query('BEGIN');
        inTransaction = true;
        const duplicate = await client.query(
            'SELECT id, title FROM assistant_documents WHERE source_sha256 = $1 AND visibility = $2 AND status = $3 LIMIT 1',
            [sourceSha256, visibility, 'ready']
        );
        if (duplicate.rows[0]) {
            const error = new Error('Tài liệu này đã được nạp trước đó trong cùng phạm vi');
            error.status = 409;
            throw error;
        }
        const created = await client.query(
            `INSERT INTO assistant_documents
                (title, source_name, source_sha256, mime_type, visibility, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'processing', $6)
             RETURNING id, title, source_name, visibility, status, created_at`,
            [title.trim(), sourceName, sourceSha256, 'text/plain', visibility, createdBy]
        );
        const document = created.rows[0];

        for (const chunk of indexedChunks) {
            await client.query(
                `INSERT INTO assistant_document_chunks
                    (document_id, chunk_index, page_number, content, embedding)
                 VALUES ($1, $2, NULL, $3, $4::vector)`,
                [document.id, chunk.chunk_index, chunk.content, `[${chunk.embedding.join(',')}]`]
            );
        }
        const ready = await client.query(
            `UPDATE assistant_documents SET status = 'ready', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, title, source_name, visibility, status, created_at`,
            [document.id]
        );
        await client.query('COMMIT');
        inTransaction = false;
        return { ...ready.rows[0], chunkCount: chunks.length };
    } catch (error) {
        if (inTransaction) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) {
                console.error('[RAG] Rollback failed:', rollbackError.message);
            }
        }
        throw error;
    } finally {
        client.release();
    }
}

async function listDocuments() {
    const result = await pool.query(
        `SELECT id, title, source_name, visibility, status, created_at, updated_at
         FROM assistant_documents
         ORDER BY created_at DESC
         LIMIT 200`
    );
    return result.rows;
}

function getAllowedDocumentVisibility(role) {
    return role === 'admin' ? ['all', 'student', 'admin'] : ['all', 'student'];
}

async function retrieveDocumentContext({ question, role, limit = aiConfig.rag.retrievalLimit, signal = null }) {
    const schemaReady = await pool.query(
        `SELECT to_regclass('assistant_documents') IS NOT NULL AS documents_ready,
                to_regclass('assistant_document_chunks') IS NOT NULL AS chunks_ready,
                EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_ready`
    );
    const readiness = schemaReady.rows[0];
    if (!readiness?.documents_ready || !readiness?.chunks_ready || !readiness?.vector_ready) return [];
    const query = normalizeDocumentText(question).slice(0, 4000);
    const embedding = await createDocumentEmbedding(query, { signal });
    const allowedVisibility = getAllowedDocumentVisibility(role);
    const result = await pool.query(
        `SELECT d.id AS document_id, d.title, d.source_name,
                c.chunk_index, c.page_number, c.content,
                (c.embedding <=> $1::vector) AS distance
         FROM assistant_document_chunks c
         JOIN assistant_documents d ON d.id = c.document_id
         WHERE d.status = 'ready'
           AND d.visibility = ANY($2::varchar[])
         ORDER BY c.embedding <=> $1::vector
         LIMIT $3`,
        [`[${embedding.join(',')}]`, allowedVisibility, Math.min(Math.max(Number(limit) || 5, 1), 8)]
    );
    return result.rows.map(row => ({
        documentId: row.document_id,
        title: row.title,
        sourceName: row.source_name,
        chunkIndex: row.chunk_index,
        pageNumber: row.page_number,
        content: row.content,
        distance: Number(row.distance)
    }));
}

module.exports = {
    MAX_DOCUMENT_CHARS,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_CHUNK_OVERLAP,
    EMBEDDING_DIMENSIONS,
    normalizeDocumentText,
    chunkDocumentText,
    getEmbeddingConfig,
    createDocumentEmbedding,
    ingestTextDocument,
    retrieveDocumentContext,
    getAllowedDocumentVisibility,
    listDocuments
};
