-- Non-destructive lifecycle extension for the admin-managed RAG knowledge base.
-- Manual prerequisite: inspect the target database and apply only after the base
-- assistant_rag_schema_migration.sql has been verified.
-- This migration archives documents; it does not delete document rows or chunks.
BEGIN;

DO $archive$
DECLARE
  schema_name text := current_schema();
  documents_table regclass;
  constraint_row record;
BEGIN
  documents_table := to_regclass(format('%I.%I', schema_name, 'assistant_documents'));
  IF documents_table IS NULL THEN
    RAISE EXCEPTION 'Required table %.assistant_documents does not exist', schema_name;
  END IF;

  IF to_regclass(format('%I.%I', schema_name, 'assistant_document_chunks')) IS NULL THEN
    RAISE EXCEPTION 'Required table %.assistant_document_chunks does not exist', schema_name;
  END IF;

  ALTER TABLE assistant_documents
    ADD COLUMN IF NOT EXISTS archived_at timestamptz;

  -- Replace only CHECK constraints that govern the status column.
  FOR constraint_row IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = documents_table
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE %I.assistant_documents DROP CONSTRAINT %I',
                   schema_name, constraint_row.conname);
  END LOOP;

  ALTER TABLE assistant_documents
    ADD CONSTRAINT assistant_documents_status_check
    CHECK (status IN ('processing', 'ready', 'failed', 'archived'));
END
$archive$;

COMMENT ON COLUMN assistant_documents.archived_at IS
'Timestamp when the document was archived. Archived documents and chunks are retained but excluded from RAG retrieval.';

COMMIT;

-- Read-only verification after applying this migration.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'assistant_documents'
  AND column_name = 'archived_at';

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('assistant_documents')
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%status%';
