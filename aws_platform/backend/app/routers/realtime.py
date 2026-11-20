import asyncio
import json
import select
import psycopg2
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1", tags=["Tiempo Real"])


def _poll_notification(conn, timeout: float = 1.0) -> list[str]:
    if select.select([conn], [], [], timeout) == ([], [], []):
        return []
    conn.poll()
    payloads: list[str] = []
    while conn.notifies:
        notify = conn.notifies.pop(0)
        payloads.append(notify.payload or "{}")
    return payloads


@router.get("/stream")
async def stream_updates(request: Request):
    settings = get_settings()

    async def event_generator():
        conn = None
        try:
            conn = psycopg2.connect(
                host=settings.pghost,
                port=settings.pgport,
                dbname=settings.pgdatabase,
                user=settings.pguser,
                password=settings.pgpassword,
            )
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            with conn.cursor() as cur:
                cur.execute("LISTEN academico_actualizado;")

            yield f"event: connected\ndata: {json.dumps({'status': 'listening'})}\n\n"
            ticks = 0
            while not await request.is_disconnected():
                payloads = await asyncio.to_thread(_poll_notification, conn, 1.0)
                if payloads:
                    for payload in payloads:
                        yield f"event: update\ndata: {payload}\n\n"
                    ticks = 0
                else:
                    ticks += 1
                    if ticks >= 15:
                        yield ": keepalive\n\n"
                        ticks = 0
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
