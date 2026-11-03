-- READ-ONLY academic timetable/scheduling schema inventory.
-- Safe for the target PostgreSQL database: metadata SELECTs only.
-- Does not assume a timetable schema, create objects, inspect student PII,
-- or modify any rows. Use the result to design a migration only after review.

-- 1) Database identity and current schema.
SELECT current_database() AS database_name,
       current_schema() AS current_schema,
       current_setting('search_path') AS search_path,
       version() AS postgres_version;

-- 2) Discover existing academic/scheduling relations by name.
-- This is intentionally broad enough to find differently named legacy tables.
SELECT table_schema,
       table_name,
       table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
      table_name ILIKE '%timetable%'
      OR table_name ILIKE '%schedule%'
      OR table_name ILIKE '%class_session%'
      OR table_name ILIKE '%course_session%'
      OR table_name ILIKE '%teaching%'
      OR table_name ILIKE '%room%'
      OR table_name ILIKE '%enrollment%'
      OR table_name ILIKE '%semester%'
      OR table_name ILIKE '%subject%'
      OR table_name ILIKE '%class%'
  )
ORDER BY table_schema, table_name;

-- 3) Inspect columns for the discovered relations.
-- Includes data types/nullability only; no application data is returned.
SELECT c.table_schema,
       c.table_name,
       c.ordinal_position,
       c.column_name,
       c.data_type,
       c.udt_name,
       c.is_nullable,
       c.column_default
FROM information_schema.columns c
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
      c.table_name ILIKE '%timetable%'
      OR c.table_name ILIKE '%schedule%'
      OR c.table_name ILIKE '%class_session%'
      OR c.table_name ILIKE '%course_session%'
      OR c.table_name ILIKE '%teaching%'
      OR c.table_name ILIKE '%room%'
      OR c.table_name ILIKE '%enrollment%'
      OR c.table_name ILIKE '%semester%'
      OR c.table_name ILIKE '%subject%'
      OR c.table_name ILIKE '%class%'
  )
ORDER BY c.table_schema, c.table_name, c.ordinal_position;

-- 4) Inspect primary, unique, foreign-key and check constraints for those relations.
SELECT tc.table_schema,
       tc.table_name,
       tc.constraint_name,
       tc.constraint_type,
       kcu.column_name,
       ccu.table_schema AS referenced_schema,
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
WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
      tc.table_name ILIKE '%timetable%'
      OR tc.table_name ILIKE '%schedule%'
      OR tc.table_name ILIKE '%class_session%'
      OR tc.table_name ILIKE '%course_session%'
      OR tc.table_name ILIKE '%teaching%'
      OR tc.table_name ILIKE '%room%'
      OR tc.table_name ILIKE '%enrollment%'
      OR tc.table_name ILIKE '%semester%'
      OR tc.table_name ILIKE '%subject%'
      OR tc.table_name ILIKE '%class%'
  )
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type,
         tc.constraint_name, kcu.ordinal_position;

-- 5) Inspect indexes and uniqueness guarantees.
SELECT schemaname AS table_schema,
       tablename AS table_name,
       indexname AS index_name,
       indexdef AS index_definition
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND (
      tablename ILIKE '%timetable%'
      OR tablename ILIKE '%schedule%'
      OR tablename ILIKE '%class_session%'
      OR tablename ILIKE '%course_session%'
      OR tablename ILIKE '%teaching%'
      OR tablename ILIKE '%room%'
      OR tablename ILIKE '%enrollment%'
      OR tablename ILIKE '%semester%'
      OR tablename ILIKE '%subject%'
      OR tablename ILIKE '%class%'
  )
ORDER BY schemaname, tablename, indexname;

-- 6) Inspect existing application routes/services/repositories separately
-- in source control. This SQL report cannot prove that an API endpoint exists.
-- A timetable implementation should not be declared complete until both:
--   (a) a real, reviewed scheduling schema exists, and
--   (b) authenticated APIs enforce the correct student/class/semester scope.
