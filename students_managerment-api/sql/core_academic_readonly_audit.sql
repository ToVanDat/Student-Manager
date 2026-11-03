-- Student Manager: Core Academic schema readiness audit.
-- READ-ONLY ONLY. Safe for the target PostgreSQL database after verifying section 1.
-- This script does not create/alter/drop objects, install extensions, or read student PII.
-- Run in DBeaver using the intended database and schema. Save/export result grids for review.

-- 1) Confirm database identity before interpreting any other result.
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_schema() AS current_schema,
       current_setting('search_path') AS search_path,
       version() AS postgres_version;

-- 2) Core academic and timetable readiness matrix.
-- Timetable names are candidate conventions; PRESENT does not prove the table is correct.
WITH expected(table_name, feature, requirement) AS (
    VALUES
      ('students', 'student_records', 'required'),
      ('classes', 'class_catalog', 'required'),
      ('departments', 'department_catalog', 'required'),
      ('subjects', 'subject_catalog', 'required'),
      ('semesters', 'semester_catalog', 'required'),
      ('enrollments', 'enrollment_and_grades', 'required'),
      ('student_account_links', 'verified_student_identity', 'required_for_student_portal'),
      ('rooms', 'timetable', 'candidate'),
      ('class_schedules', 'timetable', 'candidate'),
      ('timetable', 'timetable', 'candidate'),
      ('timetables', 'timetable', 'candidate'),
      ('schedule_sessions', 'timetable', 'candidate'),
      ('schedule_change_logs', 'timetable_history', 'candidate'),
      ('lecturers', 'timetable', 'candidate')
)
SELECT e.feature, e.requirement, e.table_name,
       to_regclass(format('%I.%I', current_schema(), e.table_name))::text AS resolved_relation,
       CASE WHEN to_regclass(format('%I.%I', current_schema(), e.table_name)) IS NULL
            THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM expected e
ORDER BY e.feature, e.table_name;

-- 3) Discover any existing tables/views with timetable-like names, including
-- names outside the candidate list above. This is metadata only.
SELECT n.nspname AS schema_name, c.relname AS object_name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned_table'
            WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view'
            WHEN 'f' THEN 'foreign_table' ELSE c.relkind::text END AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema()
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND (c.relname ILIKE '%timetable%' OR c.relname ILIKE '%schedule%'
       OR c.relname ILIKE '%room%' OR c.relname ILIKE '%lecturer%')
ORDER BY c.relname;

-- 4) Academic table columns, types, nullability and defaults.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN (
      'students', 'classes', 'departments', 'subjects', 'semesters',
      'enrollments', 'student_account_links', 'rooms', 'class_schedules',
      'timetable', 'timetables', 'schedule_sessions', 'schedule_change_logs',
      'lecturers'
  )
ORDER BY table_name, ordinal_position;

-- 5) PK, UNIQUE, CHECK and FK definitions plus FK delete/update behavior.
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column,
       rc.update_rule, rc.delete_rule, chk.check_clause
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
  AND tc.table_name IN (
      'students', 'classes', 'departments', 'subjects', 'semesters',
      'enrollments', 'student_account_links', 'rooms', 'class_schedules',
      'timetable', 'timetables', 'schedule_sessions', 'schedule_change_logs',
      'lecturers'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 6) Index inventory for academic/timetable objects.
SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN (
      'students', 'classes', 'departments', 'subjects', 'semesters',
      'enrollments', 'student_account_links', 'rooms', 'class_schedules',
      'timetable', 'timetables', 'schedule_sessions', 'schedule_change_logs',
      'lecturers'
  )
ORDER BY tablename, indexname;

-- 7) Enrollment data-quality counts only. No student names, codes, emails or grades are emitted.
DO $academic_quality$
DECLARE
    rel regclass := to_regclass(format('%I.%I', current_schema(), 'enrollments'));
    total_rows bigint;
    missing_student bigint := NULL;
    missing_subject bigint := NULL;
    missing_semester bigint := NULL;
    invalid_midterm bigint := NULL;
    invalid_final bigint := NULL;
    invalid_total bigint := NULL;
    cols text[];
BEGIN
    IF rel IS NULL THEN
        RAISE NOTICE 'enrollments: MISSING; data-quality checks skipped';
        RETURN;
    END IF;

    SELECT array_agg(column_name)
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'enrollments';

    EXECUTE format('SELECT COUNT(*) FROM %s', rel) INTO total_rows;
    IF 'student_id' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE student_id IS NULL', rel) INTO missing_student;
    END IF;
    IF 'subject_id' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE subject_id IS NULL', rel) INTO missing_subject;
    END IF;
    IF 'semester_id' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE semester_id IS NULL', rel) INTO missing_semester;
    END IF;
    IF 'midterm_score' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE midterm_score IS NOT NULL AND (midterm_score < 0 OR midterm_score > 10)', rel) INTO invalid_midterm;
    END IF;
    IF 'final_score' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE final_score IS NOT NULL AND (final_score < 0 OR final_score > 10)', rel) INTO invalid_final;
    END IF;
    IF 'total_score' = ANY(cols) THEN
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE total_score IS NOT NULL AND (total_score < 0 OR total_score > 10)', rel) INTO invalid_total;
    END IF;

    RAISE NOTICE 'enrollments rows=%; missing student_id=%; missing subject_id=%; missing semester_id=%; invalid midterm=%; invalid final=%; invalid total=%',
        total_rows, missing_student, missing_subject, missing_semester,
        invalid_midterm, invalid_final, invalid_total;
END
$academic_quality$;

-- 8) Duplicate enrollment groups by student/subject/semester, when those columns exist.
DO $academic_duplicates$
DECLARE
    rel regclass := to_regclass(format('%I.%I', current_schema(), 'enrollments'));
    has_keys boolean;
    duplicate_groups bigint;
BEGIN
    IF rel IS NULL THEN
        RAISE NOTICE 'enrollments duplicate check: table MISSING';
        RETURN;
    END IF;

    SELECT COUNT(*) = 3 INTO has_keys
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'enrollments'
      AND column_name IN ('student_id', 'subject_id', 'semester_id');

    IF NOT has_keys THEN
        RAISE NOTICE 'enrollments duplicate check skipped: required key columns are incomplete';
        RETURN;
    END IF;

    EXECUTE format(
        'SELECT COUNT(*) FROM (
             SELECT student_id, subject_id, semester_id
             FROM %s
             GROUP BY student_id, subject_id, semester_id
             HAVING COUNT(*) > 1
         ) duplicate_groups', rel
    ) INTO duplicate_groups;
    RAISE NOTICE 'enrollments duplicate student/subject/semester groups=%', duplicate_groups;
END
$academic_duplicates$;

-- 9) Migration bookkeeping is informational. The repository's migration policy
-- is manual-reviewed-only; absence of a ledger is not proof migrations were not applied.
SELECT to_regclass(format('%I.%I', current_schema(), 'schema_migrations'))::text
           AS schema_migrations_ledger,
       to_regclass(format('%I.%I', current_schema(), 'knex_migrations'))::text
           AS knex_migrations_ledger;
