#!/usr/bin/env bash
set -Eeuo pipefail

# Safe PostgreSQL custom-format backup. Creates a new artifact only.
# Never drops databases, removes old backups, or changes database contents.

: "${DB_NAME:?Set DB_NAME}"
: "${DB_USER:?Set DB_USER}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/student-manager-backups}"
PGHOST="${DB_HOST:-${PGHOST:-localhost}}"
PGPORT="${DB_PORT:-${PGPORT:-5432}}"
PGUSER="${DB_USER}"
PGDATABASE="${DB_NAME}"
export PGHOST PGPORT PGUSER PGDATABASE

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_db_name="$(printf '%s' "$DB_NAME" | tr -c 'A-Za-z0-9_.-' '_')"
final_file="$BACKUP_DIR/${safe_db_name}_${timestamp}.dump"
temporary_file="$final_file.partial"

cleanup() { rm -f "$temporary_file"; }
trap cleanup EXIT

if [[ -e "$final_file" || -e "$temporary_file" ]]; then
  echo "Refusing to overwrite an existing backup artifact." >&2
  exit 1
fi

echo "Creating PostgreSQL backup: $final_file"
pg_dump --format=custom --no-owner --no-acl --file="$temporary_file"
pg_restore --list "$temporary_file" >/dev/null
mv "$temporary_file" "$final_file"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$final_file")" > "$(basename "$final_file").sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$final_file")" > "$(basename "$final_file").sha256")
else
  echo "Backup verified, but no SHA-256 utility is available." >&2
  exit 1
fi

chmod 600 "$final_file" "$final_file.sha256"
echo "Backup archive verified. SHA-256 manifest: $final_file.sha256"
echo "No database rows or schema objects were modified."
