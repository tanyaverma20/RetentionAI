#!/usr/bin/env bash
# RetentionAI — MongoDB restore script (Sprint 10, Part 7).
# Restores an archive produced by backup.sh. DESTRUCTIVE: --drop replaces
# every existing collection in the target database with the backup's
# contents — this is deliberate (a restore is meant to return to a known
# state), but it means this script must never be run against production
# without double-checking the target URI first.
#
# Usage:
#   ./scripts/ops/restore.sh ./backups/retentionai_20260101T000000Z.archive.gz [mongodb://...]

set -euo pipefail

ARCHIVE="${1:?Usage: restore.sh <archive.gz> [mongo-uri]}"
MONGO_URI="${2:-${MONGODB_URI:-mongodb://localhost:27017}}"
DB_NAME="${MONGODB_DB_NAME:-retentionai}"

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

echo "This will DROP and REPLACE every collection in database '${DB_NAME}' at ${MONGO_URI%%@*}@..."
read -r -p "Type the database name (${DB_NAME}) to confirm: " confirmation
if [ "$confirmation" != "$DB_NAME" ]; then
  echo "Confirmation did not match. Aborting." >&2
  exit 1
fi

mongorestore --uri="${MONGO_URI}" --db="${DB_NAME}" --gzip --archive="${ARCHIVE}" --drop

echo "Restore complete from ${ARCHIVE}."
