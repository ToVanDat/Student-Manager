# PostgreSQL Backup, Restore and Volume Safety Runbook

**Repository:** ToVanDat/Student-Manager  
**Branch:** feature/chat-1to1-complete  
**Assessment date:** 2026-10-26  
**Status:** Procedure only. No database, Docker volume or local environment was accessed or changed.

## 1. Critical finding: PostgreSQL 18 volume target

The current students_managerment-api/docker-compose.yml declares:

```yaml
postgres:
  image: postgres:18
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

The official PostgreSQL Docker image changed its default PGDATA for PostgreSQL 18+ to a major-version-specific path. For PostgreSQL 18 it is /var/lib/postgresql/18/docker, and the declared volume target is /var/lib/postgresql. The current Compose mount targets the pre-18 path and must be treated as a persistence risk until the running container's actual mount and data directory are inspected.

References:
- Official PostgreSQL image documentation: https://hub.docker.com/_/postgres
- Docker PostgreSQL guide: https://docs.docker.com/guides/postgresql/

**Do not simply change the mount path on a database that may contain user data.** First identify where the active cluster data resides and take a verified backup. The old named volume may be empty while the actual cluster resides in an anonymous volume or container layer.

## 2. Connection identity must be proven before backup

The Compose configuration currently maps:

- Container-to-container: backend DB_HOST=postgres, DB_PORT=5432.
- Host-to-container: 127.0.0.1:5433 -> container:5432.

Therefore, a backend running directly on Windows/WSL and connecting to this Compose PostgreSQL should normally use localhost:5433, while the backend container should use postgres:5432. A local PostgreSQL service listening on host port 5432 may be a different cluster.

Before any migration or backup, confirm the backend's effective connection configuration without printing passwords, then run this read-only query through the same connection used by the application:

```sql
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  inet_server_addr() AS server_address,
  inet_server_port() AS server_port,
  version() AS server_version;
```

Also record the expected database name and schema. Do not assume that students_managerment and Student_Management refer to the same database.

## 3. Read-only Docker inspection

Run these commands before changing Compose or touching volumes:

```bash
docker compose ps
docker inspect student-management-postgres --format '{{json .Mounts}}'
docker inspect student-management-postgres --format '{{json .Config.Env}}'
docker exec student-management-postgres sh -lc 'echo "PGDATA=$PGDATA"; ls -lah /var/lib/postgresql; ls -lah /var/lib/postgresql/data 2>/dev/null || true; ls -lah /var/lib/postgresql/18/docker 2>/dev/null || true'
docker volume ls
```

Inspect mount source, destination, volume name, container state and actual PGDATA. Treat container environment output as sensitive because it can contain credentials; do not paste it into issues, chat or logs. Prefer redacted inspection output.

Do not infer the data location from the Compose file alone.

## 4. Backup procedure

Only after confirming the exact running container, database and role:

1. Create a private backup directory with restricted permissions.
2. Ensure adequate disk space.
3. Capture database dump in custom format and globals separately.
4. Check the dump command exit code and non-zero file size.
5. Record timestamp, database name, PostgreSQL major version and checksum.
6. Encrypt the backup before copying it to external storage.
7. Keep at least one backup outside the host/volume failure domain.

Example commands (replace placeholders only after confirming the target):

```bash
mkdir -p ./private-db-backups
chmod 700 ./private-db-backups
docker exec student-management-postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ./private-db-backups/student-manager-YYYYMMDD-HHMM.dump
docker exec student-management-postgres sh -lc 'pg_dumpall -U "$POSTGRES_USER" --globals-only' > ./private-db-backups/postgres-globals-YYYYMMDD-HHMM.sql
sha256sum ./private-db-backups/*
```

These are examples, not commands executed during this audit. If the application connects to a host-installed PostgreSQL instance rather than the Compose container, use the confirmed application connection target instead.

A Docker named volume is persistence, not a backup. Do not use docker compose down -v, docker volume rm, or filesystem deletion as a cleanup or migration step.

## 5. Restore drill (isolated target only)

A backup is not considered verified until it has been restored successfully.

- Provision a separate temporary PostgreSQL instance/volume; never restore over the source database.
- Match the source PostgreSQL major version for the first restore verification.
- Restore globals only after reviewing role/ownership requirements; do not blindly apply production roles to a shared environment.
- Create a new empty test database and restore the custom-format dump into it.
- Verify schema/table counts, critical row counts, constraints, indexes, sequences, extensions and application read-only smoke queries.
- Compare a small set of domain invariants (e.g. student count, enrollment count, conversation count) without exposing personal data.
- Record restore duration and any warnings; destroy the isolated test environment only after evidence has been retained.

Example restore shape (placeholders must be reviewed):

```bash
createdb -h <isolated-host> -p <isolated-port> -U <restore-role> student_manager_restore_check
pg_restore -h <isolated-host> -p <isolated-port> -U <restore-role> -d student_manager_restore_check --no-owner --no-privileges ./private-db-backups/student-manager-YYYYMMDD-HHMM.dump
```

## 6. Safe PostgreSQL 18 volume migration plan

Do not modify the Compose mount until all of the following are complete:

1. Identify the active cluster's actual PGDATA and mount source.
2. Produce and checksum a logical backup.
3. Restore that backup into an isolated PostgreSQL 18 instance using the intended new mount target postgres_data:/var/lib/postgresql.
4. Verify application schema/data invariants against the isolated restore.
5. Plan a controlled maintenance window and rollback path.
6. Stop writes, take a final backup, and migrate only the verified data.
7. Start the corrected container and prove readiness, database identity, data invariants and application smoke tests.
8. Retain the original volume and backup until the new instance has been accepted.

Do not mount the same live PostgreSQL data directory into two running PostgreSQL servers. Do not attempt a major-version upgrade by merely changing the image tag.

## 7. RPO/RTO and retention decisions still required

Before production, explicitly decide:

- RPO: maximum acceptable data loss window.
- RTO: maximum acceptable restore/service recovery time.
- Backup frequency and retention tiers.
- Encryption key ownership, rotation and recovery.
- Who can create, download, restore and delete backups.
- Monitoring for failed backups, backup age, storage capacity and restore-drill failures.

## 8. Current conclusion

- Compose uses postgres:18 with a pre-18 volume mount path; this is a high-priority persistence risk.
- Host port 5433 differs from the in-container port 5432; local backend configuration must match the actual target cluster.
- The repository cannot reveal the contents of the user's local Docker volumes or local .env; the active cluster and data location remain unverified.
- No database was connected, no backup command was executed, no volume was changed and no migration was applied.
