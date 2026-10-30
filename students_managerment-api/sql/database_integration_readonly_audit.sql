-- READ-ONLY Phase 2 integration audit for Student Manager.
-- Safe to run against the intended PostgreSQL database. SELECT statements only:
-- no DDL, DML, extension installation, locks for writes, or migration execution.
-- Review the identity row before interpreting any other result.

-- 1) Confirm the actual database identity and search path.
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_schema() AS current_schema,
       current_setting('search_path') AS search_path,
       version() AS postgres_version;

-- 2) Table readiness matrix.
-- "required" means the current application foundation expects the table.
-- "feature" means the table is required only when that feature is enabled.
WITH expected(table_name, feature, requirement) AS (
    VALUES
      ('users', 'authentication', 'required'),
      ('sessions', 'authentication', 'required'),
      ('refresh_tokens', 'authentication', 'required'),
      ('password_reset_tokens', 'authentication', 'feature'),
      ('user_webauthn_credentials', 'passkey', 'feature'),
      ('user_oauth_accounts', 'google_oauth', 'feature'),
      ('qr_login_requests', 'qr_login', 'feature'),
      ('permissions', 'rbac', 'feature'),
      ('role_permissions', 'rbac', 'feature'),
      ('students', 'academic', 'required'),
      ('classes', 'academic', 'required'),
      ('departments', 'academic', 'required'),
      ('subjects', 'academic', 'required'),
      ('semesters', 'academic', 'required'),
      ('enrollments', 'academic', 'required'),
      ('student_account_links', 'student_account_link', 'feature'),
      ('student_account_link_audit', 'student_account_link', 'feature'),
      ('conversations', 'chat', 'required'),
      ('conversation_members', 'chat', 'required'),
      ('messages', 'chat', 'required'),
      ('message_e2ee_envelopes', 'e2ee', 'feature'),
      ('e2ee_devices', 'e2ee', 'feature'),
      ('e2ee_sdk_devices', 'e2ee_sdk_relay', 'feature'),
      ('e2ee_relay_envelopes', 'e2ee_sdk_relay', 'feature'),
      ('user_face_credentials', 'face_login', 'feature'),
      ('assistant_documents', 'document_rag', 'feature'),
      ('assistant_document_chunks', 'document_rag', 'feature')
)
SELECT e.feature,
       e.requirement,
       e.table_name,
       to_regclass(format('%I.%I', current_schema(), e.table_name))::text AS resolved_relation,
       CASE WHEN to_regclass(format('%I.%I', current_schema(), e.table_name)) IS NULL
            THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM expected e
ORDER BY CASE e.requirement WHEN 'required' THEN 0 ELSE 1 END,
         e.feature, e.table_name;

-- 3) Extension readiness. This does not attempt CREATE EXTENSION.
WITH expected(extension_name, feature, requirement) AS (
    VALUES
      ('vector', 'document_rag', 'required_for_rag'),
      ('pgcrypto', 'uuid_or_crypto_helpers', 'verify_if_used')
)
SELECT e.extension_name,
       e.feature,
       e.requirement,
       a.default_version,
       a.installed_version,
       CASE WHEN x.extname IS NULL THEN 'NOT_INSTALLED' ELSE 'INSTALLED' END AS status
FROM expected e
LEFT JOIN pg_available_extensions a ON a.name = e.extension_name
LEFT JOIN pg_extension x ON x.extname = e.extension_name
ORDER BY e.extension_name;

-- 4) Critical column presence for authentication, academic mapping and RAG.
-- A missing table naturally appears as MISSING_TABLE; no query assumes it exists.
WITH expected(table_name, column_name, feature) AS (
    VALUES
      ('users', 'id', 'authentication'),
      ('users', 'role', 'authentication'),
      ('users', 'is_active', 'authentication'),
      ('sessions', 'id', 'authentication'),
      ('sessions', 'user_id', 'authentication'),
      ('sessions', 'revoked_at', 'authentication'),
      ('refresh_tokens', 'session_id', 'authentication'),
      ('refresh_tokens', 'revoked_at', 'authentication'),
      ('students', 'id', 'academic'),
      ('classes', 'id', 'academic'),
      ('students', 'class_id', 'academic'),
      ('enrollments', 'student_id', 'academic'),
      ('enrollments', 'subject_id', 'academic'),
      ('enrollments', 'semester_id', 'academic'),
      ('student_account_links', 'user_id', 'student_account_link'),
      ('student_account_links', 'student_id', 'student_account_link'),
      ('student_account_links', 'verified_at', 'student_account_link'),
      ('assistant_documents', 'visibility', 'document_rag'),
      ('assistant_documents', 'status', 'document_rag'),
      ('assistant_document_chunks', 'document_id', 'document_rag'),
      ('assistant_document_chunks', 'embedding', 'document_rag')
)
SELECT e.feature, e.table_name, e.column_name,
       CASE
         WHEN to_regclass(format('%I.%I', current_schema(), e.table_name)) IS NULL
           THEN 'MISSING_TABLE'
         WHEN c.column_name IS NULL THEN 'MISSING_COLUMN'
         ELSE 'PRESENT'
       END AS status,
       c.data_type,
       c.udt_name,
       c.is_nullable
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = current_schema()
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.feature, e.table_name, e.column_name;

-- 5) Index and constraint inventory for the security-sensitive mapping/session tables.
-- Inspect definitions; this report deliberately does not prescribe or create indexes.
SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN (
    'sessions', 'refresh_tokens', 'student_account_links',
    'user_oauth_accounts', 'user_webauthn_credentials',
    'assistant_documents', 'assistant_document_chunks'
  )
ORDER BY tablename, indexname;

SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column, rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_catalog = tc.constraint_catalog
 AND kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_catalog = tc.constraint_catalog
 AND ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_catalog = tc.constraint_catalog
 AND rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = current_schema()
  AND tc.table_name IN (
    'sessions', 'refresh_tokens', 'student_account_links',
    'user_oauth_accounts', 'user_webauthn_credentials',
    'assistant_documents', 'assistant_document_chunks'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 6) Migration bookkeeping presence. A missing ledger is informational only:
-- the repository currently uses manually reviewed SQL scripts, not an automatic runner.
SELECT to_regclass(format('%I.%I', current_schema(), 'schema_migrations'))::text
       AS schema_migrations_ledger,
       to_regclass(format('%I.%I', current_schema(), 'knex_migrations'))::text
       AS knex_migrations_ledger;
