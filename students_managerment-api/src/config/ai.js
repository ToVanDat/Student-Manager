require('dotenv').config();

// Central AI configuration. Keep deployment secrets in the ignored local .env;
// these non-secret model defaults intentionally live in source configuration.
module.exports = Object.freeze({
    ollama: Object.freeze({
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
        chatModel: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
        embeddingDimensions: 768,
        // Local CPU inference can take longer on the first request while the
        // model is loaded. Allow an operator override without editing source.
        requestTimeoutMs: Math.min(
            Math.max(Number.parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '120000', 10) || 120000, 15000),
            300000
        ),
        keepAlive: process.env.OLLAMA_KEEP_ALIVE || '10m'
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
