from fastapi import APIRouter, HTTPException, Query
from app.services.anova_service import AnovaService

router = APIRouter(prefix="/api/v1/anova", tags=["Componente Estadístico (ANOVA)"])


@router.get("/opciones")
def get_anova_options():
    service = AnovaService()
    return service.list_options()


@router.get("")
def run_anova(
    grupo: str = Query(default="nivel_educativo", description="Variable categórica de agrupación"),
    metrica: str = Query(default="indice_participacion", description="Variable dependiente numérica"),
    alpha: float = Query(default=0.05, gt=0.001, lt=0.25, description="Nivel de significancia α"),
):
    service = AnovaService()
    try:
        return service.run_anova(group_key=grupo, metric_key=metrica, alpha=alpha)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
