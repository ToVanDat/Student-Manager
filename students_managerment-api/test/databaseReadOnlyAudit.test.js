const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const auditPath = path.join(__dirname, '..', 'sql', 'database_integration_readonly_audit.sql');

test('database integration audit contains read-only SQL statements only', () => {
    const sql = fs.readFileSync(auditPath, 'utf8')
        .replace(/--[^\n]*/g, '')
        .trim();

    const statements = sql
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean);

    assert.ok(statements.length >= 8, 'expected the audit to retain its inspection queries');

    for (const statement of statements) {
        assert.match(
            statement,
            /^(?:WITH\b[\s\S]*?\bSELECT\b|SELECT\b)/i,
            `non-read-only statement detected: ${statement.slice(0, 100)}`
        );
        assert.doesNotMatch(
            statement,
            /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|COPY|VACUUM|ANALYZE)\b/i,
            `mutating or procedural SQL detected: ${statement.slice(0, 100)}`
        );
    }
});

test('database integration audit checks identity, core features, extensions and integrity metadata', () => {
    const sql = fs.readFileSync(auditPath, 'utf8');

    for (const token of [
        'current_database()',
        'current_user',
        'assistant_documents',
        'assistant_document_chunks',
        'user_oauth_accounts',
        'user_webauthn_credentials',
        'student_account_links',
        'pg_available_extensions',
        'pg_indexes',
        'table_constraints'
    ]) {
        assert.ok(sql.includes(token), `audit is missing expected check: ${token}`);
    }
});
