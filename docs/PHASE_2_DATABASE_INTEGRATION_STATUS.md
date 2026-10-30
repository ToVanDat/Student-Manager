# Phase 2 — Database & Integration Verification

**Repository:** `ToVanDat/Student-Manager`  
**Branch:** `fix/password-cooldown-ip-guard`  
**Baseline commit:** `bc4a2db630fc103a32fbc0b130c891be663e1352`  
**Audit scope:** tracked SQL, repository query contracts and CI-only database integration. No connection to the developer's local PostgreSQL instance was made.

## Current findings

1. The API currently keeps manually reviewed SQL scripts under `students_managerment-api/sql`. There is no single authoritative ordered migration runner/manifest or migration ledger in this repository. Do not infer applied/pending state from filenames.
2. The authentication schema prerequisites are represented in `advanced_auth_features_migration.sql`: `user_webauthn_credentials`, `user_oauth_accounts`, and `qr_login_requests`. These are not independent migrations; they share the prerequisite `users` and, for QR login, `sessions`.
3. Student-to-account mapping is split across `student_account_link_schema_migration.sql` and `student_account_link_admin_workflow_migration.sql`. The second script explicitly depends on the first. It must not be populated by email matching.
4. Document RAG requires `vector` to be installed by the database operator before `assistant_rag_schema_migration.sql`; the migration intentionally does not install extensions. The lifecycle migration depends on the RAG document table.
5. Face Login credential storage is represented by `face_login_credentials_migration.sql`; this schema alone does not validate model inference, PAD, liveness, thresholds or camera behavior.
6. E2EE schema is split across foundation and additive migrations. Preserve their order and inspect prerequisites such as `users`, `messages` and `conversations` before applying.
7. Legacy scripts `group_presence.sql` and `group_chat_presence.sql` overlap but are not interchangeable. Do not run both as an assumed sequence without comparing the target schema and their backfill effects.
8. The repository has read-only student and student-access audits. A new consolidated read-only audit is available at `students_managerment-api/sql/database_integration_readonly_audit.sql`; it reports database identity, core/feature table presence, key column presence, extensions, indexes, constraints and migration-ledger presence. It performs SELECTs only.

## Migration dependency map

| Feature | Script(s) | Prerequisite / caution |
|---|---|---|
| Advanced auth | `advanced_auth_features_migration.sql` | Existing `users`; QR request references `sessions` |
| RBAC | `role_permissions_migration.sql` | Existing `users`; grants are seeded conflict-safely |
| Student account mapping | `student_account_link_schema_migration.sql` then `student_account_link_admin_workflow_migration.sql` | Existing compatible `users.id` and `students.id`; review identity-verification and audit behavior |
| Document RAG | `assistant_rag_schema_migration.sql` then `assistant_rag_lifecycle_migration.sql` | Operator-installed `vector`; existing `users`; fixed 768-dimension embedding contract |
| Face credential storage | `face_login_credentials_migration.sql` | Existing `users`; key management and inference validation remain separate |
| E2EE foundation | `e2ee_foundation_migration.sql` then reviewed additive E2EE scripts | Existing `users`, `conversations`, `messages`; inspect each script's ALTER/DROP/constraint operations |
| E2EE attachment metadata | `e2ee_attachment_objects_migration.sql` then `e2ee_attachment_retry_identity_migration.sql` | Attachment-object table created by first script |
| Chat/presence legacy | `chat_features.sql`, `group_presence.sql`, `group_chat_presence.sql`, related scripts | Overlap and non-transactional scripts require manual target-state review |

This is a dependency guide, not an automatic execution order for every database. The database's existing state must be inspected first.

## CI evidence and its limits

- API workflow at baseline commit completed successfully with 9/9 jobs, including PostgreSQL-backed RAG readiness, E2EE relay, student account-link migration, Face Login session guard, Redis Pub/Sub, frontend build and API smoke tests.
- RAG migration smoke uses an isolated PostgreSQL/pgvector service and verifies schema/lifecycle behavior.
- Backup/restore smoke uses an isolated PostgreSQL service and restores into a separate database.
- These checks validate repository migrations and test fixtures. They do not establish that the developer's local database has the same schema, extensions, data quality, privileges or migration history.

## Safe local audit procedure

1. In DBeaver, select the intended connection and verify host, port, database and role.
2. Open `students_managerment-api/sql/database_integration_readonly_audit.sql`.
3. Execute the entire file as read-only SQL. Save the result grids; do not run any migration based only on a `MISSING` row.
4. Compare results with `student_schema_readonly_audit.sql` and `student_access_readonly_audit.sql` for student mapping and RBAC.
5. For each missing object, inspect the full migration, prerequisites, existing data, constraints, indexes and delete rules. Take and verify a backup before any approved migration.
6. Apply one reviewed migration at a time only after explicit approval; then run its post-migration verification and record the commit/script checksum and database identity.

## Deferred items

- Introduce a formal migration ledger/runner only after the current manual SQL set has been normalized and ordered. Do not auto-run the current directory alphabetically.
- Reconcile legacy group/presence scripts only after their callers and existing target schema have been mapped.
- Confirm local extension availability and actual table/column state using the read-only audit output.
- No migration was applied to the user's local database; no tables or rows were changed by this audit.
