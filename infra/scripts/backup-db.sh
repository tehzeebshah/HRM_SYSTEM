#!/usr/bin/env bash
# Backs up the HRMS Postgres database to /opt/hrms/backups with date-stamped
# gzip + a retention sweep. Intended to run as a host cron job (user: deploy).
#
#   crontab -e
#   0 2 * * * /opt/hrms/scripts/backup-db.sh >> /var/log/hrms-backup.log 2>&1
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/hrms/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-/opt/hrms/.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/opt/hrms/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hrms-prod-postgres-1}"

mkdir -p "$BACKUP_DIR"

# Source DB creds from the env file the compose stack uses.
set -a
# shellcheck disable=/dev/null
source "$ENV_FILE"
set +a

DB_USER="${POSTGRES_USER:-hrms}"
DB_NAME="${POSTGRES_DB:-hrms}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

echo "[$(date -Is)] backing up $DB_NAME → $OUT"

docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  | gzip > "$OUT"

# Keep the latest copy under a stable name too (handy for ad-hoc restores).
ln -sf "$OUT" "$BACKUP_DIR/db-latest.sql.gz"

# Retention sweep.
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Is)] done. size=$SIZE, retention=${RETENTION_DAYS}d"
