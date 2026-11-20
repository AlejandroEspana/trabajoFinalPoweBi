from typing import Any
from app.repositories.academic_repository import AcademicRepository, ALLOWED_VIEWS


class AnalyticsService:
    def __init__(self, repo: AcademicRepository | None = None):
        self.repo = repo or AcademicRepository()

    def get_dashboard_bundle(self) -> dict[str, Any]:
        resumen_rows = self.repo.fetch_view("v_resumen_general")
        etl_rows = self.repo.fetch_etl_history()
        return {
            "resumen": resumen_rows[0] if resumen_rows else {},
            "etl_ultimo": etl_rows[0] if etl_rows else None,
            "req01_materia_semestre": self.repo.fetch_view("v_req01_promedio_materia_semestre"),
            "req02_desercion_facultad": self.repo.fetch_view("v_req02_desercion_facultad"),
            "req03_desempeno_genero": self.repo.fetch_view("v_req03_desempeno_genero"),
            "req04_programas": self.repo.fetch_view("v_req04_programas"),
            "req05_semestre": self.repo.fetch_view("v_req05_semestre"),
            "req05_semestre_nivel": self.repo.fetch_view("v_req05_semestre_nivel"),
            "req06_top10_reprobacion": self.repo.fetch_view("v_req06_top10_reprobacion"),
            "req07_asistencia_rendimiento": self.repo.fetch_view("v_req07_asistencia_rendimiento"),
            "req08_sobresalientes": self.repo.fetch_view("v_req08_sobresalientes"),
            "req09_cohortes": self.repo.fetch_view("v_req09_cohortes"),
            "req10_factores": self.repo.fetch_view("v_req10_factores"),
            "req10_participacion_clase": self.repo.fetch_view("v_req10_participacion_clase"),
            "req10_correlaciones": self.repo.fetch_correlations(),
        }

    def get_view(self, view_key: str) -> dict[str, Any]:
        if view_key not in ALLOWED_VIEWS:
            raise ValueError(f"Vista desconocida: {view_key}")
        rows = self.repo.fetch_view(view_key)
        return {"vista": view_key, "total": len(rows), "filas": rows}

    def get_etl_history(self) -> list[dict[str, Any]]:
        return self.repo.fetch_etl_history()

    def get_students(
        self,
        facultad: str | None = None,
        nivel: str | None = None,
        semestre: str | None = None,
        clase: str | None = None,
    ) -> dict[str, Any]:
        rows = self.repo.fetch_base_records(
            facultad=facultad,
            nivel=nivel,
            semestre=semestre,
            clase=clase,
        )
        return {"total": len(rows), "filas": rows}
