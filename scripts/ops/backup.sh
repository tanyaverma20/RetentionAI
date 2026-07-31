#!/usr/bin/env bash
# RetentionAI — MongoDB backup script (Sprint 10, Part 7).
# Intended for the Linux/Docker production host, not the Windows dev machine.
# Requires the MongoDB Database Tools (mongodump) — already present in the
# official mongo:7 image and installable via `apt install mongodb-database-tools`.
#
# Usage:
#   ./scripts/ops/backup.sh                 # backs up $MONGODB_URI (or mongodb://localhost:27017)
#   ./scripts/ops/backup.sh mongodb://...    # backs up an explicit URI
#
# Output: ./backups/retentionai_<UTC timestamp>.archive.gz (a single
# mongodump archive — restore with restore.sh, not manual mongorestore, so
# the two scripts stay in sync).

set -euo pipefail

MONGO_URI="${1:-${MONGODB_URI:-mongodb://localhost:27017}}"
DB_NAME="${MONGODB_DB_NAME:-retentionai}"
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="${BACKUP_DIR}/retentionai_${TIMESTAMP}.archive.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database '${DB_NAME}' from ${MONGO_URI%%@*}@... to ${OUTPUT_FILE}"
mongodump --uri="${MONGO_URI}" --db="${DB_NAME}" --gzip --archive="${OUTPUT_FILE}"

echo "Backup complete: ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | cut -f1))"

# Retention: keep the last 14 daily backups, delete anything older.
find "$BACKUP_DIR" -name 'retentionai_*.archive.gz' -mtime +14 -print -delete
