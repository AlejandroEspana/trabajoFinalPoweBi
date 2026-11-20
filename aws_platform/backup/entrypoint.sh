#!/bin/bash
set -euo pipefail

SCHEDULE="${BACKUP_CRON:-0 */6 * * *}"

if [ "${RUN_ON_STARTUP:-true}" = "true" ]; then
  /backup/backup_to_s3.sh
fi

echo "${SCHEDULE} /backup/backup_to_s3.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "Cron de backups S3 programado con horario: ${SCHEDULE}"
exec crond -f -l 8
