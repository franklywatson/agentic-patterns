"""Minimal FastAPI app that the repair loop repairs: users, login, health."""

import json
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import infra
from .auth import router as auth_router
from .health import router as health_router
from .routes.users import router as users_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    infra.init_schema()
    yield
    infra.redis_client.close()


app = FastAPI(lifespan=lifespan)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)


@app.exception_handler(Exception)
async def unhandled(request: Request, error: Exception) -> JSONResponse:
    """Log one structured line per unhandled error, then answer 500."""
    route = request.scope.get("route")
    path = re.sub(r"\{(\w+)\}", ":id", route.path if route else request.url.path)
    sqlstate = getattr(error, "sqlstate", None)
    error_class = f"pg:{sqlstate}" if sqlstate else type(error).__name__
    print(
        json.dumps(
            {
                "level": "error",
                "event": "unhandled_error",
                "route": f"{request.method} {path}",
                "status": 500,
                "errorClass": error_class,
            }
        ),
        flush=True,
    )
    return JSONResponse(status_code=500, content={"error": "Internal server error"})
