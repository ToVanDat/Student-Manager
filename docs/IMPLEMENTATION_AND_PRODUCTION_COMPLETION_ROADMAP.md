# Student Manager — implementation and production completion roadmap

Updated: 2026-11-03

## Operating rules

- Work from `feature/chat-1to1-complete`; use focused feature branches and pull requests.
- Audit before changing an existing database. Back up and verify a restore before any production schema migration.
- Never run migrations automatically in application startup or alphabetically.
- Do not fabricate timetable, enrollment, grade, RAG, or Face Login data to make a screen appear complete.
- Keep production feature flags disabled until the relevant operational and security gates pass.
- A green CI job proves only the checks it actually ran; it does not prove the live PostgreSQL database, Redis, model files, DNS, TLS, TURN relay, or VPS are healthy.

## Verified repository baseline

Repository inspection on 2026-11-03 found:

- Core Academic API files exist: `repository/academicRepository.js`, `service/academicService.js`, `controller/academicController.js`, and `router/academicRouter.js`. The inspected repository tree did not show a complete timetable module with its own repository, service, controller, route, and migration.
- RAG base and lifecycle migrations exist: `sql/assistant_rag_schema_migration.sql` and `sql/assistant_rag_lifecycle_migration.sql`. The base migration requires pgvector to be installed and enabled before it runs; it uses `vector(768)`.
- `sql/migration-catalog.json` declares manual reviewed execution, no automatic execution, and audit/approval requirements for existing databases.
- A read-only Core Academic audit exists at `sql/core_academic_readonly_audit.sql`.
- Face Login code and model verification scripts exist, but `docs/face-capture-pipeline.md` explicitly keeps enrollment/login fail-closed until model, PAD, thresholds, frame consistency, and runtime are validated.
- Repository CI results observed for commit `52c29ec085e9b48515b3752773c7c7594024aeda`: PostgreSQL backup/restore smoke, Chat schema hardening smoke, RAG migration smoke, and API tests passed; Quality checks were still in progress at the time checked. These are CI results, not live-database certification.

## Workstream 0 — repository and CI baseline

1. Finish reviewing PR #64 (read-only Core Academic audit).
2. Wait for all required CI checks; resolve failures rather than bypassing them.
3. Keep the audit PR separate from feature implementation.
4. After merging is explicitly approved, rebase feature branches from the agreed base and run the full relevant test suite.

Exit criteria:
- Required CI checks green.
- Audit SQL reviewed as read-only.
- No production database or VPS changes performed by CI.

## Workstream 1 — PostgreSQL and migration governance

1. Run `sql/core_academic_readonly_audit.sql` on the actual `Student_Management` database.
2. Run `sql/pgvector_rag_readonly_preflight.sql` on the same intended database.
3. Export result grids and record database name, PostgreSQL version, current schema/search_path, installed/available extensions, relevant table definitions, constraints, indexes, role privileges, and migration ledger.
4. Take a consistent backup and perform a restore test to an isolated database before any production migration.
5. Build an explicit migration execution plan with prerequisites, exact order, rollback/forward-repair plan, lock/downtime expectations, and post-migration verification queries.
6. Apply one reviewed migration at a time with an operator present. Do not use an automatic migration runner on the existing database.

Exit criteria:
- Database identity and schema are confirmed.
- Backup and isolated restore are verified.
- Each migration has a reviewed precondition and postcondition.
- No unexpected data rewrite or destructive operation.

## Workstream 2 — pgvector and RAG

Current schema contract: `assistant_documents`, `assistant_document_chunks`, and `vector(768)`; the RAG base migration checks for the `vector` extension and the `users.id` type.

Decision:
- Do not replace the current Windows PostgreSQL installation or repoint its data directory directly at a new Docker container.
- For a safe local proof of concept, prefer a separate, isolated PostgreSQL 18 pgvector container using a pinned image tag, a new named volume, a non-conflicting host port, and a separate test database. Restore a verified backup into it only after confirming compatibility.
- If the existing Windows PostgreSQL 18.6 instance must remain the active database, evaluate installing the matching pgvector build into that exact server installation; this requires the correct PostgreSQL 18 build tools and must be tested separately.
- Never mount an existing PostgreSQL data directory into an image with a different major version or incompatible PGDATA layout. Never assume that changing the Docker image preserves data.

Implementation sequence:
1. Confirm PostgreSQL major version and backup/restore path.
2. Provision pgvector in an isolated environment.
3. Verify `pg_available_extensions`, then enable `CREATE EXTENSION vector` only in the intended database with operator approval.
4. Apply the base RAG migration; inspect schema and indexes.
5. Apply lifecycle migration only after base-schema verification.
6. Run API readiness and isolated integration tests.
7. Add document upload validation, MIME/size limits, extraction safety, content hashing, chunking, embedding model/version metadata, retries, deletion/archive lifecycle, audit logging, and role-scoped retrieval.
8. Verify that student retrieval cannot access admin-only content and that LLM output cannot execute arbitrary SQL.

Exit criteria:
- Live database reports the expected extension and tables.
- RAG ingestion and retrieval pass against a non-production database.
- Role isolation and prompt-injection defenses are tested.
- No document is marked ready until extraction and embedding complete.

## Workstream 3 — Core Academic and timetable

Do not design the timetable schema from guesses. First use the real audit output to map existing classes, subjects, semesters, lecturers, rooms, and any schedule-like objects.

Then:
1. Produce an ERD and data dictionary from confirmed existing schema.
2. Decide whether the institution schedules by class cohort, subject offering/section, or both.
3. Design schedule sessions with confirmed foreign keys, weekday/date rules, start/end times, room, lecturer, class/section, semester, and status.
4. Add overlap prevention for room, lecturer, and cohort/section. Prefer database constraints/exclusion constraints where supported by the final model; otherwise use transaction-safe conflict checks and tests.
5. Add a change-history/audit table if timetable changes must be traceable.
6. Implement migration, repository, service, controller, router, permission checks, and API tests.
7. Implement student timetable read APIs using the verified student-account link; admin CRUD APIs must require explicit permissions.
8. Build responsive weekly timetable UI, empty/loading/error states, current-week navigation, timezone handling, and accessible mobile layout.

Exit criteria:
- No timetable collision can be committed under concurrent requests.
- Students can only read their own verified timetable.
- Admin writes are permission-checked and audited.
- UI displays only persisted, real schedule data.

## Workstream 4 — enrollment, grades, GPA

1. Use audit counts to establish whether enrollment data exists and whether duplicates/orphans/out-of-range scores exist.
2. Generate a remediation report with stable row identifiers and proposed actions; do not auto-delete or merge duplicates.
3. Confirm score scale, weighting rules, retake policy, grade mapping, and GPA scale with the actual business rules.
4. Add constraints only after existing data conforms or an approved remediation is completed.
5. Implement transactional enrollment/grade workflows, duplicate prevention, authorization, audit trail, and concurrency tests.
6. Implement student grades, transcript, semester GPA, cumulative GPA, and empty states only after formulas are confirmed.

Exit criteria:
- Every grade/GPA value is traceable to approved rules and source rows.
- Admin changes are auditable.
- Student data isolation and duplicate prevention tests pass.

## Workstream 5 — Authentication, authorization, chat and E2EE

1. Run authorization/IDOR tests across every student-scoped endpoint, including academic, chatbot, files, and chat.
2. Verify access-token expiry, refresh rotation, session revocation, cookie flags, CSRF protections where applicable, CORS, rate limits, and progressive cooldown behavior.
3. Test Socket.IO authentication and session revocation during active connections.
4. Test E2EE device enrollment, prekey lifecycle, message envelope integrity, attachment lifecycle, recovery, and multi-device behavior.
5. Add abuse controls, observability, and privacy-safe logs.

Exit criteria:
- No cross-student IDOR path.
- Revoked sessions cannot continue API or socket access.
- E2EE failure modes and recovery are documented and tested.

## Workstream 6 — Face Login (separate release gate)

Do not enable Face Login merely because model files exist or smoke tests pass.

Required gates:
- Hash-verified model artifacts and reproducible runtime.
- Pixel-level preprocessing parity for MobileFaceNet.
- PAD and liveness evaluation against print, replay, mask, camera injection, lighting, and device variation.
- Calibrated thresholds using consented, representative evaluation data; report FMR/FNMR and APCER/BPCER/ACER with methodology.
- Security review of challenge binding, replay protection, rate limits, template encryption/key rotation, deletion, consent, and fallback authentication.
- Independent password/passkey fallback remains available.
- Feature flags remain disabled until all gates are signed off.

## Workstream 7 — Frontend quality and UX

Audit each route against actual API behavior:
- Authentication and recovery.
- Student profile, grades, timetable, and settings.
- Admin CRUD and data validation.
- Chat, calls, E2EE, notifications, and chatbot.
- Responsive mobile and desktop layouts.

For each screen, verify:
- Loading, empty, error, retry, success, and permission-denied states.
- Form validation and duplicate-submit prevention.
- Keyboard navigation, focus management, labels, contrast, and responsive behavior.
- No hard-coded sample data in production paths.
- API errors are understandable without leaking stack traces or sensitive data.

## Workstream 8 — VPS and production

Before deployment, re-audit the live VPS. Previously recorded VPS capacity was approximately 1 vCPU, 1 GiB RAM plus 1 GiB swap, and 11 GiB disk; reconfirm before planning colocated PostgreSQL, Redis, backend, and TURN services.

1. Confirm DNS A/AAAA records for app, API, and TURN endpoints.
2. Confirm firewall/security-group rules and SSH key access; rotate temporary credentials.
3. Confirm Nginx virtual hosts, HTTPS certificates, renewal timer, security headers, and reverse-proxy limits.
4. Confirm backend Node runtime, systemd service, environment file permissions, health/readiness endpoints, logs, and restart policy.
5. Confirm frontend production build and immutable asset serving; frontend need not run as a development server on the VPS.
6. Confirm PostgreSQL location, network restrictions, TLS, backup schedule, restore test, and connection pool limits.
7. Confirm Redis persistence/availability expectations and access restrictions.
8. Confirm Coturn TLS, UDP/TCP relay ports, REST shared-secret credentials, and an external ICE relay test.
9. Run smoke tests, load checks appropriate to the small VPS, rollback rehearsal, and post-deploy monitoring.

Important capacity gate:
- Do not assume the recorded 1 GiB VPS can safely host PostgreSQL, Redis, Node API, Nginx, and Coturn together. Measure memory/disk and either upgrade the VPS or keep the database on a separately managed host with secured connectivity.

Exit criteria:
- DNS/TLS, API, frontend, DB, Redis, and TURN are independently verified.
- Backups restore successfully.
- Monitoring and rollback are available.
- No production migration or deploy occurs without explicit approval.

## Immediate next actions

1. Finish PR #64 CI and review.
2. Run the two read-only SQL audits in DBeaver on `Student_Management` and export results.
3. In parallel, run local frontend/backend test suites and report exact failures; do not infer test success from repository presence.
4. Choose the isolated pgvector proof-of-concept environment after confirming PostgreSQL version and backup size.
5. Use the audit outputs to implement timetable and enrollment changes in focused PRs.
