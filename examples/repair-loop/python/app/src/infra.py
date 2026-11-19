"""PostgreSQL and Redis access and schema creation."""

import os
import time

import psycopg
import redis
from psycopg.rows import dict_row

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def connect_db() -> psycopg.Connection:
    """Open a PostgreSQL connection; rows come back as dicts."""
    return psycopg.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        row_factory=dict_row,
    )


redis_client = redis.Redis(
    host=os.environ["REDIS_HOST"],
    port=int(os.environ["REDIS_PORT"]),
    decode_responses=True,
)


def init_schema(timeout_s: float = 30.0) -> None:
    """Create the schema. Retry for about 30 seconds: PostgreSQL may still be starting."""
    deadline = time.monotonic() + timeout_s
    while True:
        try:
            with connect_db() as conn:
                conn.execute(SCHEMA)
            return
        except psycopg.OperationalError:
            if time.monotonic() > deadline:
                raise
            time.sleep(1)
