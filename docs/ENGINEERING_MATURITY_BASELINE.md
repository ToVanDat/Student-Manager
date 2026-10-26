# Engineering Maturity Baseline

**Repository:** `ToVanDat/Student-Manager`  
**Working branch:** `feature/chat-1to1-complete`  
**Baseline commit:** `6b99aa5bb220d99e800bc2c1a76a3dfee8ac21b7`  
**Assessment date:** 2026-10-26  
**Status:** Initial repository/CI baseline; not a production certification.

## 1. Executive assessment

| Dimension | Current assessment | Evidence / limitation |
|---|---|---|
| Technology breadth | Relatively high | React/Vite, Express, PostgreSQL, Redis, Socket.IO, Signal Protocol SDK, R2 Worker, Ollama/RAG, WebAuthn and browser computer-vision dependencies are present. |
| Architecture complexity | Relatively high | Authentication/session state, realtime messaging, E2EE device/key relay, encrypted attachment storage and AI/RAG span multiple services and persistence layers. |
| Feature completeness | Medium–high, uneven | Several flows have tests and CI coverage, but feature completeness must be assessed per user journey; a passing build does not prove UI/API/business-flow parity. |
| Production reliability | Not yet verified | CI is green, but live deployment, load, recovery, monitoring, backup-restore and security exercise evidence is not available from repository inspection alone. |

Do not convert these qualitative labels into numeric scores without a defined rubric and measured evidence.

## 2. Verified baseline

### 2.1 CI evidence

At baseline commit `6b99aa5`, the following GitHub Actions runs completed successfully on 2026-10-26:

- **API tests** — run `40284868169`: backend tests, frontend lint/build, E2EE relay live PostgreSQL integration and E2EE migration smoke jobs all succeeded.
- **Quality checks** — run `40284868167`: backend test suite and frontend lint/production build jobs succeeded.

These runs prove only the checks configured in those workflows. They do not prove production deployment, browser-level end-to-end journeys, performance under load, backup restoration or an external security assessment.

### 2.2 Existing engineering controls observed

- Express disables `x-powered-by`, applies a small set of security headers, uses an explicit credentialed CORS allowlist and validates configured reverse-proxy hop count.
- Authentication verifies JWT issuer/audience, checks the access-token revocation record in Redis, validates the session and loads current user/active/role state from the database.
- Sensitive auth routes use trusted-origin checks and rate limiting; chatbot document management is admin-only and chatbot requests are authenticated and rate-limited.
- E2EE device-sensitive endpoints use a separate device credential check.
- RAG TXT ingestion performs strict UTF-8/binary/size checks, schema preflight, duplicate detection and guarded archive/restore behavior.
- CI includes backend tests, frontend lint/build, Signal protocol round-trip tests, PostgreSQL integration and migration smoke tests.

## 3. Known gaps and risks visible in the repository

These are repository observations, not claims about unobserved local or hosted infrastructure.

### P0 — Release blockers to resolve before production

- **Database change control:** the RAG lifecycle migration is committed but is a manual migration. Verify target database identity, base schema, backup and rollback plan before applying it. No live database was inspected or changed during this baseline.
- **Secrets and deployment configuration:** production secret injection, rotation, access scope and recovery must be demonstrated in the deployment environment. Never commit real `.env` files or credentials.
- **Backup and restore:** no verified backup/restore drill evidence is available in this repository baseline.
- **Authorization/data isolation:** complete negative tests for every student/admin endpoint, especially object-level authorization and student-to-student data isolation.
- **E2EE production lifecycle:** verify registration, identity change, device revocation, provisioning, prekey depletion, message delivery/retry and recovery against real supported client flows. CI protocol tests alone are insufficient.
- **Face authentication:** do not enable as a production login factor until enrollment, template protection, liveness/PAD threat model, replay resistance, fallback and account recovery are tested.

### P1 — Reliability and maintainability

- The API Dockerfile uses `npm install --omit=dev` and explicitly notes that the API package lockfile is not tracked. Add a real generated lockfile before switching to `npm ci`; do not hand-edit lockfiles.
- Docker Compose has no explicit container health checks or dependency readiness conditions. `depends_on` alone does not prove PostgreSQL/Redis are ready to accept requests.
- The API server currently starts an HTTP server and has no explicit SIGTERM/SIGINT graceful-shutdown path in `src/server.js`.
- No dedicated liveness/readiness endpoints were observed in the inspected Express app.
- Operational monitoring, structured request correlation, alert thresholds and incident runbooks need evidence.
- Add browser-level E2E coverage for critical journeys; current CI has unit/integration tests and build/lint checks but no configured browser E2E job in the inspected workflows.

### P2 — Feature and UX consistency

- Maintain a feature matrix linking each visible UI control to its API route, authorization policy, persistence behavior, failure states and automated tests.
- Chatbot document ingestion currently supports strict UTF-8 TXT only. PDF/DOCX, OCR and re-indexing are not implemented.
- Chatbot conversation history/feedback and request/embedding concurrency have process/session-local limitations documented in the assistant guide. Revisit before running multiple API replicas.
- Validate loading, empty, permission-denied, offline, timeout, retry and destructive-action confirmation states across the core student/admin/chat flows.

## 4. Delivery plan and acceptance gates

### Phase A — Functional completeness

- Inventory every route and visible feature by role (admin/student).
- Trace UI → API → service → repository → database and realtime events.
- Record: implemented, partially implemented, UI-only, API-only, disabled and unverified.
- Add a test for each critical business rule and each authorization denial path.
- Acceptance: no critical visible action is UI-only; no route is exposed without an explicit auth/role/object-ownership policy; key flows pass browser E2E tests.

### Phase B — Security assurance

- Review AT/RT issuance, rotation, reuse detection, cookie flags, CSRF/trusted-origin behavior, logout scope and session revocation.
- Review role and object-level authorization for students, classes, enrollments, results, files, chat and assistant data.
- Threat-model E2EE device identity, safety-number change, device revoke, provisioning and encrypted attachment tickets.
- Threat-model face enrollment/login, liveness/PAD, template storage, replay, fallback and recovery before enabling the feature.
- Test prompt injection and retrieval authorization boundaries; never let model output execute SQL or privileged actions.
- Acceptance: documented threat model, automated negative tests, no unresolved critical/high security findings, and reviewed production configuration.

### Phase C — Data integrity and recovery

- Inventory migrations and map each to a target schema/database.
- Require preflight, transactionality, idempotency where appropriate, post-migration verification and a rollback/forward-fix plan.
- Add transaction tests for multi-row business operations and concurrency/uniqueness tests.
- Define backup retention, encryption, access control, RPO/RTO and run a restore drill into an isolated environment.
- Acceptance: migration evidence and a successful restore drill with reconciled row counts/integrity checks.

### Phase D — Test strategy

- Unit: pure validation, authorization policy, token/session lifecycle and service edge cases.
- Integration: PostgreSQL constraints/transactions, Redis expiry/rate-limit behavior, R2 ticket lifecycle and Ollama timeout/cancellation.
- E2E: registration/login/refresh/logout, admin CRUD, student read boundaries, chat, E2EE device lifecycle and assistant.
- Security: dependency audit, secret scanning, static analysis, authorization fuzz/negative cases and upload abuse cases.
- Performance: baseline p50/p95/p99 latency, throughput, concurrency, memory and recovery under dependency failure.
- Acceptance: CI gates block merges on required checks; test reports and thresholds are retained.

### Phase E — Operations and release readiness

- Add liveness/readiness checks and graceful shutdown.
- Add structured logs with request/correlation IDs; redact credentials, tokens, message plaintext and face templates.
- Add metrics and alerts for HTTP errors/latency, DB pool saturation, Redis health, Socket.IO connections, Ollama queue/timeouts and R2 failures.
- Pin runtime/dependency inputs with generated lockfiles; use reproducible container builds and non-root runtime where compatible.
- Define deployment, rollback, incident response and backup-restore runbooks.
- Acceptance: staging deployment, smoke test, dependency-failure exercise, rollback exercise and an owner-approved production checklist.

## 5. Working rules

1. Audit the current implementation before changing it.
2. Prefer small, reviewable changes with focused tests.
3. Never run a migration against an unidentified database or delete user data as part of cleanup.
4. Do not expose secrets or personal data in logs, test fixtures or AI prompts.
5. Do not claim a test, deployment, security review or restore drill passed unless its result is available.
6. Keep production readiness as **unverified** until the acceptance evidence above exists.

## 6. Immediate implementation progress

The first operational slice has been added to the working branch:

- `GET /health/live` returns a minimal process-liveness response.
- `GET /health/ready` checks PostgreSQL and Redis and returns HTTP 503 when either dependency is unavailable. Dependency error details are not exposed.
- Focused unit tests cover healthy, unavailable and error-redaction cases.
- Docker Compose now health-checks PostgreSQL, Redis and the API, and waits for database/cache health before starting the API.
- SIGTERM/SIGINT handling closes Socket.IO (including its Redis Pub/Sub subscriber), HTTP connections, Redis and PostgreSQL with a bounded shutdown timeout.

The CI runs triggered by these commits are being evaluated; do not treat this implementation as validated until the latest-commit workflows complete successfully. The API lockfile is still absent, so the Dockerfile remains on `npm install --omit=dev`; generate and commit a lockfile from a real npm environment before switching to `npm ci`.

This slice does not change business tables, apply migrations or delete data. After CI validation, continue with security and data-integrity work, then browser E2E, performance, backup/restore and deployment exercises.
