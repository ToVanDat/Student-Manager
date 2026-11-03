# Production Backup, Restore, TLS and Deployment Runbook

**Status:** Operating procedure draft; not evidence of a completed backup/restore drill or production deployment.

## 1. PostgreSQL backup

Prerequisites: PostgreSQL client tools (pg_dump, pg_restore), a backup-capable database account, and verified database identity.

From students_managerment-api:

```bash
DB_HOST=localhost DB_PORT=5432 DB_NAME=students_managerment DB_USER=backup_operator \
  bash scripts/backup-postgres.sh
```

Supply the password through PGPASSWORD from a protected shell or secret manager; do not put it in command history or this repository. The script creates a timestamped custom-format archive outside the repository, applies restrictive permissions, validates it with pg_restore --list, writes a SHA-256 manifest, and never drops objects, overwrites an existing archive, or deletes older backups.

Copy verified artifacts to an encrypted off-host destination with restricted access. Local-only backups do not protect against host loss or ransomware.

## 2. Restore drill (isolated target only)

Do not restore over the active database as part of a routine drill.

1. Provision a disposable, isolated PostgreSQL database using an operator-approved process.
2. Verify host, port, database name and role. Confirm the target is not the live application database.
3. Verify checksum and archive readability: sha256sum -c <backup-file>.dump.sha256; pg_restore --list <backup-file>.dump.
4. Restore into the isolated target: pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE" <backup-file>.dump.
5. Verify schema inventory, migration ledger, row counts, foreign-key consistency and representative application reads.
6. Record duration, failures, database version, archive checksum, RPO and RTO.
7. Retain the isolated restore until acceptance evidence is reviewed. Clean up the disposable target only through a separately approved operator action.

A successful archive listing is not a successful restore. Production readiness requires a completed restore drill.

## 3. TLS and reverse proxy

- Terminate HTTPS at a maintained reverse proxy using a valid certificate and automated renewal.
- Redirect HTTP to HTTPS; enable HSTS only after HTTPS is verified for every required subdomain.
- Set production cookie attributes: Secure, HttpOnly, appropriate SameSite, and narrow Domain/path.
- Configure Express proxy trust only for the exact trusted proxy hop count. The proxy must overwrite forwarded-IP headers.
- Keep PostgreSQL, Redis and backend admin ports private; expose only the reverse proxy publicly.
- Use TLS for remote database, Redis and Ollama connections. Never permit arbitrary remote plaintext Ollama URLs.
- Test certificate renewal, expiry alerting, redirects, websocket upgrades and cookie delivery.

## 4. Monitoring and alerting

Current readiness checks cover PostgreSQL and Redis availability only. Before production, add and validate:
- structured JSON logs with request/correlation IDs and redaction of credentials, tokens, prompts and personal data;
- metrics for HTTP latency/error rate, process resources, PostgreSQL pool saturation, Redis health, Ollama queue/rejections, SSE disconnects and Face pipeline fail-closed events;
- alert routing and retention policies;
- dependency outage tests and log/metric access controls.

Do not log raw face frames, embeddings, access/refresh tokens, session cookies, or plaintext private student records.

## 5. Deployment and rollback gate

- Pin container images to reviewed versions/digests and build from committed lockfiles.
- Store production secrets outside source control and rotate them using an audited procedure.
- Apply database migrations one at a time only after a verified backup and preflight review.
- Run unit, integration, migration, frontend build and security regression suites in CI.
- Deploy to staging first; run health checks and smoke tests; then promote with a documented rollback plan.
- Verify backup recovery, TLS, CORS, cookies, trusted proxy, rate-limit and WebSocket behavior from outside the host.
- Keep database rollback separate from application rollback; prefer forward-fix migrations for irreversible data changes.

## 6. Acceptance evidence still required

| Control | Required evidence |
|---|---|
| Backup | Timestamped archive, checksum, successful archive listing |
| Restore | Successful isolated restore and integrity checks |
| RPO/RTO | Measured values from the restore drill |
| TLS | Valid certificate chain, renewal test, redirect/cookie checks |
| Monitoring | Dashboards, alert test, redacted logs |
| Deployment | Staging smoke test, rollback rehearsal, dependency outage test |

No production database is modified by the backup script. No restore or deployment is performed by this runbook.
