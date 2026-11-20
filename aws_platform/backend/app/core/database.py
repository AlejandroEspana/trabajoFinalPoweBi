from contextlib import contextmanager
from decimal import Decimal
from datetime import datetime, date
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from app.core.config import get_settings

_pool: ThreadedConnectionPool | None = None


def init_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=settings.pghost,
            port=settings.pgport,
            dbname=settings.pgdatabase,
            user=settings.pguser,
            password=settings.pgpassword,
            options="-c client_encoding=UTF8",
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


def _normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: _normalize_value(v) for k, v in row.items()} for row in rows]


@contextmanager
def get_cursor():
    pool = init_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    finally:
        pool.putconn(conn)
