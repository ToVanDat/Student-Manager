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

for command_name in psql pg_dump pg_restore; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required PostgreSQL client tool is missing: $command_name" >&2
    exit 1
  fi
done

# Use stdin (not psql -c) so psql safely interpolates the expected identity
# variables before sending the query to PostgreSQL.
identity_ok="$(psql --no-psqlrc --no-align --tuples-only \
  --set=ON_ERROR_STOP=1 --set=expected_db="$DB_NAME" --set=expected_user="$DB_USER" <<'SQL'
SELECT (current_database() = :'expected_db') AND (current_user = :'expected_user');
SQL
)"
if [[ "$identity_ok" != "t" ]]; then
  echo "Connected PostgreSQL database/user does not match DB_NAME/DB_USER; refusing backup." >&2
  exit 1
fi
printf 'Verified PostgreSQL target: host=%s port=%s database=%s user=%s\n' \
  "$PGHOST" "$PGPORT" "$DB_NAME" "$DB_USER"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_db_name="$(printf '%s' "$DB_NAME" | tr -c 'A-Za-z0-9_.-' '_')"
final_file="$BACKUP_DIR/${safe_db_name}_${timestamp}.dump"
temporary_file="$final_file.partial"

checksum_file="$final_file.sha256"
backup_complete=false
cleanup() {
  rm -f "$temporary_file"
  if [[ "$backup_complete" != true ]]; then
    rm -f "$final_file" "$checksum_file"
  fi
}
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

chmod 600 "$final_file" "$checksum_file"
backup_complete=true
echo "Backup archive verified. SHA-256 manifest: $checksum_file"
echo "No database rows or schema objects were modified."
