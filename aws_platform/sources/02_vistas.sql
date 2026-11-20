-- =====================================================================================
-- FASE 2 - Vistas SQL para los 10 requerimientos analíticos
-- Base de datos : momento3_powerbi        Esquema: academico
-- Origen        : academico.rendimiento_estudiantes (cargada por etl_rendimiento.py)
--
-- Cómo ejecutarlo en pgAdmin:
--   1. Clic derecho sobre la base momento3_powerbi -> Query Tool.
--   2. Abre este archivo (icono de carpeta) o pega todo su contenido.
--   3. Pulsa F5. Se puede ejecutar varias veces: recrea las vistas desde cero.
--   4. El último resultado (validación) debe mostrar "OK" en todas las filas.
--
-- Supuestos (el dataset NO trae estos datos, se derivan en el ETL):
--   * puntaje_ordinal : L=1, M=2, H=3 (no es una nota numérica real).
--   * facultad        : agrupación propuesta de las asignaturas.
--   * riesgo_desercion: clase L y más de 7 ausencias (proxy, no es deserción real).
--   * cohorte         : se aproxima con el grado escolar.
-- =====================================================================================

-- Borra la vista base y, en cascada, todas las que dependen de ella.
DROP VIEW IF EXISTS academico.v_base CASCADE;

-- -------------------------------------------------------------------------------------
-- Vista base: la tabla del ETL más etiquetas legibles para el dashboard
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_base AS
SELECT
    r.*,
    CASE r.genero WHEN 'F' THEN 'Femenino' WHEN 'M' THEN 'Masculino' END                        AS genero_etq,
    CASE r.nivel_educativo WHEN 'lowerlevel' THEN 'Primaria'
                           WHEN 'MiddleSchool' THEN 'Secundaria'
                           WHEN 'HighSchool' THEN 'Bachillerato' END                             AS nivel_etq,
    CASE r.semestre WHEN 'F' THEN 'Semestre 1' WHEN 'S' THEN 'Semestre 2' END                   AS semestre_etq,
    CASE r.clase WHEN 'L' THEN 'Bajo' WHEN 'M' THEN 'Medio' WHEN 'H' THEN 'Alto' END            AS clase_etq,
    CASE r.ausencias WHEN 'Under-7' THEN 'Menos de 7 ausencias'
                     WHEN 'Above-7' THEN 'Más de 7 ausencias' END                                AS ausencias_etq
FROM academico.rendimiento_estudiantes r;

-- -------------------------------------------------------------------------------------
-- Resumen general (KPIs de la primera página)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_resumen_general AS
SELECT
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    ROUND(100.0 * COUNT(*) FILTER (WHERE reprobado) / COUNT(*), 2)              AS pct_reprobados,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sobresaliente) / COUNT(*), 2)          AS pct_sobresalientes,
    ROUND(100.0 * COUNT(*) FILTER (WHERE riesgo_desercion) / COUNT(*), 2)       AS pct_riesgo_desercion,
    ROUND(AVG(indice_participacion), 4)                                         AS participacion_media
FROM academico.v_base;

-- -------------------------------------------------------------------------------------
-- Req. 1 - Promedio de notas por materia y semestre
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req01_promedio_materia_semestre AS
SELECT
    asignatura,
    semestre_etq                      AS semestre,
    COUNT(*)                          AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)    AS promedio_puntaje
FROM academico.v_base
GROUP BY asignatura, semestre_etq
ORDER BY asignatura, semestre_etq;

-- -------------------------------------------------------------------------------------
-- Req. 2 - Tasa de deserción por facultad (proxy: riesgo de deserción)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req02_desercion_facultad AS
SELECT
    facultad,
    COUNT(*)                                                                    AS estudiantes,
    COUNT(*) FILTER (WHERE riesgo_desercion)                                    AS en_riesgo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE riesgo_desercion) / COUNT(*), 2)       AS tasa_riesgo_pct
FROM academico.v_base
GROUP BY facultad
ORDER BY tasa_riesgo_pct DESC, facultad;

-- -------------------------------------------------------------------------------------
-- Req. 3 - Análisis de desempeño por género
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req03_desempeno_genero AS
SELECT
    genero_etq                                                                  AS genero,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    COUNT(*) FILTER (WHERE clase = 'L')                                         AS bajo,
    COUNT(*) FILTER (WHERE clase = 'M')                                         AS medio,
    COUNT(*) FILTER (WHERE clase = 'H')                                         AS alto,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2)            AS pct_bajo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2)            AS pct_medio,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2)            AS pct_alto
FROM academico.v_base
GROUP BY genero_etq
ORDER BY genero_etq;

-- -------------------------------------------------------------------------------------
-- Req. 4 - Comparativa de rendimiento entre programas (nivel educativo y grado)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req04_programas AS
SELECT
    nivel_etq                                                                   AS nivel_educativo,
    grado,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    COUNT(*) FILTER (WHERE clase = 'L')                                         AS bajo,
    COUNT(*) FILTER (WHERE clase = 'M')                                         AS medio,
    COUNT(*) FILTER (WHERE clase = 'H')                                         AS alto,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2)            AS pct_bajo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2)            AS pct_medio,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2)            AS pct_alto
FROM academico.v_base
GROUP BY nivel_etq, grado
ORDER BY nivel_etq, grado;

-- -------------------------------------------------------------------------------------
-- Req. 5 - Tendencias en rendimiento por semestre (solo hay dos semestres)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req05_semestre AS
SELECT
    semestre_etq                                                                AS semestre,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2)            AS pct_bajo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2)            AS pct_medio,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2)            AS pct_alto
FROM academico.v_base
GROUP BY semestre_etq
ORDER BY semestre_etq;

CREATE VIEW academico.v_req05_semestre_nivel AS
SELECT
    semestre_etq                                                                AS semestre,
    nivel_etq                                                                   AS nivel_educativo,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje
FROM academico.v_base
GROUP BY semestre_etq, nivel_etq
ORDER BY nivel_etq, semestre_etq;

-- -------------------------------------------------------------------------------------
-- Req. 6 - Top 10 de asignaturas con mayor reprobación (clase Bajo)
-- Se ordena por porcentaje de reprobación; el conteo desempata. Hay 12 asignaturas.
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req06_top10_reprobacion AS
SELECT posicion, asignatura, estudiantes, reprobados, pct_reprobacion
FROM (
    SELECT
        ROW_NUMBER() OVER (ORDER BY pct_reprobacion DESC, reprobados DESC, asignatura) AS posicion,
        asignatura, estudiantes, reprobados, pct_reprobacion
    FROM (
        SELECT
            asignatura,
            COUNT(*)                                                            AS estudiantes,
            COUNT(*) FILTER (WHERE reprobado)                                   AS reprobados,
            ROUND(100.0 * COUNT(*) FILTER (WHERE reprobado) / COUNT(*), 2)      AS pct_reprobacion
        FROM academico.v_base
        GROUP BY asignatura
    ) por_asignatura
) ranking
WHERE posicion <= 10
ORDER BY posicion;

-- -------------------------------------------------------------------------------------
-- Req. 7 - Relación entre asistencia (ausencias) y rendimiento
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req07_asistencia_rendimiento AS
SELECT
    ausencias_etq                                                               AS ausencias,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    ROUND(AVG(indice_participacion), 4)                                         AS participacion_media,
    COUNT(*) FILTER (WHERE clase = 'L')                                         AS bajo,
    COUNT(*) FILTER (WHERE clase = 'M')                                         AS medio,
    COUNT(*) FILTER (WHERE clase = 'H')                                         AS alto,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2)            AS pct_bajo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2)            AS pct_medio,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2)            AS pct_alto
FROM academico.v_base
GROUP BY ausencias_etq
ORDER BY ausencias_etq DESC;

-- -------------------------------------------------------------------------------------
-- Req. 8 - Estudiantes con desempeño sobresaliente (clase Alto)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req08_sobresalientes AS
SELECT
    id_registro,
    asignatura,
    facultad,
    nivel_etq                         AS nivel_educativo,
    grado,
    genero_etq                        AS genero,
    semestre_etq                      AS semestre,
    ausencias_etq                     AS ausencias,
    manos_levantadas,
    recursos_visitados,
    anuncios_vistos,
    discusiones,
    indice_participacion
FROM academico.v_base
WHERE sobresaliente
ORDER BY indice_participacion DESC, id_registro;

-- -------------------------------------------------------------------------------------
-- Req. 9 - Comparativa de resultados entre cohortes (cohorte = grado escolar)
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req09_cohortes AS
SELECT
    grado                                                                       AS cohorte_grado,
    COUNT(*)                                                                    AS estudiantes,
    ROUND(AVG(puntaje_ordinal), 2)                                              AS promedio_puntaje,
    COUNT(*) FILTER (WHERE clase = 'L')                                         AS bajo,
    COUNT(*) FILTER (WHERE clase = 'M')                                         AS medio,
    COUNT(*) FILTER (WHERE clase = 'H')                                         AS alto,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2)            AS pct_bajo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'M') / COUNT(*), 2)            AS pct_medio,
    ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2)            AS pct_alto
FROM academico.v_base
GROUP BY grado
ORDER BY grado;

-- -------------------------------------------------------------------------------------
-- Req. 10 - Factores que influyen en el éxito académico
-- Formato largo: cada fila es una categoría de un factor.
-- -------------------------------------------------------------------------------------
CREATE VIEW academico.v_req10_factores AS
SELECT 'Género' AS factor, genero_etq AS categoria,
       COUNT(*) AS estudiantes,
       ROUND(AVG(puntaje_ordinal), 2) AS promedio_puntaje,
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2) AS pct_alto,
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2) AS pct_bajo,
       ROUND(AVG(indice_participacion), 4) AS participacion_media
FROM academico.v_base GROUP BY genero_etq
UNION ALL
SELECT 'Nivel educativo', nivel_etq,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY nivel_etq
UNION ALL
SELECT 'Semestre', semestre_etq,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY semestre_etq
UNION ALL
SELECT 'Ausencias', ausencias_etq,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY ausencias_etq
UNION ALL
SELECT 'Encuesta de padres', encuesta_padres,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY encuesta_padres
UNION ALL
SELECT 'Satisfacción de padres', satisfaccion_padres,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY satisfaccion_padres
UNION ALL
SELECT 'Responsable', responsable,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY responsable
UNION ALL
SELECT 'Facultad', facultad,
       COUNT(*), ROUND(AVG(puntaje_ordinal), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'H') / COUNT(*), 2),
       ROUND(100.0 * COUNT(*) FILTER (WHERE clase = 'L') / COUNT(*), 2),
       ROUND(AVG(indice_participacion), 4)
FROM academico.v_base GROUP BY facultad;

-- Participación media (promedio de cada métrica) según el nivel de rendimiento
CREATE VIEW academico.v_req10_participacion_clase AS
SELECT
    clase_etq                                   AS clase,
    COUNT(*)                                    AS estudiantes,
    ROUND(AVG(manos_levantadas), 1)             AS manos_levantadas_media,
    ROUND(AVG(recursos_visitados), 1)           AS recursos_visitados_media,
    ROUND(AVG(anuncios_vistos), 1)              AS anuncios_vistos_media,
    ROUND(AVG(discusiones), 1)                  AS discusiones_media,
    ROUND(AVG(indice_participacion), 4)         AS participacion_media
FROM academico.v_base
GROUP BY clase_etq, puntaje_ordinal
ORDER BY puntaje_ordinal;

-- VALIDACION ----------------------------------------------------------------------
-- Los totales de las vistas que reparten a todos los estudiantes deben sumar lo mismo
-- que la tabla original. Todas las filas deben decir OK.
SELECT
    v.vista,
    v.total,
    (SELECT COUNT(*) FROM academico.rendimiento_estudiantes) AS esperado,
    CASE WHEN v.total = (SELECT COUNT(*) FROM academico.rendimiento_estudiantes) THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
    SELECT 'v_resumen_general'                   AS vista, SUM(estudiantes) AS total FROM academico.v_resumen_general
    UNION ALL SELECT 'v_req01_promedio_materia_semestre', SUM(estudiantes) FROM academico.v_req01_promedio_materia_semestre
    UNION ALL SELECT 'v_req02_desercion_facultad',        SUM(estudiantes) FROM academico.v_req02_desercion_facultad
    UNION ALL SELECT 'v_req03_desempeno_genero',          SUM(estudiantes) FROM academico.v_req03_desempeno_genero
    UNION ALL SELECT 'v_req04_programas',                 SUM(estudiantes) FROM academico.v_req04_programas
    UNION ALL SELECT 'v_req05_semestre',                  SUM(estudiantes) FROM academico.v_req05_semestre
    UNION ALL SELECT 'v_req05_semestre_nivel',            SUM(estudiantes) FROM academico.v_req05_semestre_nivel
    UNION ALL SELECT 'v_req07_asistencia_rendimiento',    SUM(estudiantes) FROM academico.v_req07_asistencia_rendimiento
    UNION ALL SELECT 'v_req09_cohortes',                  SUM(estudiantes) FROM academico.v_req09_cohortes
    UNION ALL SELECT 'v_req10_participacion_clase',       SUM(estudiantes) FROM academico.v_req10_participacion_clase
) v
ORDER BY v.vista;
