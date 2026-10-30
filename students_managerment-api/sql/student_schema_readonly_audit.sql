-- READ-ONLY audit for the existing student/class schema.
-- Safe to run against the target database: contains SELECT statements only.
-- Do not use this output as permission to apply a migration automatically.

-- 1) Actual columns, data types, nullability and defaults.
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
  AND table_name IN ('students', 'classes')
ORDER BY table_name, ordinal_position;

-- 2) Primary-key, unique, check and foreign-key constraints, including delete/update rules.
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.update_rule,
    rc.delete_rule,
    chk.check_clause
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
LEFT JOIN information_schema.check_constraints chk
    ON chk.constraint_catalog = tc.constraint_catalog
   AND chk.constraint_schema = tc.constraint_schema
   AND chk.constraint_name = tc.constraint_name
WHERE tc.table_schema = current_schema()
  AND tc.table_name IN ('students', 'classes')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 3) Index definitions, including unique indexes that may enforce student_code/email uniqueness.
SELECT
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN ('students', 'classes')
ORDER BY tablename, indexname;

-- 4) Existing data quality checks; counts only, no student personal data returned.
SELECT
    COUNT(*) AS total_students,
    COUNT(*) FILTER (WHERE student_code IS NULL OR BTRIM(student_code) = '') AS missing_student_code,
    COUNT(*) FILTER (WHERE email IS NULL OR BTRIM(email) = '') AS missing_email,
    COUNT(*) FILTER (WHERE class_id IS NULL) AS missing_class_id,
    COUNT(*) FILTER (WHERE class_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM classes c WHERE c.id = students.class_id
    )) AS orphan_class_references
FROM students;

-- 5) Duplicate candidate checks. Counts only: no student codes or email values are returned.
SELECT
    field,
    COUNT(*)::int AS duplicate_group_count,
    SUM(duplicate_count)::bigint AS rows_in_duplicate_groups,
    MAX(duplicate_count)::bigint AS largest_duplicate_group
FROM (
    SELECT 'student_code' AS field, COUNT(*) AS duplicate_count
    FROM students
    WHERE student_code IS NOT NULL AND BTRIM(student_code) <> ''
    GROUP BY student_code
    HAVING COUNT(*) > 1
    UNION ALL
    SELECT 'email' AS field, COUNT(*) AS duplicate_count
    FROM students
    WHERE email IS NOT NULL AND BTRIM(email) <> ''
    GROUP BY LOWER(BTRIM(email))
    HAVING COUNT(*) > 1
) duplicate_groups
GROUP BY field
ORDER BY field;


-- 6) Inspect account/student/enrollment columns without returning personal values.
-- This is needed before deciding whether an authenticated user can be mapped to one student.
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
  AND table_name IN ('users', 'students', 'enrollments')
ORDER BY table_name, ordinal_position;

-- 7) Inspect all foreign keys among users, students and enrollments.
-- An email match is not an authorization relationship; only a verified FK or
-- separately reviewed account-linking workflow can authorize personal records.
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_catalog = tc.constraint_catalog
 AND kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_catalog = tc.constraint_catalog
 AND ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_catalog = tc.constraint_catalog
 AND rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = current_schema()
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('users', 'students', 'enrollments')
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 8) Candidate email overlap count only. This does NOT prove identity and
-- must never be used by the chatbot as an implicit account-to-student link.
SELECT COUNT(*)::int AS matching_email_candidate_count
FROM users u
JOIN students s
  ON LOWER(BTRIM(u.email)) = LOWER(BTRIM(s.email))
WHERE u.email IS NOT NULL
  AND BTRIM(u.email) <> ''
  AND s.email IS NOT NULL
  AND BTRIM(s.email) <> '';


-- 9) Inspect optional authentication and assistant-RAG tables before considering migrations.
-- Metadata only; this does not read credential material, token hashes, or document contents.
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
  AND table_name IN (
      'user_webauthn_credentials',
      'user_oauth_accounts',
      'qr_login_requests',
      'assistant_documents',
      'assistant_document_chunks',
      'student_account_links',
      'sessions',
      'refresh_tokens'
  )
ORDER BY table_name, ordinal_position;

-- 10) Confirm optional schema objects and pgvector availability.
SELECT
    'user_webauthn_credentials' AS object_name,
    to_regclass(format('%I.%I', current_schema(), 'user_webauthn_credentials'))::text AS relation_name
UNION ALL
SELECT
    'user_oauth_accounts',
    to_regclass(format('%I.%I', current_schema(), 'user_oauth_accounts'))::text
UNION ALL
SELECT
    'qr_login_requests',
    to_regclass(format('%I.%I', current_schema(), 'qr_login_requests'))::text
UNION ALL
SELECT
    'assistant_documents',
    to_regclass(format('%I.%I', current_schema(), 'assistant_documents'))::text
UNION ALL
SELECT
    'assistant_document_chunks',
    to_regclass(format('%I.%I', current_schema(), 'assistant_document_chunks'))::text
UNION ALL
SELECT
    'student_account_links',
    to_regclass(format('%I.%I', current_schema(), 'student_account_links'))::text
UNION ALL
SELECT
    'pgvector extension',
    (SELECT extname || ' ' || extversion FROM pg_extension WHERE extname = 'vector');


-- 11) Enrollment schema, constraints and indexes.
-- Confirms whether duplicate prevention and score boundaries are enforced by PostgreSQL.
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
  AND table_name IN ('enrollments', 'subjects', 'semesters')
ORDER BY table_name, ordinal_position;

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule,
    chk.check_clause
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
LEFT JOIN information_schema.check_constraints chk
  ON chk.constraint_catalog = tc.constraint_catalog
 AND chk.constraint_schema = tc.constraint_schema
 AND chk.constraint_name = tc.constraint_name
WHERE tc.table_schema = current_schema()
  AND tc.table_name = 'enrollments'
ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

SELECT
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'enrollments'
ORDER BY indexname;

-- 12) Guarded enrollment data-quality counts. Emits NOTICE counts only and
-- does not fail when an optional score column is absent.
DO $audit_enrollment_quality$
DECLARE
    enrollment_table regclass := to_regclass(format('%I.%I', current_schema(), 'enrollments'));
    total_rows bigint;
    missing_student bigint;
    missing_subject bigint;
    missing_semester bigint;
    invalid_midterm bigint := 0;
    invalid_final bigint := 0;
    invalid_total bigint := 0;
    has_student boolean;
    has_subject boolean;
    has_semester boolean;
    has_midterm boolean;
    has_final boolean;
    has_total boolean;
BEGIN
    IF enrollment_table IS NULL THEN
        RAISE NOTICE 'enrollments table is MISSING';
        RETURN;
    END IF;
    SELECT
        BOOL_OR(column_name = 'student_id'),
        BOOL_OR(column_name = 'subject_id'),
        BOOL_OR(column_name = 'semester_id'),
        BOOL_OR(column_name = 'midterm_score'),
        BOOL_OR(column_name = 'final_score'),
        BOOL_OR(column_name = 'total_score')
    INTO has_student, has_subject, has_semester, has_midterm, has_final, has_total
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'enrollments';

    EXECUTE format('SELECT COUNT(*) FROM %s', enrollment_table) INTO total_rows;
    IF has_student THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE student_id IS NULL', enrollment_table) INTO missing_student;
    END IF;
    IF has_subject THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE subject_id IS NULL', enrollment_table) INTO missing_subject;
    END IF;
    IF has_semester THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE semester_id IS NULL', enrollment_table) INTO missing_semester;
    END IF;
    IF has_midterm THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE midterm_score IS NOT NULL AND (midterm_score < 0 OR midterm_score > 10)', enrollment_table) INTO invalid_midterm;
    END IF;
    IF has_final THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE final_score IS NOT NULL AND (final_score < 0 OR final_score > 10)', enrollment_table) INTO invalid_final;
    END IF;
    IF has_total THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE total_score IS NOT NULL AND (total_score < 0 OR total_score > 10)', enrollment_table) INTO invalid_total;
    END IF;
    RAISE NOTICE 'enrollments rows=%; missing student_id=%; missing subject_id=%; missing semester_id=%; invalid midterm_score=%; invalid final_score=%; invalid total_score=%',
        total_rows, missing_student, missing_subject, missing_semester, invalid_midterm, invalid_final, invalid_total;
END
$audit_enrollment_quality$;

-- 13) Duplicate enrollment candidates by (student_id, subject_id, semester_id).
-- A non-zero count must be investigated before adding a UNIQUE constraint.
SELECT
    COUNT(*)::int AS duplicate_group_count,
    COALESCE(SUM(group_size), 0)::bigint AS rows_in_duplicate_groups,
    COALESCE(MAX(group_size), 0)::bigint AS largest_duplicate_group
FROM (
    SELECT COUNT(*) AS group_size
    FROM enrollments
    GROUP BY student_id, subject_id, semester_id
    HAVING COUNT(*) > 1
) duplicate_groups;

-- 14) Guarded verification of verified link rows and orphan references.
-- This block is safe when optional columns/tables are absent. It reports counts
-- only; it does not return student identifiers, grades, emails, or other PII.
DO $audit$
DECLARE
    schema_name text := current_schema();
    links regclass := to_regclass(format('%I.%I', current_schema(), 'student_account_links'));
    enrollments regclass := to_regclass(format('%I.%I', current_schema(), 'enrollments'));
    users_table regclass := to_regclass(format('%I.%I', current_schema(), 'users'));
    students_table regclass := to_regclass(format('%I.%I', current_schema(), 'students'));
    link_count bigint;
    unverified_count bigint;
    orphan_user_count bigint;
    orphan_student_count bigint;
    enrollment_count bigint;
    orphan_enrollment_student bigint;
    orphan_enrollment_subject bigint;
    orphan_enrollment_semester bigint;
    duplicate_enrollment_groups bigint;
    score_columns text[] := ARRAY[]::text[];
    score_expr text;
BEGIN
    IF links IS NULL THEN
        RAISE NOTICE 'student_account_links: MISSING';
    ELSE
        EXECUTE format('SELECT COUNT(*) FROM %s', links) INTO link_count;
        RAISE NOTICE 'student_account_links: rows=%', link_count;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'student_account_links'
              AND column_name = 'verified_at'
        ) THEN
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE verified_at IS NULL', links)
                INTO unverified_count;
            RAISE NOTICE 'student_account_links: rows_without_verified_at=%', unverified_count;
        ELSE
            RAISE NOTICE 'student_account_links: verified_at column MISSING';
        END IF;

        IF users_table IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'student_account_links'
              AND column_name = 'user_id'
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM %s l WHERE NOT EXISTS (SELECT 1 FROM %s u WHERE u.id = l.user_id)',
                links, users_table
            ) INTO orphan_user_count;
            RAISE NOTICE 'student_account_links: orphan_user_refs=%', orphan_user_count;
        END IF;

        IF students_table IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'student_account_links'
              AND column_name = 'student_id'
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM %s l WHERE NOT EXISTS (SELECT 1 FROM %s s WHERE s.id = l.student_id)',
                links, students_table
            ) INTO orphan_student_count;
            RAISE NOTICE 'student_account_links: orphan_student_refs=%', orphan_student_count;
        END IF;
    END IF;

    IF enrollments IS NULL THEN
        RAISE NOTICE 'enrollments: MISSING';
    ELSE
        EXECUTE format('SELECT COUNT(*) FROM %s', enrollments) INTO enrollment_count;
        RAISE NOTICE 'enrollments: rows=%', enrollment_count;

        IF students_table IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'enrollments' AND column_name = 'student_id'
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM %s e WHERE e.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s s WHERE s.id = e.student_id)',
                enrollments, students_table
            ) INTO orphan_enrollment_student;
            RAISE NOTICE 'enrollments: orphan_student_refs=%', orphan_enrollment_student;
        END IF;

        IF to_regclass(format('%I.%I', schema_name, 'subjects')) IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'enrollments' AND column_name = 'subject_id'
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM %s e WHERE e.subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I.subjects s WHERE s.id = e.subject_id)',
                enrollments, schema_name
            ) INTO orphan_enrollment_subject;
            RAISE NOTICE 'enrollments: orphan_subject_refs=%', orphan_enrollment_subject;
        END IF;

        IF to_regclass(format('%I.%I', schema_name, 'semesters')) IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'enrollments' AND column_name = 'semester_id'
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM %s e WHERE e.semester_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I.semesters sm WHERE sm.id = e.semester_id)',
                enrollments, schema_name
            ) INTO orphan_enrollment_semester;
            RAISE NOTICE 'enrollments: orphan_semester_refs=%', orphan_enrollment_semester;
        END IF;

        SELECT array_agg(column_name ORDER BY column_name)
          INTO score_columns
          FROM information_schema.columns
         WHERE table_schema = schema_name
           AND table_name = 'enrollments'
           AND column_name IN ('midterm_score', 'final_score', 'total_score');

        IF COALESCE(array_length(score_columns, 1), 0) = 0 THEN
            RAISE NOTICE 'enrollments: no known score columns found';
        ELSE
            RAISE NOTICE 'enrollments: score_columns=%', score_columns;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'enrollments'
              AND column_name IN ('student_id', 'subject_id', 'semester_id')
            GROUP BY table_schema, table_name
            HAVING COUNT(DISTINCT column_name) = 3
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM (SELECT student_id, subject_id, semester_id FROM %s GROUP BY student_id, subject_id, semester_id HAVING COUNT(*) > 1) d',
                enrollments
            ) INTO duplicate_enrollment_groups;
            RAISE NOTICE 'enrollments: duplicate_student_subject_semester_groups=%', duplicate_enrollment_groups;
        END IF;
    END IF;
END
$audit$;
