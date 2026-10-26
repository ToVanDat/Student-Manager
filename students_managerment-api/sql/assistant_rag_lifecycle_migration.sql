-- Non-destructive lifecycle extension for the admin-managed RAG knowledge base.
-- Manual prerequisite: inspect the target database and verify the base RAG schema.
-- This migration archives documents; it does not delete document rows or chunks.
BEGIN;

DO $archive$
DECLARE
  schema_name text := current_schema();
  documents_table regclass;
  chunks_table regclass;
  status_attnum smallint;
  constraint_row record;
BEGIN
  documents_table := to_regclass(format('%I.%I', schema_name, 'assistant_documents'));
  chunks_table := to_regclass(format('%I.%I', schema_name, 'assistant_document_chunks'));
  IF documents_table IS NULL OR chunks_table IS NULL THEN
    RAISE EXCEPTION 'Required assistant RAG tables are missing in schema %', schema_name;
  END IF;

  SELECT attnum INTO status_attnum
    FROM pg_attribute
   WHERE attrelid = documents_table
     AND attname = 'status'
     AND attnum > 0
     AND NOT attisdropped;
  IF status_attnum IS NULL THEN
    RAISE EXCEPTION 'Required column %.assistant_documents.status is missing', schema_name;
  END IF;

  EXECUTE format('ALTER TABLE %I.assistant_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz', schema_name);

  -- Drop only CHECK constraints whose sole constrained column is status.
  -- This avoids accidentally removing unrelated multi-column business rules.
  FOR constraint_row IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = documents_table
       AND contype = 'c'
       AND conkey = ARRAY[status_attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE %I.assistant_documents DROP CONSTRAINT %I',
                   schema_name, constraint_row.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = documents_table
       AND conname = 'assistant_documents_status_check'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.assistant_documents ADD CONSTRAINT assistant_documents_status_check CHECK (status IN (''processing'', ''ready'', ''failed'', ''archived''))',
      schema_name
    );
  END IF;
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
  AND contype = 'c';
