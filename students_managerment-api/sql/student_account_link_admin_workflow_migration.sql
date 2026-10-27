-- Additive migration for the administrator-managed, manually verified
-- account-to-student linking workflow. Does not modify student/account rows.
-- Prerequisite: student_account_link_schema_migration.sql has been reviewed
-- and applied to the intended database.
BEGIN;

DO $migration$
DECLARE
    target_schema text := current_schema();
    users_table regclass;
    links_table regclass;
    users_id_type text;
BEGIN
    users_table := to_regclass(format('%I.%I', target_schema, 'users'));
    links_table := to_regclass(format('%I.%I', target_schema, 'student_account_links'));
    IF users_table IS NULL OR links_table IS NULL THEN
        RAISE EXCEPTION 'Apply the base student_account_link_schema_migration.sql first';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO users_id_type
      FROM pg_attribute a
     WHERE a.attrelid = users_table AND a.attname = 'id'
       AND a.attnum > 0 AND NOT a.attisdropped;
    IF users_id_type IS NULL THEN
        RAISE EXCEPTION 'users.id is required';
    END IF;

    EXECUTE format('ALTER TABLE %I.student_account_links ADD COLUMN IF NOT EXISTS verified_by %s', target_schema, users_id_type);
    EXECUTE format('ALTER TABLE %I.student_account_links ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT ''admin_manual_review''', target_schema);
    EXECUTE format('ALTER TABLE %I.student_account_links ADD COLUMN IF NOT EXISTS verification_note varchar(500)', target_schema);

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'student_account_links_verified_by_fkey'
           AND conrelid = links_table
    ) THEN
        EXECUTE format(
            'ALTER TABLE %I.student_account_links
             ADD CONSTRAINT student_account_links_verified_by_fkey
             FOREIGN KEY (verified_by) REFERENCES %I.users(id) ON DELETE SET NULL',
            target_schema, target_schema
        );
    END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS student_account_link_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('linked', 'unlinked')),
    user_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    verification_method TEXT NOT NULL,
    note VARCHAR(500),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS student_account_link_audit_occurred_at_idx
    ON student_account_link_audit (occurred_at DESC);
CREATE INDEX IF NOT EXISTS student_account_link_audit_user_id_idx
    ON student_account_link_audit (user_id, occurred_at DESC);

INSERT INTO permissions (permission_key, module_key, label_vi, label_en, description_vi, description_en, is_sensitive)
VALUES (
    'students.link_accounts', 'students',
    'Liên kết tài khoản với hồ sơ sinh viên', 'Link accounts to student records',
    'Xác minh danh tính và liên kết một tài khoản user với một hồ sơ sinh viên.',
    'Verify identity and link one user account to one student record.',
    TRUE
)
ON CONFLICT (permission_key) DO UPDATE SET
    module_key = EXCLUDED.module_key,
    label_vi = EXCLUDED.label_vi,
    label_en = EXCLUDED.label_en,
    description_vi = EXCLUDED.description_vi,
    description_en = EXCLUDED.description_en,
    is_sensitive = TRUE;

INSERT INTO role_permissions (role, permission_key, allowed)
VALUES ('admin', 'students.link_accounts', TRUE), ('user', 'students.link_accounts', FALSE)
ON CONFLICT (role, permission_key) DO UPDATE
SET allowed = EXCLUDED.allowed, updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- Audit rows are append-only through the application API: there is intentionally
-- no user-facing endpoint to edit or delete them.
