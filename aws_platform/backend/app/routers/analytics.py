from fastapi import APIRouter, HTTPException, Query
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1", tags=["Analítica Power BI"])


@router.get("/dashboard")
def get_dashboard_bundle():
    service = AnalyticsService()
    return service.get_dashboard_bundle()


@router.get("/vistas/{view_key}")
def get_sql_view(view_key: str):
    service = AnalyticsService()
    try:
        return service.get_view(view_key)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/etl-control")
def get_etl_control():
    service = AnalyticsService()
    return {"filas": service.get_etl_history()}


@router.get("/estudiantes")
def get_students(
    facultad: str | None = Query(default=None),
    nivel: str | None = Query(default=None),
    semestre: str | None = Query(default=None),
    clase: str | None = Query(default=None),
):
    service = AnalyticsService()
    return service.get_students(
        facultad=facultad,
        nivel=nivel,
        semestre=semestre,
        clase=clase,
    )
