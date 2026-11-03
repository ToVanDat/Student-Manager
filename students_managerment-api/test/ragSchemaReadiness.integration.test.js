const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database.js');
const {
    getRagSchemaReadiness,
    ingestTextDocument
} = require('../service/ragService.js');

test('RAG ingestion fails closed on an isolated PostgreSQL database without provisioning schema', {
    skip: process.env.RAG_SCHEMA_GUARD_INTEGRATION !== '1'
}, async () => {
    const expectedDatabase = 'rag_schema_guard_integration';
    const identity = await pool.query(
        'SELECT current_database() AS database_name, current_user AS database_user'
    );
    assert.equal(identity.rows[0].database_name, expectedDatabase,
        'refusing to run RAG schema guard test against an unexpected database');

    const readiness = await getRagSchemaReadiness(pool);
    assert.equal(readiness.documents_ready, false);
    assert.equal(readiness.chunks_ready, false);
    assert.equal(readiness.vector_ready, false);

    await assert.rejects(
        ingestTextDocument({
            title: 'Integration guard fixture',
            sourceName: 'integration-guard.txt',
            text: 'This text must not be sent to Ollama when the RAG schema is unavailable.',
            visibility: 'student',
            createdBy: 1
        }),
        error => error.code === 'RAG_SCHEMA_NOT_READY' && error.status === 503
    );
});

test.after(async () => {
    await pool.end();
});
