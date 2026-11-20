-- Trigger de notificaciones en tiempo real (PostgreSQL LISTEN/NOTIFY)
-- Dispara un único evento por sentencia (INSERT/UPDATE/DELETE/TRUNCATE)
-- para que FastAPI (SSE) actualice el frontend web automáticamente.

CREATE OR REPLACE FUNCTION academico.notificar_cambio_rendimiento()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'academico_actualizado',
        json_build_object(
            'tabla', TG_TABLE_NAME,
            'operacion', TG_OP,
            'timestamp', now()
        )::text
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_rendimiento ON academico.rendimiento_estudiantes;

CREATE TRIGGER trg_notificar_rendimiento
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
ON academico.rendimiento_estudiantes
FOR EACH STATEMENT
EXECUTE FUNCTION academico.notificar_cambio_rendimiento();
