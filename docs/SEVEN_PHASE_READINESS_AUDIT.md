# Seven-phase security and production-readiness audit

**Repository:** `ToVanDat/Student-Manager`  
**Audit branch:** `feature/progressive-password-cooldown` (read-only source inspection)  
**Working branch for follow-up changes:** `fix/password-cooldown-ip-guard`  
**Assessment date:** 2026-10-28

## Scope and evidence boundary

This is a repository/static audit of tracked source, SQL migrations, tests, Docker and deployment examples. No connection to the user's local or production PostgreSQL/Redis, filesystem, Docker daemon, Nginx process, Ollama instance, R2 bucket, browser, or camera was available in this execution. Therefore actual database schema/data, live network behavior, model accuracy, and deployment health are **not verified**. No SQL migration or database mutation was performed.

## Executive status

| Phase | Static source finding | Status |
|---|---|---|
| 1. PostgreSQL, migrations, account mapping, RBAC, IDOR | Verified-link flow and own-portal query exist; migration/runtime state and full IDOR coverage remain unverified | Blocked on read-only DB output + adversarial integration |
| 2. Authentication and sessions | AT/RT, Google, Passkey, QR and session revoke implementations exist; complete cross-channel regression and live revoke propagation not established | Partial |
| 3. Academic management | Student CRUD, subjects, semesters, enrollments and grades exist; no timetable/schedule domain surfaced in tracked API paths | Incomplete |
| 4. Chat and E2EE | Direct-message E2EE foundation, device credentials, provisioning and ciphertext attachments exist; docs explicitly retain browser acceptance/recovery gaps and primary-device revocation constraints | Partial; not production-ready |
| 5. Chatbot and RAG | Global assistant, catalog context, Redis session history, Ollama and optional pgvector RAG exist; no personal student records are passed to LLM pending verified ownership mapping | Partial; personal context correctly gated |
| 6. Face Login | Server-side pipeline and encrypted templates exist, but pipeline is fail-closed; PAD output contract/parity and threshold calibration are unresolved | Disabled / not releasable |
| 7. DevOps and production readiness | Compose health checks, loopback port bindings and Nginx example exist; no live HTTPS, outage, backup/restore, deployment or rollback evidence | Not verified |

## Phase 1 — PostgreSQL, migrations, mapping, RBAC and IDOR

### Positive controls found
- `student_schema_readonly_audit.sql` is read-only and inspects table metadata, constraints, indexes, data-quality counts, duplicate candidates, foreign keys, optional auth/RAG tables and pgvector availability.
- Account-to-student access is not inferred from email. `GET /api/students/me` derives the account ID from authenticated `req.user.id`; repository lookup joins `student_account_links` and filters by that user ID and non-null `verified_at`.
- Mapping table uses one-to-one constraints (user primary key, student unique key); the admin workflow locks the user and student rows and checks account role/status before inserting.
- Student roster/export/import and direct student-ID routes are admin-only and have explicit role and permission middleware.
- Enrollment/grade endpoints are admin-only; chatbot currently excludes individual student PII, grades and enrollment rows.
- Permission middleware queries the database on each protected request and denies when a grant is absent. Auth middleware reloads the current user and role instead of trusting the JWT role claim.

### Risks and evidence gaps
- The actual target database has not been queried. We cannot say which migrations ran, whether constraints match repository SQL, whether links exist, or whether any orphan/duplicate data exists.
- Migration scripts are manually managed; the repository audit found no canonical ordered migration manifest/ledger. Some legacy scripts are non-transactional and overlapping group/presence scripts need reconciliation.
- Base account-link migration initially uses `ON DELETE CASCADE`; the separate admin-workflow migration changes those FKs to `RESTRICT`. The actual DB must be checked to confirm the latter migration is applied. Applying the base migration blindly is unsafe because it intentionally errors if the table already exists.
- Static account-link flow is promising but needs live PostgreSQL concurrency tests for two admins linking the same user/student, unlink races, delete restrictions and append-only audit triggers.
- IDOR testing must include changed student IDs, enrollment IDs, conversation IDs, file IDs, account-link IDs and cross-session access. Existing route guards are not a substitute for these adversarial tests.
- `permissionService.replaceRolePermissions` writes only submitted entries (upsert behavior); verify that the UI sends the complete intended permission set and that omitted keys cannot create confusing stale grants. The name "replace" should not be assumed to mean deletion of omitted grants.
- Check database roles/ownership: append-only triggers do not protect against a database owner/superuser deliberately altering or disabling them.

### Required next actions
1. Run `students_managerment-api/sql/student_schema_readonly_audit.sql` on the intended database in DBeaver and retain all result grids.
2. Run the new account-link/RBAC read-only audit script added with this report.
3. Compare actual migration state and constraints to the exact migration files; do not apply anything until discrepancies are reviewed.
4. Add/run PostgreSQL integration tests for ownership, one-to-one constraints, concurrency, unlink and IDOR cases.

## Phase 2 — Authentication and sessions

### Positive controls found
- Access token verification checks HS256, issuer, audience, Redis token presence, session ownership/revocation and current active user state.
- Refresh tokens are stored as hashes and associated with sessions in PostgreSQL.
- Advanced auth implements Google identity verification/linking, WebAuthn registration/authentication and QR approval/polling with short-lived challenge/request state.
- Session revoke persists the database revocation, revokes refresh tokens, best-effort clears indexed access-token keys and emits a Socket.IO revocation event.
- Login session creation compensates for partial PostgreSQL/Redis token issuance failures.

### Risks and evidence gaps
- A complete automated matrix covering password, refresh rotation/replay, logout, revoke-one/revoke-others, Google link/unlink, Passkey registration/login, QR approve/deny/expiry/replay, Redis outage and Socket.IO disconnect/re-auth was not evidenced as one end-to-end suite.
- Redis access-token cleanup and Socket.IO notification are best-effort. PostgreSQL session revocation remains the authorization source of truth, but stale sockets must be proven to disconnect or fail subsequent authorized actions.
- Advanced-auth migrations are manual; actual presence of `user_webauthn_credentials`, `user_oauth_accounts`, and `qr_login_requests` is unknown.
- The prior cooldown work has CI tests queued; its results must be checked before considering Phase 2 complete.

## Phase 3 — Academic management

### Positive controls found
- Student CRUD/import/export, classes, departments, subjects, semesters and enrollments/grades have API layers and permission checks.
- Enrollment validation and admin-only grade routes exist.

### Gaps
- No timetable/schedule API, repository or migration was found in the tracked paths searched. Do not assume the timetable feature is implemented.
- Student self-service enrollment and grade history is currently unavailable by design until verified mapping and row-level authorization are established.
- Need business rules for add/drop windows, capacity, prerequisites, schedule conflicts, duplicate enrollment, grade changes/audit and semester lifecycle.
- Need Student/Admin matrix tests for every list/detail/create/update/delete/export endpoint and for attempts to access another student's IDs.

## Phase 4 — Chat and E2EE

### Positive controls found
- Repository includes E2EE device authentication, provisioning sessions, envelopes/mailbox, device identity commitments and R2 ciphertext attachment flow.
- Reviewed service paths enforce conversation membership and device ownership for envelope delivery and attachment access; pause mode blocks new reservations while preserving historical ciphertext and already-pending uploads.
- E2EE docs state direct text chat is the validated slice and provide a separate browser acceptance checklist.

### Gaps
- Browser multi-profile/device linking, reconnect, delivery convergence, group lifecycle, rollback/recovery and stolen-token replay need real browser acceptance tests.
- Reviewed E2EE audit notes that SDK removal of device slot 1 is rejected; primary-device revocation needs an explicit recovery-safe product path.
- Local decrypted history is encrypted under a browser-local key; losing that key makes local history unreadable and server-side recovery is not provided.
- No claim of end-to-end group E2EE readiness should be made from direct-message tests alone.
- R2 live ticket/upload/download/delete and ciphertext-only storage require staging verification.

## Phase 5 — Chatbot and RAG

### Positive controls found
- Global assistant uses authenticated API; conversation history is scoped by user and session in Redis.
- Catalog queries are parameterized; admin gets aggregate counts only.
- RAG schema readiness checks pgvector and document/chunk tables; embedding dimension is validated; retrieval filters visibility and archived documents.
- Context is explicitly treated as untrusted and prompt-injection instructions in retrieved data are not to be followed. Model output is not executed as SQL or application commands.
- Ollama remote URLs require HTTPS; generation/embedding have timeouts, disconnect propagation and process-local request gates.

### Gaps
- Personal grades, schedule and student profile lookups are deliberately not implemented until verified mapping and row-level authorization pass Phase 1.
- RAG currently has a documented TXT-only ingestion slice; PDF/DOCX/OCR, re-indexing, ANN/vector indexes and production ingestion operations are not complete.
- Chatbot request and Ollama gates are process-local; multiple replicas would multiply effective concurrency/rate limits unless a distributed gate is added.
- Need hostile-document/prompt-injection tests, cross-user/session history tests, Redis/Ollama outage tests, SSE mid-stream failure/disconnect tests and per-role retrieval tests.
- Actual pgvector extension and RAG tables are unknown until database audit results are supplied.

## Phase 6 — Face Login

### Positive controls found
- Face login has server-side inference, hash-pinned ONNX artifacts, encrypted face templates, one-time challenges and multi-frame liveness checks.
- Pipeline configuration requires explicit enable and validation flags and calibrated PAD, consistency and identity thresholds.
- Current code intentionally fails closed while the PAD model output contract is unverified.

### Release blockers
- MiniFASNet ONNX/PyTorch output parity and class semantics are unresolved; the API intentionally blocks PAD inference until parity passes.
- MiniFASNet preprocessing still needs pixel-for-pixel parity against the upstream OpenCV reference.
- No representative consented dataset evidence for FAR/FRR, ROC/EER, demographic/environmental variation, camera quality, print/replay/video injection and threshold selection was provided.
- Challenge replay, timing, frame sequence and concurrent verification need integration tests against Redis and the real inference service.
- Keep feature flags disabled until all model licensing, parity, calibration, operational and privacy gates are evidenced.

## Phase 7 — DevOps and production readiness

### Positive controls found
- Compose waits for PostgreSQL and Redis health before backend startup and exposes backend/PostgreSQL/Redis host ports on loopback.
- Backend health check targets `/health/ready`.
- Nginx example overwrites forwarded client IP with `$remote_addr` and documents one trusted proxy hop and backend isolation assumptions.

### Risks and gaps
- Nginx example is not installed automatically; no live TLS certificate, firewall, proxy chain or WebSocket verification is available.
- Dockerfile comment says no API package lock is tracked, but `students_managerment-api/package-lock.json` exists. Dockerfile currently uses `npm install --omit=dev`, not deterministic `npm ci`; this is a confirmed documentation/build reproducibility discrepancy.
- Dockerfile uses `node:22-alpine` with native ONNX Runtime dependency; verify native module compatibility in the actual container image before production. CI currently tests on Ubuntu, not this Alpine image.
- No verified backup artifact, isolated restore drill, RPO/RTO, monitoring/alerting evidence, deployment rehearsal or rollback exercise was found.
- Redis/PostgreSQL/Ollama/R2 dependency outage behavior must be tested at runtime, including startup readiness and recovery.

## Recommended execution order

1. **Gate 1:** collect read-only PostgreSQL output and confirm schema/migration state.
2. **Gate 2:** add/run ownership, RBAC and IDOR integration tests; do not expose personal student data to chatbot before passing.
3. **Gate 3:** run auth/session regression matrix and inspect CI results.
4. **Gate 4:** define timetable requirements and complete academic workflow before enabling student self-service grades.
5. **Gate 5:** complete E2EE browser acceptance and recovery policy.
6. **Gate 6:** harden RAG and run adversarial prompt/SSE/outage tests.
7. **Gate 7:** keep Face Login disabled until parity and accuracy gates pass; then complete production deployment/restore/rollback drills.

**No production-ready declaration is supported by the current evidence.**
