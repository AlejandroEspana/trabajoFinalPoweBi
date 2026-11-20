"""ETL Fase 1 - Rendimiento académico (xAPI-Edu-Data) -> PostgreSQL.

Flujo:
    1. EXTRACT   : lee el CSV con PySpark (todo como texto, para poder validar antes de convertir).
    2. VALIDATE  : nulos/vacíos, tipos, rangos, dominios de categorías y duplicados.
    3. TRANSFORM : renombra columnas, convierte tipos y crea variables derivadas.
    4. LOAD      : carga en PostgreSQL dentro de UNA transacción y concilia lo cargado.

Si hay errores de calidad el proceso se detiene ANTES de tocar la base de datos.

Origen del archivo (lo deja descargado descarga_kaggle.py con Selenium):
    - Sin argumentos: toma el .zip más reciente de Downloads (archive*.zip), extrae el CSV
      a la carpeta "datos" (junto a este script) y lo procesa.
    - Con --csv: acepta la ruta de un .zip (lo extrae) o de un .csv (lo lee directo).

Dependencias:  pip install pyspark psycopg2-binary   (y tener Java instalado)

Ejemplos:
    python etl_rendimiento.py --solo-validar
    python etl_rendimiento.py --csv "C:/Users/tu_usuario/Downloads/archive.zip"
    python etl_rendimiento.py --csv datos/xAPI-Edu-Data.csv --duplicados eliminar

Conexión (variables de entorno, ninguna contraseña va en el código):
    PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
"""

import argparse
import logging
import os
import sys
import zipfile
from pathlib import Path

from pyspark.sql import SparkSession, functions as F

log = logging.getLogger("etl_rendimiento")

# --------------------------------------------------------------------------------------
# RUTAS
# --------------------------------------------------------------------------------------
# Donde Chrome (Selenium) deja el zip descargado de Kaggle.
CARPETA_DESCARGAS = Path.home() / "Downloads"
PATRON_ZIP = "archive*.zip"  # Kaggle lo nombra archive.zip (o "archive (1).zip" si ya existía)
# Donde se extrae el CSV para el ETL, junto a este script.
CARPETA_DATOS = Path(__file__).resolve().parent / "datos"

# --------------------------------------------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------------------------------------------
FILAS_ESPERADAS = 480  # tamaño documentado de xAPI-Edu-Data (solo genera una advertencia)
ESQUEMA = "academico"
TABLA = f"{ESQUEMA}.rendimiento_estudiantes"
TABLA_CONTROL = f"{ESQUEMA}.etl_control"

# (columna en el CSV, nombre en la base de datos, tipo)
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
NUMERICAS = [destino for _, destino, tipo in COLUMNAS if tipo == "entero"]

# Facultad: el dataset NO la trae. Es una agrupación propuesta (supuesto documentado).
# Edítala aquí si tu docente define otra. También sirve como dominio válido de "asignatura".
FACULTADES = {
    "Biology": "Ciencias", "Chemistry": "Ciencias", "Geology": "Ciencias", "Science": "Ciencias",
    "Arabic": "Humanidades y Lenguas", "English": "Humanidades y Lenguas",
    "French": "Humanidades y Lenguas", "Spanish": "Humanidades y Lenguas",
    "History": "Humanidades y Lenguas", "Quran": "Humanidades y Lenguas",
    "Math": "Matemáticas y Tecnología", "IT": "Matemáticas y Tecnología",
}

# Valores permitidos por columna categórica.
DOMINIOS = {
    "genero": ["M", "F"],
    "nivel_educativo": ["lowerlevel", "MiddleSchool", "HighSchool"],
    "seccion": ["A", "B", "C"],
    "asignatura": list(FACULTADES),
    "semestre": ["F", "S"],
    "responsable": ["Father", "Mum"],
    "encuesta_padres": ["Yes", "No"],
    "satisfaccion_padres": ["Good", "Bad"],
    "ausencias": ["Under-7", "Above-7"],
    "clase": ["L", "M", "H"],
}
PATRON_GRADO = r"^G-(0[1-9]|1[0-2])$"

# Orden de columnas que se inserta en la base (después de id_registro).
ORDEN_DB = [
    "genero", "nacionalidad", "lugar_nacimiento", "nivel_educativo", "grado", "seccion",
    "asignatura", "facultad", "semestre", "responsable", "manos_levantadas",
    "recursos_visitados", "anuncios_vistos", "discusiones", "encuesta_padres",
    "satisfaccion_padres", "ausencias", "clase", "puntaje_ordinal", "reprobado",
    "sobresaliente", "riesgo_desercion", "indice_participacion",
]

DDL = f"""
CREATE SCHEMA IF NOT EXISTS {ESQUEMA};

CREATE TABLE IF NOT EXISTS {TABLA} (
    id_registro          INTEGER PRIMARY KEY,
    genero               CHAR(1)      NOT NULL CHECK (genero IN ('M','F')),
    nacionalidad         TEXT         NOT NULL,
    lugar_nacimiento     TEXT         NOT NULL,
    nivel_educativo      TEXT         NOT NULL CHECK (nivel_educativo IN ('lowerlevel','MiddleSchool','HighSchool')),
    grado                TEXT         NOT NULL,
    seccion              CHAR(1)      NOT NULL CHECK (seccion IN ('A','B','C')),
    asignatura           TEXT         NOT NULL,
    facultad             TEXT         NOT NULL,
    semestre             CHAR(1)      NOT NULL CHECK (semestre IN ('F','S')),
    responsable          TEXT         NOT NULL CHECK (responsable IN ('Father','Mum')),
    manos_levantadas     SMALLINT     NOT NULL CHECK (manos_levantadas BETWEEN 0 AND 100),
    recursos_visitados   SMALLINT     NOT NULL CHECK (recursos_visitados BETWEEN 0 AND 100),
    anuncios_vistos      SMALLINT     NOT NULL CHECK (anuncios_vistos BETWEEN 0 AND 100),
    discusiones          SMALLINT     NOT NULL CHECK (discusiones BETWEEN 0 AND 100),
    encuesta_padres      TEXT         NOT NULL CHECK (encuesta_padres IN ('Yes','No')),
    satisfaccion_padres  TEXT         NOT NULL CHECK (satisfaccion_padres IN ('Good','Bad')),
    ausencias            TEXT         NOT NULL CHECK (ausencias IN ('Under-7','Above-7')),
    clase                CHAR(1)      NOT NULL CHECK (clase IN ('L','M','H')),
    puntaje_ordinal      SMALLINT     NOT NULL CHECK (puntaje_ordinal BETWEEN 1 AND 3),
    reprobado            BOOLEAN      NOT NULL,
    sobresaliente        BOOLEAN      NOT NULL,
    riesgo_desercion     BOOLEAN      NOT NULL,
    indice_participacion NUMERIC(5,4) NOT NULL CHECK (indice_participacion BETWEEN 0 AND 1),
    fecha_carga          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {TABLA_CONTROL} (
    id_ejecucion          SERIAL PRIMARY KEY,
    fecha_ejecucion       TIMESTAMPTZ NOT NULL DEFAULT now(),
    archivo_origen        TEXT        NOT NULL,
    filas_leidas          INTEGER     NOT NULL,
    duplicados_detectados INTEGER     NOT NULL,
    duplicados_eliminados INTEGER     NOT NULL,
    filas_cargadas        INTEGER     NOT NULL,
    estado                TEXT        NOT NULL
);
"""


# --------------------------------------------------------------------------------------
# 1. EXTRACT
# --------------------------------------------------------------------------------------
def extraer_zip(ruta_zip):
    """Extrae el CSV del zip a CARPETA_DATOS y devuelve su ruta."""
    with zipfile.ZipFile(ruta_zip) as zf:
        csvs = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if len(csvs) != 1:
            raise ValueError(f"Se esperaba 1 CSV dentro de {ruta_zip.name} y hay {len(csvs)}: {csvs}")
        CARPETA_DATOS.mkdir(parents=True, exist_ok=True)
        destino = CARPETA_DATOS / Path(csvs[0]).name  # solo el nombre: ignora subcarpetas del zip
        with zf.open(csvs[0]) as origen, open(destino, "wb") as salida:
            salida.write(origen.read())
    log.info("CSV extraído de %s -> %s", ruta_zip.name, destino)
    return destino


def preparar_csv(argumento):
    """Devuelve la ruta del CSV a procesar, extrayendo el zip si hace falta."""
    if argumento:
        ruta = Path(argumento)
        if not ruta.exists():
            raise FileNotFoundError(f"No existe: {ruta}")
        return extraer_zip(ruta) if ruta.suffix.lower() == ".zip" else ruta

    zips = sorted(CARPETA_DESCARGAS.glob(PATRON_ZIP), key=lambda p: p.stat().st_mtime, reverse=True)
    if zips:
        return extraer_zip(zips[0])  # el más reciente

    csvs = sorted(CARPETA_DATOS.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    if csvs:
        log.warning("No hay zip en %s; se usa el CSV ya extraído: %s", CARPETA_DESCARGAS, csvs[0])
        return csvs[0]
    raise FileNotFoundError(
        f"No se encontró {PATRON_ZIP} en {CARPETA_DESCARGAS} ni un CSV en {CARPETA_DATOS}. "
        "Ejecuta primero descarga_kaggle.py o usa --csv."
    )


def crear_spark():
    if os.environ.get("JAVA_HOME"):
        os.environ["JAVA_HOME"] = os.environ["JAVA_HOME"].rstrip("\\/")
    spark = (
        SparkSession.builder.master("local[2]").appName("ETL rendimiento academico")
        .config("spark.ui.enabled", "false")
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.driver.bindAddress", "127.0.0.1")
        .config("spark.sql.ansi.enabled", "false")  # un cast inválido da NULL en vez de abortar
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def extraer(spark, ruta):
    """Lee el CSV como texto y verifica que las columnas sean exactamente las esperadas."""
    if not ruta.exists():
        raise FileNotFoundError(f"No existe el archivo de origen: {ruta}")
    crudo = spark.read.option("header", True).option("mode", "FAILFAST").csv(ruta.as_posix())
    # Quita un posible BOM o espacios en los nombres de columna.
    crudo = crudo.toDF(*[c.replace("\ufeff", "").strip() for c in crudo.columns])

    esperadas = {origen for origen, _, _ in COLUMNAS}
    faltan = esperadas - set(crudo.columns)
    sobran = set(crudo.columns) - esperadas
    if faltan or sobran:
        raise ValueError(f"Columnas distintas a xAPI-Edu-Data. Faltan: {sorted(faltan)}. Sobran: {sorted(sobran)}")
    return crudo.select(*[F.col(origen).alias(destino) for origen, destino, _ in COLUMNAS])


def limpiar(df):
    """Recorta espacios y convierte cadenas vacías en NULL, para que se detecten como nulos."""
    return df.select(*[
        F.when(F.trim(F.col(c)) == "", F.lit(None)).otherwise(F.trim(F.col(c))).alias(c)
        for c in df.columns
    ])


# --------------------------------------------------------------------------------------
# 2. VALIDATE
# --------------------------------------------------------------------------------------
def reglas_de_calidad():
    """Cada regla es (descripción, condición que es True cuando la fila VIOLA la regla)."""
    reglas = []
    for _, destino, _ in COLUMNAS:
        reglas.append((f"{destino}: valores nulos o vacíos", F.col(destino).isNull()))
    for c in NUMERICAS:
        es_entero = F.col(c).rlike(r"^\d+$")
        reglas.append((f"{c}: no es un entero", F.col(c).isNotNull() & ~es_entero))
        reglas.append((f"{c}: fuera del rango 0-100", es_entero & ~F.col(c).cast("int").between(0, 100)))
    for c, validos in DOMINIOS.items():
        reglas.append((f"{c}: valor fuera de {validos}", F.col(c).isNotNull() & ~F.col(c).isin(*validos)))
    reglas.append(("grado: formato distinto de G-NN", F.col("grado").isNotNull() & ~F.col("grado").rlike(PATRON_GRADO)))
    return reglas


def validar(df, total):
    """Devuelve (errores, advertencias, filas_duplicadas_sobrantes)."""
    errores, advertencias = [], []

    if total == 0:
        return ["El archivo no contiene filas"], advertencias, 0
    if total != FILAS_ESPERADAS:
        advertencias.append(f"Se esperaban {FILAS_ESPERADAS} filas y llegaron {total}")

    reglas = reglas_de_calidad()
    agregados = [F.sum(F.coalesce(cond, F.lit(False)).cast("int")).alias(f"r{i}") for i, (_, cond) in enumerate(reglas)]
    fila = df.agg(*agregados).first()
    for i, (descripcion, _) in enumerate(reglas):
        violaciones = int(fila[f"r{i}"] or 0)
        if violaciones:
            errores.append(f"{descripcion} -> {violaciones} fila(s)")
    log.info("Reglas evaluadas: %d | con hallazgos: %d", len(reglas), len(errores))

    # Duplicados exactos. Sin identificador de estudiante, dos filas idénticas pueden ser
    # personas distintas con las mismas respuestas: por eso solo se advierte (o se elimina por opción).
    sobrantes = total - df.dropDuplicates().count()
    if sobrantes:
        grupos = df.groupBy(*df.columns).count().filter("count > 1").count()
        advertencias.append(f"{sobrantes} fila(s) duplicada(s) exactas en {grupos} grupo(s)")
    return errores, advertencias, sobrantes


# --------------------------------------------------------------------------------------
# 3. TRANSFORM
# --------------------------------------------------------------------------------------
def transformar(df):
    """Convierte tipos y crea variables derivadas (proxies documentados)."""
    for c in NUMERICAS:
        df = df.withColumn(c, F.col(c).cast("int"))

    mapa_facultad = F.create_map(*[x for k, v in FACULTADES.items() for x in (F.lit(k), F.lit(v))])
    suma_participacion = sum(F.col(c) for c in NUMERICAS)
    return (
        df.withColumn("facultad", mapa_facultad[F.col("asignatura")])
        # L=1, M=2, H=3: escala ordinal, sin inventar una nota numérica que el dataset no tiene.
        .withColumn("puntaje_ordinal", F.when(F.col("clase") == "H", 3).when(F.col("clase") == "M", 2).otherwise(1).cast("int"))
        .withColumn("reprobado", F.col("clase") == "L")
        .withColumn("sobresaliente", F.col("clase") == "H")
        # Proxy de deserción: bajo rendimiento y más de 7 ausencias. NO es deserción real.
        .withColumn("riesgo_desercion", (F.col("clase") == "L") & (F.col("ausencias") == "Above-7"))
        # Promedio de las 4 métricas de participación, escalado de 0 a 1.
        .withColumn("indice_participacion", F.round(suma_participacion / F.lit(400.0), 4))
    )


def a_registros(df):
    """Trae los datos al driver (480 filas) con un id estable, ordenado de forma determinista."""
    filas = df.select(*ORDEN_DB).orderBy(*ORDEN_DB).collect()
    return [(i, *tuple(fila)) for i, fila in enumerate(filas, start=1)]


# --------------------------------------------------------------------------------------
# 4. LOAD
# --------------------------------------------------------------------------------------
def cargar_postgres(registros, resumen, archivo):
    import psycopg2  # se importa aquí para que --solo-validar funcione sin PostgreSQL
    from psycopg2.extras import execute_values

    conexion = psycopg2.connect(
        host=os.getenv("PGHOST", "127.0.0.1"),
        port=os.getenv("PGPORT", "55432"),
        dbname=os.getenv("PGDATABASE", "momento3_powerbi"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD"),
    )
    columnas = ", ".join(["id_registro", *ORDEN_DB])
    esperado_suma = sum(r[ORDEN_DB.index("puntaje_ordinal") + 1] for r in registros)
    try:
        with conexion:  # una sola transacción: si algo falla, se hace rollback completo
            with conexion.cursor() as cur:
                cur.execute(DDL)
                cur.execute(f"TRUNCATE {TABLA}")
                execute_values(cur, f"INSERT INTO {TABLA} ({columnas}) VALUES %s", registros, page_size=500)

                # Conciliación: lo que quedó en la base debe coincidir con lo que se envió.
                cur.execute(f"SELECT count(*), coalesce(sum(puntaje_ordinal), 0) FROM {TABLA}")
                en_bd, suma_bd = cur.fetchone()
                if en_bd != len(registros) or suma_bd != esperado_suma:
                    raise RuntimeError(
                        f"Conciliación fallida: enviadas={len(registros)}/{esperado_suma}, en BD={en_bd}/{suma_bd}"
                    )
                cur.execute(
                    f"INSERT INTO {TABLA_CONTROL} (archivo_origen, filas_leidas, duplicados_detectados, "
                    f"duplicados_eliminados, filas_cargadas, estado) VALUES (%s, %s, %s, %s, %s, 'OK')",
                    (archivo, resumen["leidas"], resumen["duplicados"], resumen["eliminados"], en_bd),
                )
    finally:
        conexion.close()
    log.info("Carga completa: %d filas en %s (conciliación OK)", len(registros), TABLA)


# --------------------------------------------------------------------------------------
# ORQUESTACIÓN
# --------------------------------------------------------------------------------------
def leer_argumentos():
    parser = argparse.ArgumentParser(description="ETL de rendimiento académico hacia PostgreSQL")
    parser.add_argument(
        "--csv", default=os.getenv("CSV_PATH"),
        help="ruta de un .zip o .csv; si se omite, usa el zip más reciente de Downloads",
    )
    parser.add_argument(
        "--duplicados", choices=["conservar", "eliminar"], default="conservar",
        help="qué hacer con filas idénticas (por defecto solo se reportan)",
    )
    parser.add_argument("--solo-validar", action="store_true", help="valida y transforma, pero no carga a PostgreSQL")
    return parser.parse_args()


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s", datefmt="%H:%M:%S")
    args = leer_argumentos()
    ruta = preparar_csv(args.csv)

    spark = crear_spark()
    try:
        log.info("1/4 Extrayendo %s", ruta)
        limpio = limpiar(extraer(spark, ruta)).cache()
        total = limpio.count()
        log.info("Filas leídas: %d", total)

        log.info("2/4 Validando calidad de datos")
        errores, advertencias, sobrantes = validar(limpio, total)
        for aviso in advertencias:
            log.warning("ADVERTENCIA: %s", aviso)
        if errores:
            for error in errores:
                log.error("ERROR: %s", error)
            log.error("Validación fallida: no se cargó nada a PostgreSQL.")
            return 1

        eliminados = 0
        if args.duplicados == "eliminar" and sobrantes:
            limpio = limpio.dropDuplicates()
            eliminados = sobrantes
            log.info("Duplicados eliminados: %d", eliminados)

        log.info("3/4 Transformando")
        registros = a_registros(transformar(limpio))
    finally:
        spark.stop()

    resumen = {"leidas": total, "duplicados": sobrantes, "eliminados": eliminados}
    if args.solo_validar:
        log.info("Modo --solo-validar: %d filas listas, sin cargar a PostgreSQL.", len(registros))
        return 0

    log.info("4/4 Cargando en PostgreSQL")
    cargar_postgres(registros, resumen, ruta.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
