# Database Migration Audit

**Repository:** `ToVanDat/Student-Manager`  
**Branch:** `feature/chat-1to1-complete`  
**Assessment date:** 2026-10-26  
**Scope:** Tracked SQL scripts only. No live database was connected, inspected or modified.

## 1. Executive findings

- The API has a collection of manually maintained SQL scripts under `students_managerment-api/sql`; no single ordered migration manifest or migration ledger/runner was identified in that folder.
- The inspected folder contains overlapping legacy group/presence scripts: `group_presence.sql` and `group_chat_presence.sql`. They both add columns and constraints around users, conversations and conversation_members. They are not interchangeable: `group_chat_presence.sql` additionally normalizes direct-conversation roles and backfills owner/member roles for existing active group members.
- Ten inspected legacy scripts do not include an explicit `BEGIN`/`COMMIT` wrapper. This does not prove that they are unsafe in every execution environment, but a failure during manual execution may leave earlier statements committed when the SQL client runs in autocommit mode.
- Newer migrations such as RAG, E2EE foundation, role permissions, account-link schema and shared chat theme use explicit transactions and preflight/verification logic to varying degrees.
- No backup/restore drill or verified restore procedure is evidenced by this SQL folder.

## 2. Migration inventory observations

| Script | Explicit transaction | Notable behavior / review note |
|---|---:|---|
| `advanced_auth_features_migration.sql` | Yes | Creates passkey, Google-link and QR-login tables. Requires users/sessions schema. |
| `assistant_rag_schema_migration.sql` | Yes | Requires pgvector already installed; creates RAG document/chunk tables. |
| `assistant_rag_lifecycle_migration.sql` | Yes | Adds archive state; inspect current status checks before applying. |
| `e2ee_attachment_objects_migration.sql` | Yes | Creates ciphertext object metadata and indexes. |
| `e2ee_attachment_retry_identity_migration.sql` | Yes, now added | Atomic additive DDL; preflight and read-only verification included. |
| `e2ee_foundation_migration.sql` | Yes | Creates E2EE device/key/envelope foundations. |
| `role_permissions_migration.sql` | Yes | Seeds role permissions with conflict-safe inserts. |
| `student_account_link_schema_migration.sql` | Yes | Creates a verified one-to-one account/student link; does not auto-link by email. |
| `shared_conversation_chat_theme_migration.sql` | Yes | Includes a data backfill; review its preview/selection rule before applying. |
| `theme_preferences_migration.sql` | Yes | Adds/repairs preference constraints and columns. |
| `call_features.sql` | No | Creates call-history tables/indexes. |
| `chat_features.sql` | No | Alters messages and adds indexes/constraints. |
| `chat_safety_features.sql` | No | Creates block/report tables and indexes. |
| `conversation_management.sql` | No | Creates conversation settings/moderation structures. |
| `e2ee_pause_mode_migration.sql` | No | Adds E2EE pause-state columns, checks and index. |
| `group_chat_presence.sql` | No | Alters group/presence schema and backfills member roles. |
| `group_presence.sql` | No | Older overlapping group/presence schema script. |
| `notifications_center.sql` | No | Creates persistent notification structures. |
| `profile_notifications_push.sql` | No | Alters user profile fields and creates notification/push tables. |
| `user_preferences.sql` | No | Creates account-level preference table. |

This inventory is a repository-level review, not proof that any script is pending or already applied in the user's PostgreSQL database.

## 3. Changes made in this audit

The retry-identity migration for E2EE attachment metadata was updated to:

- execute all DDL in one explicit transaction;
- fail early when `e2ee_attachment_objects` is not resolvable in the current search path;
- run read-only verification queries for the added columns, indexes and digest constraints after commit.

Commit: `030af3dac5fbe0933d569836adc264ae10cef1c6`.

No migration was executed against a live database. No rows or existing tables were deleted or rewritten by this repository change.

## 4. Required migration operating procedure

Before applying any migration to a real database:

1. Confirm the exact host, port, database name, current user and schema. Do not rely only on a saved DBeaver connection label.
2. Confirm the migration prerequisites and inspect existing tables, columns, constraints, indexes and row counts using read-only queries.
3. Take a database backup and verify that the backup artifact is readable. For high-risk changes, restore it to an isolated database first.
4. Review the complete SQL, including implicit data backfills and every `ON DELETE` action. Identify lock-heavy statements and expected duration.
5. Apply one migration at a time during a controlled window. Capture the exact script version/commit, operator, database identity, start/end time and result.
6. Run the script's post-migration verification queries and compare expected object definitions and row counts.
7. If a script is not transactional, do not assume a failed run rolled back. Inspect the database state before retrying; do not blindly rerun it.
8. Record the applied migration in an operator-maintained ledger until a formal migration runner is introduced.

## 5. Next data-integrity work

- Reconcile the two group/presence scripts into one documented canonical path only after comparing their current application dependencies and target schema state.
- Add a migration manifest with stable IDs, prerequisites, checksums, expected lock profile, verification SQL and rollback/forward-fix notes.
- Review the ten non-transactional scripts individually. Add transaction boundaries only after assessing data volume, lock duration, client execution behavior and whether any statement is intentionally staged.
- Define automated backup retention and perform a restore drill in an isolated environment; store evidence of RPO/RTO and integrity reconciliation.
- Do not enable student self-service academic records or chatbot grade lookups until the verified account-link flow and row-level authorization have been implemented and tested.

## 6. Safety boundary

This audit did not connect to PostgreSQL, apply SQL, create a backup, restore data, delete records or change any production/local database. Production readiness remains unverified until the operating procedure and restore exercise have been demonstrated.
