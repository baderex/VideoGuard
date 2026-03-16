import os
from contextlib import contextmanager
from typing import Optional

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool

DATABASE_URL = os.environ.get("DATABASE_URL", "")

_pool: Optional[pg_pool.ThreadedConnectionPool] = None


def get_conn():
    """Return a direct (non-pooled) connection — use only for schema/DDL migrations."""
    return psycopg2.connect(DATABASE_URL)


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(2, 20, DATABASE_URL)
    return _pool


@contextmanager
def get_cursor(commit=False):
    pool = _get_pool()
    conn = pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        pool.putconn(conn)
