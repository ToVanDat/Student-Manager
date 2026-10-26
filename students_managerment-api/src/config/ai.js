// Central AI configuration. Keep deployment secrets in the ignored local .env;
// these non-secret model defaults intentionally live in source configuration.
module.exports = Object.freeze({
    ollama: Object.freeze({
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
        chatModel: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
        embeddingDimensions: 768,
        requestTimeoutMs: 45000
    }),
    rag: Object.freeze({
        maxUploadBytes: 1024 * 1024,
        maxDocumentChars: 500_000,
        maxChunksPerDocument: 300,
        chunkSize: 1800,
        chunkOverlap: 250,
        retrievalLimit: 5
    })
});
