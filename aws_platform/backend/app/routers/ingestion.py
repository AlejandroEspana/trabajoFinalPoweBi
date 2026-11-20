from fastapi import APIRouter, File, HTTPException, UploadFile
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/api/v1/ingesta", tags=["Ingesta ETL en Vivo"])


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Debes subir un archivo con extensión .csv")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 10 MB")
    service = IngestionService()
    try:
        return service.ingest_csv_bytes(content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al procesar el CSV: {exc}")


@router.post("/restaurar")
def restore_original_dataset():
    service = IngestionService()
    try:
        return service.restore_original()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error restaurando el dataset original: {exc}")
