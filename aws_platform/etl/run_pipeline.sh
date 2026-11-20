#!/bin/sh
set -e

export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"
echo "=== JAVA_HOME detectado: ${JAVA_HOME} ==="

echo "=== Esperando a PostgreSQL en ${PGHOST}:${PGPORT} ==="
until pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}"; do
  sleep 2
done

echo "=== Fase 1: Ejecutando ETL PySpark (etl_rendimiento.py) ==="
python3 /workspace/etl_rendimiento.py --csv /workspace/xAPI-Edu-Data.csv

echo "=== Fase 2: Aplicando vistas SQL (02_vistas.sql) ==="
PGCLIENTENCODING=UTF8 psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -f /workspace/02_vistas.sql

echo "=== Fase 3: Aplicando trigger real-time (03_realtime_trigger.sql) ==="
PGCLIENTENCODING=UTF8 psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -f /workspace/03_realtime_trigger.sql

echo "=== Pipeline ETL + Vistas SQL + Real-Time completado con éxito ==="
