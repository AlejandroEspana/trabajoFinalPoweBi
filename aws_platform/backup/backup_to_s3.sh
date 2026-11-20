#!/bin/bash
set -euo pipefail

[ -z "${AWS_ACCESS_KEY_ID:-}" ] && unset AWS_ACCESS_KEY_ID
[ -z "${AWS_SECRET_ACCESS_KEY:-}" ] && unset AWS_SECRET_ACCESS_KEY
[ -z "${AWS_SESSION_TOKEN:-}" ] && unset AWS_SESSION_TOKEN

if [ -z "${S3_BACKUP_BUCKET:-}" ]; then
  echo "[ERROR] S3_BACKUP_BUCKET no está definido. Omitiendo backup."
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
PREFIX="${S3_BACKUP_PREFIX:-backups/momento3_powerbi}"
DUMP_FILE="/tmp/${PGDATABASE}_${TIMESTAMP}.dump"
SQL_FILE="/tmp/${PGDATABASE}_${TIMESTAMP}.sql.gz"

echo "[$(date -u +%FT%TZ)] Iniciando backup de ${PGDATABASE} desde ${PGHOST}:${PGPORT}..."

pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --format=custom --compress=9 --no-owner --no-privileges \
  -f "${DUMP_FILE}"

pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --no-owner --no-privileges | gzip -9 > "${SQL_FILE}"

DUMP_SIZE="$(du -h "${DUMP_FILE}" | cut -f1)"
echo "[$(date -u +%FT%TZ)] Backup generado (${DUMP_SIZE}). Subiendo a s3://${S3_BACKUP_BUCKET}/${PREFIX}/..."

aws s3 cp "${DUMP_FILE}" "s3://${S3_BACKUP_BUCKET}/${PREFIX}/${PGDATABASE}_${TIMESTAMP}.dump" --sse AES256 --only-show-errors
aws s3 cp "${DUMP_FILE}" "s3://${S3_BACKUP_BUCKET}/${PREFIX}/latest.dump" --sse AES256 --only-show-errors
aws s3 cp "${SQL_FILE}" "s3://${S3_BACKUP_BUCKET}/${PREFIX}/${PGDATABASE}_${TIMESTAMP}.sql.gz" --sse AES256 --only-show-errors

DUMP_KB="$(du -k "${DUMP_FILE}" | cut -f1)"
rm -f "${DUMP_FILE}" "${SQL_FILE}"
echo "[$(date -u +%FT%TZ)] Backup subido exitosamente a S3."

# Publicar métricas de backup en Amazon CloudWatch
aws cloudwatch put-metric-data \
  --region "${AWS_DEFAULT_REGION:-us-east-2}" \
  --namespace "${CLOUDWATCH_NAMESPACE:-EduAnalytics/Academico}" \
  --metric-data \
    "MetricName=BackupS3Exitoso,Value=1,Unit=Count" \
    "MetricName=BackupS3TamanoKB,Value=${DUMP_KB},Unit=Kilobytes" \
  && echo "[$(date -u +%FT%TZ)] Métricas de backup publicadas en CloudWatch." \
  || echo "[$(date -u +%FT%TZ)] Aviso: no se pudieron publicar métricas de backup en CloudWatch."
