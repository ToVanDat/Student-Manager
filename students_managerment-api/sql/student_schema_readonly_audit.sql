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

-- 5) Duplicate candidate checks. These are reports only; they do not delete or alter data.
SELECT 'student_code' AS field, student_code AS duplicate_value, COUNT(*) AS duplicate_count
FROM students
WHERE student_code IS NOT NULL AND BTRIM(student_code) <> ''
GROUP BY student_code
HAVING COUNT(*) > 1
UNION ALL
SELECT 'email' AS field, LOWER(BTRIM(email)) AS duplicate_value, COUNT(*) AS duplicate_count
FROM students
WHERE email IS NOT NULL AND BTRIM(email) <> ''
GROUP BY LOWER(BTRIM(email))
HAVING COUNT(*) > 1
ORDER BY field, duplicate_count DESC;


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
