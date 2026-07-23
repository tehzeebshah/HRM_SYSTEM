#!/usr/bin/env bash
# Restores the HRMS database from a gzipped SQL dump.
#
#   ./restore-db.sh /opt/hrms/backups/db-20260801-020000.sql.gz
#   ./restore-db.sh                  # restores db-latest.sql.gz
#
# WARNING: this drops & recreates the target database. Stop the API first.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/hrms/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-/opt/hrms/.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/opt/hrms/backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hrms-prod-postgres-1}"

DUMP="${1:-$BACKUP_DIR/db-latest.sql.gz}"
if [[ ! -f "$DUMP" ]]; then
  echo "Dump not found: $DUMP" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

DB_USER="${POSTGRES_USER:-hrms}"
DB_NAME="${POSTGRES_DB:-hrms}"

echo "[$(date -Is)] RESTORING $DUMP → $DB_NAME (container $POSTGRES_CONTAINER)"
echo "The API should be stopped. Press Ctrl-C within 8s to abort…"
sleep 8

# Drop & recreate so no leftover tables remain, then stream the dump back in.
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
gunzip -c "$DUMP" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "[$(date -Is)] restore complete. Re-run migrations to confirm:"
echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE run --rm api node node_modules/.bin/prisma migrate deploy"
