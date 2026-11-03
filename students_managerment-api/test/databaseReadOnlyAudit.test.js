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

    assert.ok(statements.length >= 7, 'expected the audit to retain its inspection queries');

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


const coreAcademicAuditPath = path.join(__dirname, '..', 'sql', 'core_academic_readonly_audit.sql');

test('core academic audit is explicitly read-only and never performs schema or data mutations', () => {
    const sql = fs.readFileSync(coreAcademicAuditPath, 'utf8')
        .replace(/--[^\n]*/g, '')
        .trim();

    assert.match(sql, /current_database\(\)/i);
    assert.match(sql, /pg_class/i);
    assert.match(sql, /information_schema\.columns/i);
    assert.match(sql, /pg_indexes/i);
    assert.match(sql, /schedule_change_logs/i);

    // Procedural blocks are allowed only for guarded COUNT(*) checks and NOTICE output.
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|VACUUM|ANALYZE)\b/i);
    assert.match(sql, /EXECUTE\s+format\(\s*'SELECT COUNT\(\*\)/i);
    assert.match(sql, /RAISE NOTICE/i);
});

test('core academic audit distinguishes timetable candidate objects from required academic tables', () => {
    const sql = fs.readFileSync(coreAcademicAuditPath, 'utf8');

    for (const token of [
        "('students', 'student_records', 'required')",
        "('enrollments', 'enrollment_and_grades', 'required')",
        "('class_schedules', 'timetable', 'candidate')",
        "('schedule_sessions', 'timetable', 'candidate')",
        "('schedule_change_logs', 'timetable_history', 'candidate')",
        'duplicate student/subject/semester groups'
    ]) {
        assert.ok(sql.includes(token), `core academic audit is missing expected check: ${token}`);
    }
});
