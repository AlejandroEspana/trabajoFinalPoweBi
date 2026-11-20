# Plataforma Analítica Web + ETL + ANOVA (AWS EC2 Ubuntu)

Plataforma contenerizada con **Docker Compose** para el **Proyecto 2: Evaluación del Rendimiento Académico en Universidades (`xAPI-Edu-Data`)**.

## Arquitectura

- **`postgres` (PostgreSQL 17)**: base de datos `momento3_powerbi`, esquema `academico`, tabla `rendimiento_estudiantes`, auditoría `etl_control` y 14 vistas SQL (`02_vistas.sql`).
- **`etl` (PySpark 3.5 + Java 17, perfil bajo demanda `--profile etl`)**: ejecuta `etl_rendimiento.py` (extracción, 36 reglas de validación, transformación, carga transaccional) y aplica `02_vistas.sql`.
- **`backend` (FastAPI + SciPy)**: arquitectura por capas (`routers/`, `services/`, `repositories/`, `core/`). Expone los 10 requerimientos analíticos, explorador de vistas y el **motor estadístico ANOVA** (ANOVA clásico, Shapiro-Wilk, Levene, Welch ANOVA, Kruskal-Wallis y Post-Hoc Tukey HSD). Documentación OpenAPI en `/api/docs`.
- **`frontend` (React + TypeScript + Tailwind CSS + Recharts servido por Nginx)**: tablero interactivo con los 10 requerimientos, tablas filtrables/exportables a CSV y laboratorio ANOVA.

## Despliegue en AWS EC2 Ubuntu

Desde PowerShell en `aws_platform/`:

```powershell
.\deploy_aws.ps1 -HostIp TU_IP_PUBLICA_EC2
```

Una vez finalizado:
- **Dashboard Web:** `http://<IP_EC2>/`
- **API Swagger:** `http://<IP_EC2>/api/docs`

## Ejecución en modo desarrollo local (conectado a tu PostgreSQL local)

```powershell
# Terminal 1 – Backend
$env:PYTHONPATH="aws_platform\backend"; $env:PGHOST="127.0.0.1"; $env:PGPORT="5432"; $env:PGDATABASE="momento3_powerbi"; $env:PGUSER="postgres"; $env:PGPASSWORD="123456"
uvicorn app.main:app --reload --port 8000

# Terminal 2 – Frontend
cd aws_platform\frontend
npm install
npm run dev
```
