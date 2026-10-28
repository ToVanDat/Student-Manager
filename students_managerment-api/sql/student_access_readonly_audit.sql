-- READ-ONLY Phase 1 audit: verified account/student mapping, RBAC and row-level access.
-- This file contains SELECT statements only. It does not apply migrations or modify data.
-- Run against the intended database/schema after confirming its identity.
-- Run section 1 first. If required tables are missing, stop and inspect migration state;
-- do not run migrations merely to make the remaining queries execute.

-- 1) Database identity and required object presence.
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_schema() AS current_schema,
       current_setting('search_path') AS search_path,
       to_regclass('users') AS users_table,
       to_regclass('students') AS students_table,
       to_regclass('student_account_links') AS account_links_table,
       to_regclass('student_account_link_audit') AS account_link_audit_table,
       to_regclass('permissions') AS permissions_table,
       to_regclass('role_permissions') AS role_permissions_table;

-- 2) Link table columns, constraints, indexes and FK delete behavior.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('student_account_links', 'student_account_link_audit')
ORDER BY table_name, ordinal_position;

SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column, rc.delete_rule, rc.update_rule
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
  AND tc.table_name IN ('student_account_links', 'student_account_link_audit')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN ('student_account_links', 'student_account_link_audit')
ORDER BY tablename, indexname;

-- 3) Mapping integrity. Counts only; no names, emails or student identifiers are returned.
SELECT COUNT(*)::bigint AS total_links,
       COUNT(*) FILTER (WHERE verified_at IS NULL)::bigint AS unverified_links,
       COUNT(*) FILTER (WHERE verified_at > CURRENT_TIMESTAMP)::bigint AS future_verified_timestamps
FROM student_account_links;

SELECT
  COUNT(*) FILTER (WHERE u.id IS NULL)::bigint AS links_without_user,
  COUNT(*) FILTER (WHERE s.id IS NULL)::bigint AS links_without_student,
  COUNT(*) FILTER (WHERE u.role <> 'user')::bigint AS links_to_non_student_role,
  COUNT(*) FILTER (WHERE u.is_active IS DISTINCT FROM TRUE)::bigint AS links_to_inactive_users
FROM student_account_links sal
LEFT JOIN users u ON u.id = sal.user_id
LEFT JOIN students s ON s.id = sal.student_id;

SELECT COUNT(*)::bigint AS users_with_multiple_links
FROM (
  SELECT user_id FROM student_account_links GROUP BY user_id HAVING COUNT(*) > 1
) duplicates;

SELECT COUNT(*)::bigint AS students_with_multiple_links
FROM (
  SELECT student_id FROM student_account_links GROUP BY student_id HAVING COUNT(*) > 1
) duplicates;

-- 4) Audit-log integrity and append-only trigger presence.
SELECT action, COUNT(*)::bigint AS event_count,
       MIN(occurred_at) AS first_event_at, MAX(occurred_at) AS last_event_at
FROM student_account_link_audit
GROUP BY action
ORDER BY action;

SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE trigger_schema = current_schema()
  AND event_object_table = 'student_account_link_audit'
ORDER BY trigger_name, event_manipulation;

-- 5) RBAC coverage. Missing role_permissions rows are effectively denied by middleware.
SELECT p.permission_key,
       p.is_sensitive,
       COALESCE(MAX(rp.allowed) FILTER (WHERE rp.role = 'admin'), FALSE) AS admin_allowed,
       COALESCE(MAX(rp.allowed) FILTER (WHERE rp.role = 'user'), FALSE) AS user_allowed,
       COUNT(rp.permission_key) FILTER (WHERE rp.role = 'admin') AS admin_row_count,
       COUNT(rp.permission_key) FILTER (WHERE rp.role = 'user') AS user_row_count
FROM permissions p
LEFT JOIN role_permissions rp ON rp.permission_key = p.permission_key
GROUP BY p.permission_key, p.is_sensitive
ORDER BY p.is_sensitive DESC, p.permission_key;

SELECT role, COUNT(*) FILTER (WHERE allowed)::bigint AS allowed_count,
       COUNT(*) FILTER (WHERE NOT allowed)::bigint AS denied_count,
       COUNT(*)::bigint AS configured_count
FROM role_permissions
GROUP BY role
ORDER BY role;

SELECT COUNT(*)::bigint AS active_admins,
       COUNT(*) FILTER (WHERE u.is_active)::bigint AS active_admins_with_permission
FROM users u
LEFT JOIN role_permissions rp
  ON rp.role = u.role
 AND rp.permission_key = 'permissions.manage'
 AND rp.allowed = TRUE
WHERE u.role = 'admin';

-- 6) Row-level security and effective table grants for sensitive academic tables.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema()
  AND c.relkind = 'r'
  AND c.relname IN ('students', 'enrollments', 'student_account_links');

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = current_schema()
  AND table_name IN ('students', 'enrollments', 'student_account_links', 'student_account_link_audit')
ORDER BY table_name, grantee, privilege_type;

-- 7) Related academic schema constraints (read-only metadata).
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
  AND tc.table_name IN ('students', 'classes', 'enrollments', 'subjects', 'semesters')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
