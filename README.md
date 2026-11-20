# trabajoFinalPoweBi

## Proyecto 2: Evaluación del Rendimiento Académico en Universidades

Plataforma integral de **Ingeniería de Datos, Inteligencia de Negocios (Power BI), Análisis Estadístico (ANOVA)** y **aplicación web en AWS** construida a partir del conjunto de datos [`xAPI-Edu-Data`](https://www.kaggle.com/datasets/aljarah/xAPI-Edu-Data) (480 registros y 17 variables originales).

- **Dashboard Web en producción (AWS CloudFront HTTPS):** https://d34l38k5x7colm.cloudfront.net
- **Documentación OpenAPI (Swagger):** https://d34l38k5x7colm.cloudfront.net/api/docs
- **Informe Técnico en Normas APA 7ª edición:** [`Informe_Tecnico_Proyecto2_APA7.pdf`](./Informe_Tecnico_Proyecto2_APA7.pdf)

---

## Arquitectura del Proyecto

```
Navegador (HTTPS) ──► Amazon CloudFront (CDN + TLS)
                            │
                            ▼
                  [ Nginx · Puerto 80 ] ──► Frontend React + TypeScript + Recharts
                            │
                            └── /api/* & /api/v1/stream (SSE)
                                      ▼
                            [ Backend FastAPI + SciPy ANOVA ] ──► Amazon CloudWatch Metrics
                                      │
                                      ▼
Power BI Desktop ──────────► [ PostgreSQL 17 (momento3_powerbi) ] ◄── [ ETL PySpark ]
                                      │                                (36 reglas + 14 vistas)
                                      ▼
                            [ Backup Cron S3 ] ──► Amazon S3 (AES256 + Versionado + 30d)
                                      │
            Todos los contenedores ───┴──► Amazon CloudWatch Logs (/academico-bi/produccion)
```

---

## Estructura del Repositorio

- `selenium_config/` — Automatización de descarga con Selenium (`descarga_kaggle.py`) y **ETL PySpark** (`etl_rendimiento.py`) con 36 reglas de calidad, transformaciones y carga transaccional con conciliación.
- `02_vistas.sql` — Capa analítica con las **14 vistas SQL** que resuelven los 10 requerimientos de Power BI.
- `powerbi/trabajo_final_powerbi.pbix` — Tablero interactivo en Power BI Desktop.
- `aws_platform/` — Infraestructura contenerizada con **Docker Compose**:
  - `backend/` — API REST en **FastAPI** + motor estadístico **ANOVA** (`scipy.stats`: Shapiro-Wilk, Levene, ANOVA clásico, Welch, Kruskal-Wallis y Tukey HSD) + ingesta CSV en vivo + stream SSE en tiempo real (`LISTEN/NOTIFY`) + métricas en **CloudWatch**.
  - `frontend/` — Dashboard interactivo en **React + Vite + TypeScript + Tailwind CSS + Recharts** servido por Nginx.
  - `etl/` — Contenedor PySpark bajo demanda (`--profile etl`).
  - `backup/` — Contenedor cron con `pg_dump` + **AWS S3** (cifrado AES256).
  - `setup_aws_infra.sh` & `deploy_aws.ps1` — Scripts de aprovisionamiento y despliegue en AWS EC2 Ubuntu.
- `demo_sustentacion/` — CSV simulado validado de 520 registros (`xAPI-Edu-Data_actualizado_demo.csv`) y scripts para demostrar actualización en tiempo real en PostgreSQL, Web y Power BI.
- `Informe_Tecnico_Proyecto2_APA7.pdf` — Informe técnico completo en formato APA 7ª edición con capturas de código y frontend.

---

## Ejecución Rápida (Local)

### 1. Ejecutar solo el ETL hacia PostgreSQL local
```powershell
$env:PGHOST="127.0.0.1"; $env:PGPORT="5432"; $env:PGDATABASE="momento3_powerbi"; $env:PGUSER="postgres"; $env:PGPASSWORD="TU_PASSWORD"
python selenium_config\etl_rendimiento.py --csv selenium_config\datos\xAPI-Edu-Data.csv
```

### 2. Aplicar las 14 vistas SQL
```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d momento3_powerbi -f 02_vistas.sql
```

### 3. Levantar Backend y Frontend en modo desarrollo
```powershell
# Terminal 1 – Backend FastAPI
$env:PYTHONPATH="aws_platform\backend"
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 – Frontend React
cd aws_platform\frontend
npm install
npm run dev
```

> **Nota de seguridad:** Las llaves privadas (`.pem`), archivos `.env` y el perfil de navegador (`chrome_profile/`) están excluidos en `.gitignore` y nunca deben subirse al repositorio.
