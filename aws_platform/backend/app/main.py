import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import close_pool, init_pool
from app.repositories.academic_repository import AcademicRepository
from app.routers import analytics, anova, health, ingestion, realtime
from app.services.cloudwatch_service import publish_kpi_metrics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    try:
        resumen = AcademicRepository().fetch_view("v_resumen_general")
        if resumen:
            publish_kpi_metrics(resumen[0], origen="startup")
    except Exception:
        pass
    yield
    close_pool()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend analítico para el Proyecto 2: Evaluación del Rendimiento Académico en Universidades "
        "(xAPI-Edu-Data). Expone las 14 vistas SQL de Power BI, el módulo estadístico ANOVA, "
        "ingesta ETL en vivo con notificaciones SSE y métricas en AWS CloudWatch."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analytics.router)
app.include_router(anova.router)
app.include_router(realtime.router)
app.include_router(ingestion.router)
