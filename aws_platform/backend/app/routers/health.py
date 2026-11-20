from fastapi import APIRouter, HTTPException
from app.repositories.academic_repository import AcademicRepository

router = APIRouter(prefix="/api/v1", tags=["Estado"])


@router.get("/health")
def health_check():
    try:
        repo = AcademicRepository()
        return {"status": "ok", **repo.check_health()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Error de conexión a PostgreSQL: {exc}")
