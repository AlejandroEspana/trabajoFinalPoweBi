from typing import Any
from app.core.database import get_cursor, normalize_rows

# Escala unificada con Power BI: Bajo (L) = 1, Medio (M) = 3, Alto (H) = 5
SCORE_5_SQL = "(CASE clase WHEN 'L' THEN 1 WHEN 'M' THEN 3 WHEN 'H' THEN 5 END)"

ALLOWED_VIEWS: dict[str, str] = {
    "v_resumen_general": f"""
        SELECT
            COUNT(*)                                                              AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                          AS promedio_puntaje,
            ROUND(100.0 * COUNT(*) FILTER (WHERE reprobado) / COUNT(*), 2)        AS pct_reprobados,
            ROUND(100.0 * COUNT(*) FILTER (WHERE sobresaliente) / COUNT(*), 2)    AS pct_sobresalientes,
            ROUND(100.0 * COUNT(*) FILTER (WHERE riesgo_desercion) / COUNT(*), 2) AS pct_riesgo_desercion,
            ROUND(AVG(indice_participacion), 4)                                   AS participacion_media
        FROM academico.v_base
    """,
    "v_req01_promedio_materia_semestre": f"""
        SELECT
            asignatura,
            semestre_etq                 AS semestre,
            COUNT(*)                     AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2) AS promedio_puntaje
        FROM academico.v_base
        GROUP BY asignatura, semestre_etq
        ORDER BY asignatura, semestre_etq
    """,
    "v_req02_desercion_facultad": "SELECT * FROM academico.v_req02_desercion_facultad",
    "v_req03_desempeno_genero": f"""
        SELECT
            genero_etq                                                       AS genero,
            COUNT(*)                                                         AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                     AS promedio_puntaje,
            COUNT(*) FILTER (WHERE clase = 'L')                              AS bajo,
            COUNT(*) FILTER (WHERE clase = 'M')                              AS medio,
            COUNT(*) FILTER (WHERE clase = 'H')                              AS alto,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2) AS pct_medio,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto
        FROM academico.v_base
        GROUP BY genero_etq
        ORDER BY genero_etq
    """,
    "v_req04_programas": f"""
        SELECT
            nivel_etq                                                        AS nivel_educativo,
            grado,
            COUNT(*)                                                         AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                     AS promedio_puntaje,
            COUNT(*) FILTER (WHERE clase = 'L')                              AS bajo,
            COUNT(*) FILTER (WHERE clase = 'M')                              AS medio,
            COUNT(*) FILTER (WHERE clase = 'H')                              AS alto,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2) AS pct_medio,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto
        FROM academico.v_base
        GROUP BY nivel_etq, grado
        ORDER BY nivel_etq, grado
    """,
    "v_req05_semestre": f"""
        SELECT
            semestre_etq                                                     AS semestre,
            COUNT(*)                                                         AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                     AS promedio_puntaje,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2) AS pct_medio,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto
        FROM academico.v_base
        GROUP BY semestre_etq
        ORDER BY semestre_etq
    """,
    "v_req05_semestre_nivel": f"""
        SELECT
            semestre_etq                 AS semestre,
            nivel_etq                    AS nivel_educativo,
            COUNT(*)                     AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2) AS promedio_puntaje
        FROM academico.v_base
        GROUP BY semestre_etq, nivel_etq
        ORDER BY nivel_etq, semestre_etq
    """,
    "v_req06_top10_reprobacion": "SELECT * FROM academico.v_req06_top10_reprobacion",
    "v_req07_asistencia_rendimiento": f"""
        SELECT
            ausencias_etq                                                    AS ausencias,
            COUNT(*)                                                         AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                     AS promedio_puntaje,
            ROUND(AVG(indice_participacion), 4)                              AS participacion_media,
            COUNT(*) FILTER (WHERE clase = 'L')                              AS bajo,
            COUNT(*) FILTER (WHERE clase = 'M')                              AS medio,
            COUNT(*) FILTER (WHERE clase = 'H')                              AS alto,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2) AS pct_medio,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto
        FROM academico.v_base
        GROUP BY ausencias_etq
        ORDER BY ausencias_etq DESC
    """,
    "v_req08_sobresalientes": "SELECT * FROM academico.v_req08_sobresalientes",
    "v_req09_cohortes": f"""
        SELECT
            grado                                                            AS cohorte_grado,
            COUNT(*)                                                         AS estudiantes,
            ROUND(AVG({SCORE_5_SQL}), 2)                                     AS promedio_puntaje,
            COUNT(*) FILTER (WHERE clase = 'L')                              AS bajo,
            COUNT(*) FILTER (WHERE clase = 'M')                              AS medio,
            COUNT(*) FILTER (WHERE clase = 'H')                              AS alto,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2) AS pct_medio,
            ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto
        FROM academico.v_base
        GROUP BY grado
        ORDER BY grado
    """,
    "v_req10_factores": f"""
        SELECT 'Género' AS factor, genero_etq AS categoria,
               COUNT(*) AS estudiantes, ROUND(AVG({SCORE_5_SQL}), 2) AS promedio_puntaje,
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto,
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
               ROUND(AVG(indice_participacion), 4) AS participacion_media
        FROM academico.v_base GROUP BY genero_etq
        UNION ALL
        SELECT 'Nivel educativo', nivel_etq,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY nivel_etq
        UNION ALL
        SELECT 'Semestre', semestre_etq,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY semestre_etq
        UNION ALL
        SELECT 'Ausencias', ausencias_etq,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY ausencias_etq
        UNION ALL
        SELECT 'Encuesta de padres', encuesta_padres,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY encuesta_padres
        UNION ALL
        SELECT 'Satisfacción de padres', satisfaccion_padres,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY satisfaccion_padres
        UNION ALL
        SELECT 'Responsable', responsable,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY responsable
        UNION ALL
        SELECT 'Facultad', facultad,
               COUNT(*), ROUND(AVG({SCORE_5_SQL}), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
               ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
               ROUND(AVG(indice_participacion), 4)
        FROM academico.v_base GROUP BY facultad
    """,
    "v_req10_participacion_clase": "SELECT * FROM academico.v_req10_participacion_clase",
    "etl_control": "SELECT * FROM academico.etl_control ORDER BY id_ejecucion DESC",
}

ALLOWED_GROUP_COLUMNS: dict[str, tuple[str, str]] = {
    "nivel_educativo": ("nivel_etq", "Nivel educativo"),
    "facultad": ("facultad", "Facultad"),
    "asignatura": ("asignatura", "Asignatura"),
    "clase": ("clase_etq", "Nivel de rendimiento"),
    "grado": ("grado", "Cohorte (Grado escolar)"),
    "genero": ("genero_etq", "Género"),
    "semestre": ("semestre_etq", "Semestre"),
    "ausencias": ("ausencias_etq", "Nivel de ausencias"),
    "satisfaccion_padres": ("satisfaccion_padres", "Satisfacción de padres"),
}

ALLOWED_METRIC_COLUMNS: dict[str, tuple[str, str]] = {
    "puntaje_ordinal": (SCORE_5_SQL, "Puntaje académico (escala 1–5)"),
    "indice_participacion": ("indice_participacion", "Índice de participación (0–1)"),
    "manos_levantadas": ("manos_levantadas", "Manos levantadas (0–100)"),
    "recursos_visitados": ("recursos_visitados", "Recursos visitados (0–100)"),
    "anuncios_vistos": ("anuncios_vistos", "Anuncios vistos (0–100)"),
    "discusiones": ("discusiones", "Participación en discusiones (0–100)"),
}


class AcademicRepository:
    def check_health(self) -> dict[str, Any]:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM academico.rendimiento_estudiantes")
            row = cur.fetchone()
            return {"database": "ok", "total_estudiantes": int(row["total"])}

    def fetch_view(self, view_key: str) -> list[dict[str, Any]]:
        sql = ALLOWED_VIEWS.get(view_key)
        if not sql:
            raise ValueError(f"Vista no permitida: {view_key}")
        with get_cursor() as cur:
            cur.execute(sql)
            return normalize_rows(cur.fetchall())

    def fetch_correlations(self) -> list[dict[str, Any]]:
        query = f"""
            SELECT 'Recursos visitados' AS variable, ROUND(CORR(recursos_visitados, {SCORE_5_SQL})::numeric, 2) AS correlacion FROM academico.v_base
            UNION ALL
            SELECT 'Manos levantadas', ROUND(CORR(manos_levantadas, {SCORE_5_SQL})::numeric, 2) FROM academico.v_base
            UNION ALL
            SELECT 'Anuncios vistos', ROUND(CORR(anuncios_vistos, {SCORE_5_SQL})::numeric, 2) FROM academico.v_base
            UNION ALL
            SELECT 'Discusiones', ROUND(CORR(discusiones, {SCORE_5_SQL})::numeric, 2) FROM academico.v_base
            ORDER BY correlacion DESC
        """
        with get_cursor() as cur:
            cur.execute(query)
            return normalize_rows(cur.fetchall())

    def fetch_etl_history(self) -> list[dict[str, Any]]:
        with get_cursor() as cur:
            cur.execute(
                """
                SELECT id_ejecucion, fecha_ejecucion, archivo_origen,
                       filas_leidas, duplicados_detectados, duplicados_eliminados,
                       filas_cargadas, estado
                FROM academico.etl_control
                ORDER BY id_ejecucion DESC
                LIMIT 20
                """
            )
            return normalize_rows(cur.fetchall())

    def fetch_base_records(
        self,
        facultad: str | None = None,
        nivel: str | None = None,
        semestre: str | None = None,
        clase: str | None = None,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if facultad:
            clauses.append("facultad = %s")
            params.append(facultad)
        if nivel:
            clauses.append("nivel_etq = %s")
            params.append(nivel)
        if semestre:
            clauses.append("semestre_etq = %s")
            params.append(semestre)
        if clase:
            clauses.append("clase_etq = %s")
            params.append(clase)

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = f"""
            SELECT id_registro, genero_etq AS genero, nacionalidad, nivel_etq AS nivel_educativo,
                   grado, seccion, asignatura, facultad, semestre_etq AS semestre, responsable,
                   manos_levantadas, recursos_visitados, anuncios_vistos, discusiones,
                   encuesta_padres, satisfaccion_padres, ausencias_etq AS ausencias,
                   clase_etq AS clase, {SCORE_5_SQL} AS puntaje_escala_5, reprobado, sobresaliente,
                   riesgo_desercion, indice_participacion
            FROM academico.v_base
            {where_sql}
            ORDER BY id_registro
        """
        with get_cursor() as cur:
            cur.execute(query, params)
            return normalize_rows(cur.fetchall())

    def fetch_grouped_metric(self, group_key: str, metric_key: str) -> list[dict[str, Any]]:
        if group_key not in ALLOWED_GROUP_COLUMNS:
            raise ValueError(f"Variable categórica no válida: {group_key}")
        if metric_key not in ALLOWED_METRIC_COLUMNS:
            raise ValueError(f"Variable numérica no válida: {metric_key}")

        group_col, _ = ALLOWED_GROUP_COLUMNS[group_key]
        metric_expr, _ = ALLOWED_METRIC_COLUMNS[metric_key]

        query = f"""
            SELECT {group_col} AS grupo, ({metric_expr})::DOUBLE PRECISION AS valor
            FROM academico.v_base
            WHERE {group_col} IS NOT NULL AND ({metric_expr}) IS NOT NULL
            ORDER BY {group_col}
        """
        with get_cursor() as cur:
            cur.execute(query)
            return normalize_rows(cur.fetchall())
