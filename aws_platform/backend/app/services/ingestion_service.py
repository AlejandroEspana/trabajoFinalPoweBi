import csv
import io
import logging
import re
from pathlib import Path
from typing import Any

from psycopg2.extras import execute_values

from app.core.database import get_cursor
from app.repositories.academic_repository import AcademicRepository
from app.services.cloudwatch_service import publish_kpi_metrics

logger = logging.getLogger("eduanalytics.ingestion")

ORIGINAL_CSV_PATH = Path("/workspace/xAPI-Edu-Data.csv")

COLUMNAS = [
    ("gender", "genero", "texto"),
    ("NationalITy", "nacionalidad", "texto"),
    ("PlaceofBirth", "lugar_nacimiento", "texto"),
    ("StageID", "nivel_educativo", "texto"),
    ("GradeID", "grado", "texto"),
    ("SectionID", "seccion", "texto"),
    ("Topic", "asignatura", "texto"),
    ("Semester", "semestre", "texto"),
    ("Relation", "responsable", "texto"),
    ("raisedhands", "manos_levantadas", "entero"),
    ("VisITedResources", "recursos_visitados", "entero"),
    ("AnnouncementsView", "anuncios_vistos", "entero"),
    ("Discussion", "discusiones", "entero"),
    ("ParentAnsweringSurvey", "encuesta_padres", "texto"),
    ("ParentschoolSatisfaction", "satisfaccion_padres", "texto"),
    ("StudentAbsenceDays", "ausencias", "texto"),
    ("Class", "clase", "texto"),
]

NUMERICAS = [dest for _, dest, tipo in COLUMNAS if tipo == "entero"]

FACULTADES = {
    "Biology": "Ciencias", "Chemistry": "Ciencias", "Geology": "Ciencias", "Science": "Ciencias",
    "Arabic": "Humanidades y Lenguas", "English": "Humanidades y Lenguas",
    "French": "Humanidades y Lenguas", "Spanish": "Humanidades y Lenguas",
    "History": "Humanidades y Lenguas", "Quran": "Humanidades y Lenguas",
    "Math": "Matemáticas y Tecnología", "IT": "Matemáticas y Tecnología",
}

DOMINIOS = {
    "genero": {"M", "F"},
    "nivel_educativo": {"lowerlevel", "MiddleSchool", "HighSchool"},
    "seccion": {"A", "B", "C"},
    "asignatura": set(FACULTADES.keys()),
    "semestre": {"F", "S"},
    "responsable": {"Father", "Mum"},
    "encuesta_padres": {"Yes", "No"},
    "satisfaccion_padres": {"Good", "Bad"},
    "ausencias": {"Under-7", "Above-7"},
    "clase": {"L", "M", "H"},
}

PATRON_GRADO = re.compile(r"^G-(0[1-9]|1[0-2])$")

ORDEN_DB = [
    "genero", "nacionalidad", "lugar_nacimiento", "nivel_educativo", "grado", "seccion",
    "asignatura", "facultad", "semestre", "responsable", "manos_levantadas",
    "recursos_visitados", "anuncios_vistos", "discusiones", "encuesta_padres",
    "satisfaccion_padres", "ausencias", "clase", "puntaje_ordinal", "reprobado",
    "sobresaliente", "riesgo_desercion", "indice_participacion",
]


class IngestionService:
    def ingest_csv_bytes(self, content: bytes, filename: str) -> dict[str, Any]:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("El archivo CSV está vacío o no tiene encabezados.")

        clean_headers = [h.replace("\ufeff", "").strip() for h in reader.fieldnames]
        esperadas = {orig for orig, _, _ in COLUMNAS}
        faltan = sorted(esperadas - set(clean_headers))
        sobran = sorted(set(clean_headers) - esperadas)
        if faltan or sobran:
            raise ValueError(
                f"Esquema distinto a xAPI-Edu-Data. Faltan: {faltan}. Sobran: {sobran}"
            )

        raw_rows: list[dict[str, str | None]] = []
        for row in reader:
            cleaned: dict[str, str | None] = {}
            for orig, dest, _ in COLUMNAS:
                val = (row.get(orig) or "").strip()
                cleaned[dest] = val if val != "" else None
            raw_rows.append(cleaned)

        total = len(raw_rows)
        if total == 0:
            raise ValueError("El CSV no contiene filas de datos.")

        # Validar las 36 reglas de calidad de etl_rendimiento.py
        errores: list[str] = []
        for _, dest, _ in COLUMNAS:
            nulos = sum(1 for r in raw_rows if r[dest] is None)
            if nulos:
                errores.append(f"{dest}: {nulos} valor(es) nulo(s) o vacío(s)")

        for col in NUMERICAS:
            no_int = sum(1 for r in raw_rows if r[col] is not None and not r[col].isdigit())
            fuera_rango = sum(
                1 for r in raw_rows
                if r[col] is not None and r[col].isdigit() and not (0 <= int(r[col]) <= 100)
            )
            if no_int:
                errores.append(f"{col}: {no_int} valor(es) no entero(s)")
            if fuera_rango:
                errores.append(f"{col}: {fuera_rango} valor(es) fuera del rango 0-100")

        for col, validos in DOMINIOS.items():
            invalidos = sum(1 for r in raw_rows if r[col] is not None and r[col] not in validos)
            if invalidos:
                errores.append(f"{col}: {invalidos} valor(es) fuera del dominio permitido")

        grado_invalido = sum(
            1 for r in raw_rows if r["grado"] is not None and not PATRON_GRADO.match(r["grado"])
        )
        if grado_invalido:
            errores.append(f"grado: {grado_invalido} fila(s) con formato distinto de G-NN")

        if errores:
            raise ValueError("Validación fallida (no se modificó la BD): " + "; ".join(errores))

        # Duplicados exactos
        seen_tuples = [tuple(r[dest] for _, dest, _ in COLUMNAS) for r in raw_rows]
        duplicados = total - len(set(seen_tuples))

        # Transformar filas (idéntico a etl_rendimiento.py)
        transformed: list[tuple[Any, ...]] = []
        for r in raw_rows:
            manos = int(r["manos_levantadas"])  # type: ignore[arg-type]
            recursos = int(r["recursos_visitados"])  # type: ignore[arg-type]
            anuncios = int(r["anuncios_vistos"])  # type: ignore[arg-type]
            discusiones = int(r["discusiones"])  # type: ignore[arg-type]
            clase = r["clase"]
            ausencias = r["ausencias"]
            puntaje_ord = 3 if clase == "H" else (2 if clase == "M" else 1)
            reprobado = clase == "L"
            sobresaliente = clase == "H"
            riesgo = (clase == "L") and (ausencias == "Above-7")
            indice = round((manos + recursos + anuncios + discusiones) / 400.0, 4)

            record_map = {
                "genero": r["genero"],
                "nacionalidad": r["nacionalidad"],
                "lugar_nacimiento": r["lugar_nacimiento"],
                "nivel_educativo": r["nivel_educativo"],
                "grado": r["grado"],
                "seccion": r["seccion"],
                "asignatura": r["asignatura"],
                "facultad": FACULTADES[r["asignatura"]],  # type: ignore[index]
                "semestre": r["semestre"],
                "responsable": r["responsable"],
                "manos_levantadas": manos,
                "recursos_visitados": recursos,
                "anuncios_vistos": anuncios,
                "discusiones": discusiones,
                "encuesta_padres": r["encuesta_padres"],
                "satisfaccion_padres": r["satisfaccion_padres"],
                "ausencias": ausencias,
                "clase": clase,
                "puntaje_ordinal": puntaje_ord,
                "reprobado": reprobado,
                "sobresaliente": sobresaliente,
                "riesgo_desercion": riesgo,
                "indice_participacion": indice,
            }
            transformed.append(tuple(record_map[col] for col in ORDEN_DB))

        transformed.sort()
        registros = [(idx, *row) for idx, row in enumerate(transformed, start=1)]
        esperado_suma = sum(row[ORDEN_DB.index("puntaje_ordinal") + 1] for row in registros)
        columnas_sql = ", ".join(["id_registro", *ORDEN_DB])

        with get_cursor() as cur:
            conn = cur.connection
            try:
                cur.execute("TRUNCATE academico.rendimiento_estudiantes")
                execute_values(
                    cur,
                    f"INSERT INTO academico.rendimiento_estudiantes ({columnas_sql}) VALUES %s",
                    registros,
                    page_size=500,
                )
                cur.execute(
                    "SELECT count(*), coalesce(sum(puntaje_ordinal), 0) FROM academico.rendimiento_estudiantes"
                )
                row_check = cur.fetchone()
                en_bd = int(row_check["count"])
                suma_bd = int(row_check["coalesce"])
                if en_bd != len(registros) or suma_bd != esperado_suma:
                    raise RuntimeError("Conciliación post-carga fallida")

                cur.execute(
                    """
                    INSERT INTO academico.etl_control
                        (archivo_origen, filas_leidas, duplicados_detectados, duplicados_eliminados, filas_cargadas, estado)
                    VALUES (%s, %s, %s, 0, %s, 'OK')
                    RETURNING id_ejecucion
                    """,
                    (filename, total, duplicados, en_bd),
                )
                id_ej = int(cur.fetchone()["id_ejecucion"])
                conn.commit()
            except Exception:
                conn.rollback()
                raise

        repo = AcademicRepository()
        resumen = repo.fetch_view("v_resumen_general")[0]
        cw_ok = publish_kpi_metrics(resumen, origen=f"ingesta:{filename}")

        logger.info(
            "Ingesta ETL completada: archivo=%s filas=%d duplicados=%d id_ejecucion=%d cloudwatch=%s",
            filename,
            en_bd,
            duplicados,
            id_ej,
            cw_ok,
        )
        return {
            "estado": "OK",
            "id_ejecucion": id_ej,
            "archivo": filename,
            "filas_cargadas": en_bd,
            "duplicados_detectados": duplicados,
            "reglas_validadas": 36,
            "cloudwatch_publicado": cw_ok,
            "resumen": resumen,
        }

    def restore_original(self) -> dict[str, Any]:
        if not ORIGINAL_CSV_PATH.exists():
            raise FileNotFoundError(f"No se encontró el CSV original en {ORIGINAL_CSV_PATH}")
        return self.ingest_csv_bytes(ORIGINAL_CSV_PATH.read_bytes(), "xAPI-Edu-Data.csv")
