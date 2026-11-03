-- Student Manager: read-only pgvector / RAG deployment preflight.
-- Run in DBeaver against the intended database. This script makes no changes.
-- Do NOT run CREATE EXTENSION or migrations until the results have been reviewed.

SELECT current_database() AS database_name,
       current_user AS database_user,
       current_schema() AS current_schema,
       current_setting('search_path') AS search_path,
       current_setting('server_version') AS postgres_version,
       current_setting('server_version_num') AS postgres_version_num;

-- Is the extension available on this PostgreSQL server, and is it enabled here?
SELECT name, default_version, installed_version, comment
FROM pg_available_extensions
WHERE name = 'vector';

SELECT extname, extversion, extnamespace::regnamespace AS extension_schema
FROM pg_extension
WHERE extname = 'vector';

-- Check the exact RAG tables and their columns without exposing document contents.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('assistant_documents', 'assistant_document_chunks')
ORDER BY table_name, ordinal_position;

-- Report RAG constraints and indexes.
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column
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
WHERE tc.table_schema = current_schema()
  AND tc.table_name IN ('assistant_documents', 'assistant_document_chunks')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN ('assistant_documents', 'assistant_document_chunks')
ORDER BY tablename, indexname;

-- Confirm whether the current role can create extensions/tables.
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = current_user;

SELECT
  has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
  has_schema_privilege(current_user, current_schema(), 'CREATE') AS can_create_in_schema;

-- Inventory likely migration ledgers; absence is informational, not proof of no migrations.
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_name IN ('schema_migrations', 'knex_migrations', 'SequelizeMeta', 'typeorm_migrations')
ORDER BY table_name;
