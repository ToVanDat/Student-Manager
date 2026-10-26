const MAX_DOCUMENT_CHARS = 2_000_000;
const DEFAULT_CHUNK_SIZE = 1800;
const DEFAULT_CHUNK_OVERLAP = 250;
const EMBEDDING_DIMENSIONS = 768;

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
    const rawUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
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
        model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    };
}

async function createDocumentEmbedding(text, { fetchImpl = fetch } = {}) {
    const config = getEmbeddingConfig();
    const response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ model: config.model, input: text })
    });
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

module.exports = {
    MAX_DOCUMENT_CHARS,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_CHUNK_OVERLAP,
    EMBEDDING_DIMENSIONS,
    normalizeDocumentText,
    chunkDocumentText,
    getEmbeddingConfig,
    createDocumentEmbedding
};
