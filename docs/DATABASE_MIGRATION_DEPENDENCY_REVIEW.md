# Database migration dependency review

This document complements `PHASE_2_DATABASE_INTEGRATION_STATUS.md`. It is a review guide, not an executable migration runner.

## Rules

- Never apply scripts alphabetically or run every SQL file in one batch.
- Confirm the target database, schema, current columns, constraints and existing rows first.
- A script containing `DROP CONSTRAINT`, `UPDATE`, `DELETE`, trigger replacement or data backfill needs a target-state review even when it is described as additive.
- `CREATE TABLE IF NOT EXISTS` does not prove that an existing table has the expected columns or constraints.
- Scripts that use `public.*` are explicitly tied to the public schema; the read-only audit must be run with the same schema/search path as the application.
- Use an isolated disposable database for migration smoke tests. Do not test migrations on the user's live/local data.

## Reviewed dependency groups

| Group | Script | Prerequisites / sequencing | Review note |
|---|---|---|---|
| RBAC | `role_permissions_migration.sql` | Existing `users` because the permission metadata supports `updated_by` references | Must precede `student_account_link_admin_workflow_migration.sql`; inspect role names used by the running API before seeding |
| Advanced authentication | `advanced_auth_features_migration.sql` | Existing `users` and `sessions` | Creates WebAuthn, OAuth and QR-login storage. Do not infer Google/Passkey/QR readiness merely from table presence |
| Student mapping | `student_account_link_schema_migration.sql` | Existing compatible `users.id` and `students.id` | Base mapping creates cascading FKs; the workflow migration deliberately replaces them with RESTRICT |
| Student mapping workflow | `student_account_link_admin_workflow_migration.sql` | Base mapping plus `permissions` and `role_permissions` from RBAC migration | Alters constraints, adds audit trigger and upserts permission rows; review existing mappings and permissions first |
| RAG base | `assistant_rag_schema_migration.sql` | Existing `users.id`, operator-installed `vector` extension | Creates a fixed `vector(768)` contract; migration intentionally refuses pre-existing RAG tables |
| RAG lifecycle | `assistant_rag_lifecycle_migration.sql` | RAG base tables and expected status column/constraint | Adds archive/restore lifecycle; preserves chunks rather than deleting them |
| Face Login | `face_login_credentials_migration.sql` | Existing `users.id` | Storage only; does not validate ONNX model, PAD, liveness, thresholds or camera |
| E2EE foundation | `e2ee_foundation_migration.sql` | Existing `users`, `conversations`, `messages` | Creates multiple E2EE device, prekey, envelope and provisioning tables; inspect every referenced base key |
| E2EE attachment objects | `e2ee_attachment_objects_migration.sql` | Existing `conversations`, `users` | Creates attachment object metadata |
| E2EE attachment retry identity | `e2ee_attachment_retry_identity_migration.sql` | Attachment objects migration | Alters the attachment table; apply only after confirming the base table's actual shape |
| E2EE pause mode | `e2ee_pause_mode_migration.sql` | Existing `conversation_e2ee_settings` and `users` | Alters settings and adds an index; not a standalone migration |
| E2EE provisioning proof | `e2ee_provisioning_proof_v1_migration.sql` | Existing `e2ee_sdk_provisioning_sessions` | Alters provisioning sessions; requires the E2EE foundation |
| Account preferences | `user_preferences.sql` | Existing `users` | Creates account-level preferences |
| Theme preferences | `theme_preferences_migration.sql` | Existing `user_preferences` and `conversation_user_settings` | Alters checks and normalizes existing values; inspect data before applying |
| Shared chat theme | `shared_conversation_chat_theme_migration.sql` | Existing `public.conversations` and `public.user_preferences` | Uses public-qualified tables and ranks/normalizes preference rows; inspect existing duplicates and values |
| Push/profile preferences | `profile_notifications_push.sql` | Existing `users`, `conversations` | Creates preference and push-subscription tables |
| Notification center | `notifications_center.sql` | Existing `users`, `conversations`, `messages`; preference table may be altered | Apply after confirming `user_notification_preferences` exists and has the expected shape |
| Conversation management | `conversation_management.sql` | Existing `users`, `conversations` | Creates settings, blocked users and reports |
| Chat safety | `chat_safety_features.sql` | Existing `users`, `conversations` | Also creates blocked-users and reports tables; overlaps with conversation management |
| Chat features | `chat_features.sql` | Existing `messages` and `users` | Alters messages and reaction structures; includes data normalization/deduplication and index changes |
| Calls | `call_features.sql` | Existing `users`, `conversations` | Creates call history/notifications/hidden history and changes status/expiry shape |
| Group presence variant A | `group_presence.sql` | Existing `users`, `conversations`, `conversation_members` | Alters overlapping presence/group columns and creates active-membership indexes |
| Group presence variant B | `group_chat_presence.sql` | Existing `users`, `conversations`, `conversation_members` | Overlaps variant A but has different index names/definitions; do not blindly apply both |
| User notifications | `profile_notifications_push.sql` then `notifications_center.sql` | Preference table created before notification center's ALTER | Verify preference column names before the second script |

## Overlap and idempotency hazards

### 1. Group presence scripts

`group_presence.sql` and `group_chat_presence.sql` both alter `users`, `conversations`, and `conversation_members`, but create differently named indexes for overlapping access patterns. Their presence in the same directory does not establish a supported sequence. First compare the live columns and index definitions; then choose one canonical migration or create a reviewed consolidation migration.

### 2. Block/report tables

`conversation_management.sql` and `chat_safety_features.sql` both create `blocked_users` and `conversation_reports`. `IF NOT EXISTS` can hide a mismatch in an already-created table. Compare full column definitions, unique constraints, FK delete actions and index definitions before choosing either script as the canonical source.

### 3. Preference and notification ordering

`theme_preferences_migration.sql` alters both `user_preferences` and `conversation_user_settings`; `shared_conversation_chat_theme_migration.sql` also normalizes preference rows. `notifications_center.sql` alters notification preference schema created by `profile_notifications_push.sql`. A missing prerequisite must be reported, not silently skipped.

### 4. Student account link FK transition

The base account-link migration uses `ON DELETE CASCADE`; the workflow migration replaces those constraints with `ON DELETE RESTRICT` and adds append-only audit protection. The effective desired state is the workflow migration's RESTRICT behavior. If the base script is already applied, do not rerun it: it intentionally refuses an existing mapping table.

### 5. RAG and pgvector

The base RAG migration requires the extension to be available and installed by an operator. It uses 768-dimensional vectors. A database where `vector` is unavailable cannot safely enable document RAG; do not substitute another dimension or embedding model without a coordinated re-index plan.

## Recommended order for a fresh isolated schema only

This is a dependency-oriented smoke sequence, not approval to apply it to an existing database:

1. Create/verify the application's canonical base schema (`users`, `sessions`, `refresh_tokens`, `students`, `classes`, `conversations`, `conversation_members`, `messages`).
2. Apply `role_permissions_migration.sql`.
3. Apply `advanced_auth_features_migration.sql`.
4. Apply `student_account_link_schema_migration.sql`, then `student_account_link_admin_workflow_migration.sql`.
5. If RAG is being enabled, provision pgvector at the database/platform level, then apply RAG base followed by lifecycle.
6. Apply E2EE foundation, then only the relevant attachment, pause-mode and provisioning-proof follow-ups.
7. Apply Face Login credential storage only when the feature is being enabled.
8. Apply preferences before theme/notification migrations that alter them.
9. Resolve the chat/presence overlaps before selecting a canonical sequence for chat safety, group presence, calls and notifications.

## Required evidence before local migration

For every candidate migration, record:
- database name, host/port, schema and role;
- pre-migration table/column/constraint/index inventory;
- whether any existing rows violate the new constraints;
- backup archive path and successful `pg_restore --list` validation;
- exact SQL file commit SHA and checksum;
- post-migration verification output.

Do not execute any migration until the user has reviewed the audit results and approved the specific script(s).
