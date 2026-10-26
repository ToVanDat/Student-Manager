-- Student Manager: verified account-to-student link table
-- Target branch: feature/chat-1to1-complete
--
-- PURPOSE
--   Create a dedicated, one-to-one mapping between an authenticated users.id
--   and a students.id. This avoids guessing that matching email addresses mean
--   the records belong to the same person.
--
-- SAFETY
--   * This script creates schema only. It does not insert, update, or delete
--     users/students and does not auto-link accounts by email.
--   * Run only after reviewing the output of student_schema_readonly_audit.sql.
--   * Run against the intended database/schema in DBeaver or VS Code SQL tools.
--   * It intentionally fails if users.id or students.id cannot be found, or if
--     their referenced keys are not suitable for PostgreSQL foreign keys.
--   * No student personal data is copied into this mapping table.
--
-- IMPORTANT NEXT STEP
--   This table alone does NOT enable chatbot access. A trusted account-linking
--   flow must verify the student's identity, then insert one mapping row with
--   verified_at set by the backend. Never accept user_id/student_id as
--   authoritative values from the browser or the LLM. Do not use email matching
--   as proof of identity.
--
-- EXPECTED RESULT
--   student_account_links:
--     user_id      PRIMARY KEY (one student link per account)
--     student_id   UNIQUE (one account per student)
--     verified_at  NOT NULL (only verified links are represented)
--
-- Execute as one script. The transaction is rolled back on any error.

BEGIN;

DO $migration$
DECLARE
    target_schema text := current_schema();
    users_id_type text;
    students_id_type text;
    users_table regclass;
    students_table regclass;
BEGIN
    users_table := to_regclass(format('%I.%I', target_schema, 'users'));
    students_table := to_regclass(format('%I.%I', target_schema, 'students'));

    IF users_table IS NULL THEN
        RAISE EXCEPTION 'Required table %.users does not exist in current schema', target_schema;
    END IF;

    IF students_table IS NULL THEN
        RAISE EXCEPTION 'Required table %.students does not exist in current schema', target_schema;
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO users_id_type
      FROM pg_attribute a
     WHERE a.attrelid = users_table
       AND a.attname = 'id'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO students_id_type
      FROM pg_attribute a
     WHERE a.attrelid = students_table
       AND a.attname = 'id'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF users_id_type IS NULL OR students_id_type IS NULL THEN
        RAISE EXCEPTION 'Both users.id and students.id must exist before creating the link table';
    END IF;

    IF to_regclass(format('%I.%I', target_schema, 'student_account_links')) IS NOT NULL THEN
        RAISE EXCEPTION '%.student_account_links already exists; inspect it before applying this migration',
            target_schema;
    END IF;

    EXECUTE format(
        'CREATE TABLE %I.student_account_links (
            user_id %s NOT NULL,
            student_id %s NOT NULL,
            verified_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT student_account_links_pkey PRIMARY KEY (user_id),
            CONSTRAINT student_account_links_student_id_key UNIQUE (student_id),
            CONSTRAINT student_account_links_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES %I.users(id) ON DELETE CASCADE,
            CONSTRAINT student_account_links_student_id_fkey
                FOREIGN KEY (student_id) REFERENCES %I.students(id) ON DELETE CASCADE
        )',
        target_schema,
        users_id_type,
        students_id_type,
        target_schema,
        target_schema
    );
END
$migration$;

COMMENT ON TABLE student_account_links IS
'Verified one-to-one mapping from an authenticated user to a student record. Never populate using email matching alone.';

COMMENT ON COLUMN student_account_links.verified_at IS
'Timestamp set by the trusted backend only after the account-linking identity verification flow succeeds.';

COMMIT;

-- READ-ONLY verification: expected one row describing the new table's columns.
SELECT
    table_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'student_account_links'
ORDER BY ordinal_position;

-- READ-ONLY verification: expected two foreign keys and one unique constraint
-- in addition to the primary key.
SELECT
    tc.constraint_type,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
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
  AND tc.table_name = 'student_account_links'
ORDER BY tc.constraint_type, tc.constraint_name;
