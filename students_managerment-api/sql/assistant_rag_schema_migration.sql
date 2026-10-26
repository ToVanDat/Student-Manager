-- Student Manager document-RAG schema (manual prerequisite migration).
-- This script NEVER installs extensions, uploads files, or modifies existing academic tables.
-- Prerequisite: pgvector must already be installed and enabled by the database operator.
-- Embedding contract: nomic-embed-text, 768 dimensions. Changing model/dimensions requires re-indexing.
BEGIN;

DO $rag$
DECLARE
  schema_name text := current_schema();
  users_table regclass;
  users_id_type text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension is not installed/enabled. This migration will not create extensions.';
  END IF;
  users_table := to_regclass(format('%I.%I', schema_name, 'users'));
  IF users_table IS NULL THEN
    RAISE EXCEPTION 'Required table %.users does not exist', schema_name;
  END IF;
  SELECT format_type(a.atttypid, a.atttypmod) INTO users_id_type
    FROM pg_attribute a
   WHERE a.attrelid = users_table AND a.attname = 'id'
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF users_id_type IS NULL THEN
    RAISE EXCEPTION 'Required column %.users.id does not exist', schema_name;
  END IF;
  IF to_regclass(format('%I.%I', schema_name, 'assistant_documents')) IS NOT NULL
     OR to_regclass(format('%I.%I', schema_name, 'assistant_document_chunks')) IS NOT NULL THEN
    RAISE EXCEPTION 'Assistant RAG tables already exist; inspect them before applying this migration';
  END IF;
  EXECUTE format(
    'CREATE TABLE %I.assistant_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
      source_name varchar(255) NOT NULL CHECK (length(btrim(source_name)) > 0),
      source_sha256 char(64) NOT NULL,
      mime_type varchar(100) NOT NULL,
      visibility varchar(16) NOT NULL CHECK (visibility IN (''all'', ''student'', ''admin'')),
      status varchar(16) NOT NULL DEFAULT ''processing'' CHECK (status IN (''processing'', ''ready'', ''failed'')),
      created_by %s NOT NULL REFERENCES %I.users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )',
    schema_name, users_id_type, schema_name
  );
END
$rag$;

CREATE INDEX assistant_documents_visibility_status_idx
  ON assistant_documents (visibility, status, created_at DESC);
CREATE INDEX assistant_documents_created_by_idx
  ON assistant_documents (created_by, created_at DESC);

CREATE TABLE assistant_document_chunks (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES assistant_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX assistant_document_chunks_document_idx
  ON assistant_document_chunks (document_id, chunk_index);

COMMENT ON TABLE assistant_documents IS
'Admin-managed knowledge-base documents. Uploaded source text is stored in PostgreSQL; never use the E2EE ciphertext bucket for plaintext RAG content.';
COMMENT ON COLUMN assistant_documents.visibility IS
'Backend-enforced retrieval scope: all, student, or admin. Student requests may retrieve only all/student documents.';
COMMENT ON COLUMN assistant_documents.source_sha256 IS
'SHA-256 of the original uploaded source, used for duplicate detection and integrity auditing.';
COMMENT ON COLUMN assistant_document_chunks.embedding IS
'768-dimensional nomic-embed-text vector. Re-embed all chunks when changing embedding model or dimensions.';

COMMIT;

-- Read-only verification.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('assistant_documents', 'assistant_document_chunks')
ORDER BY table_name, ordinal_position;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
