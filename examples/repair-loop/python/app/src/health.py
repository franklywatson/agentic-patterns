import time

from fastapi import APIRouter

from . import infra

router = APIRouter()


@router.get("/health")
def health(mode: str | None = None):
    """`?mode=test` and `?mode=prod` add per-dependency state."""
    body: dict = {"status": "ok", "version": "1.0.0"}
    if mode in ("test", "prod"):
        started = time.perf_counter()
        with infra.connect_db() as conn:
            conn.execute("SELECT 1")
        postgres_ms = round((time.perf_counter() - started) * 1000)
        started = time.perf_counter()
        infra.redis_client.ping()
        redis_ms = round((time.perf_counter() - started) * 1000)
        body["services"] = {
            "postgres": {"connected": True, "latency_ms": postgres_ms},
            "redis": {"connected": True, "latency_ms": redis_ms},
        }
    return body
