#!/bin/bash
set -euo pipefail

[ -z "${AWS_ACCESS_KEY_ID:-}" ] && unset AWS_ACCESS_KEY_ID
[ -z "${AWS_SECRET_ACCESS_KEY:-}" ] && unset AWS_SECRET_ACCESS_KEY
[ -z "${AWS_SESSION_TOKEN:-}" ] && unset AWS_SESSION_TOKEN

OBJECT_KEY="${1:-${S3_BACKUP_PREFIX:-backups/momento3_powerbi}/latest.dump}"
TMP_DUMP="/tmp/restore.dump"

echo "Descargando s3://${S3_BACKUP_BUCKET}/${OBJECT_KEY}..."
aws s3 cp "s3://${S3_BACKUP_BUCKET}/${OBJECT_KEY}" "${TMP_DUMP}"

echo "Restaurando en ${PGHOST}:${PGPORT}/${PGDATABASE}..."
pg_restore -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --clean --if-exists --no-owner --no-privileges "${TMP_DUMP}"

rm -f "${TMP_DUMP}"
echo "Restauración completada."
