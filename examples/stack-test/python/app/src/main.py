"""Minimal FastAPI app under test: users, auth, audit log, notifications, health.

Backed by real PostgreSQL and Redis. Demo-only shortcuts: the /admin/*
endpoints are unauthenticated and JWT_SECRET has a fixed fallback value.
"""

import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import jwt
import psycopg
from fastapi import FastAPI, Header
from fastapi.responses import JSONResponse
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from . import infra

TOKEN_TTL_SECONDS = 3600


@asynccontextmanager
async def lifespan(_: FastAPI):
    infra.init_schema()
    yield


app = FastAPI(lifespan=lifespan)


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


def user_view(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "username": row["username"],
        "created_at": row["created_at"].isoformat(),
    }


# --- health -----------------------------------------------------------------


def probe_db() -> dict:
    started = time.perf_counter()
    with infra.connect_db() as conn:
        version = conn.execute("SHOW server_version").fetchone()["server_version"]
    return {"connected": True, "version": version,
            "latency_ms": round((time.perf_counter() - started) * 1000)}


def probe_cache() -> dict:
    started = time.perf_counter()
    client = infra.connect_redis()
    version = client.info("server")["redis_version"]
    client.ping()
    return {"connected": True, "version": version,
            "latency_ms": round((time.perf_counter() - started) * 1000)}


@app.get("/health")
def health(mode: str | None = None):
    """Overall health. `?mode=test` adds per-service diagnostics (Pattern 1.1)."""
    db, cache = probe_db(), probe_cache()
    body = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {"app": "healthy", "database": "healthy", "cache": "healthy"},
    }
    if mode == "test":
        body["details"] = {"postgres": db, "redis": cache}
        body["env"] = "test"
    return body


@app.get("/health/db")
def health_db():
    db = probe_db()
    return {"database": "connected", "postgres": {"version": db["version"]}}


@app.get("/health/cache")
def health_cache():
    cache = probe_cache()
    return {"cache": "connected", "redis": {"version": cache["version"]}}


# --- users ------------------------------------------------------------------


class NewUser(BaseModel):
    email: str
    username: str
    password: str


class Login(BaseModel):
    email: str
    password: str


class UserPatch(BaseModel):
    email: str | None = None
    username: str | None = None


def current_user_id(authorization: str | None) -> str | None:
    """Return the user id for a valid Bearer token with a live Redis session."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    try:
        claims = jwt.decode(token, infra.JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None
    if infra.connect_redis().get(f"session:{claims['jti']}") != claims["sub"]:
        return None
    return claims["sub"]


@app.post("/users", status_code=201)
def create_user(payload: NewUser):
    user_id = str(uuid.uuid4())
    try:
        with infra.connect_db() as conn:
            row = conn.execute(
                "INSERT INTO users (id, email, username, password_hash) "
                "VALUES (%s, %s, %s, %s) RETURNING id, email, username, created_at",
                (user_id, payload.email, payload.username,
                 infra.hash_password(payload.password)),
            ).fetchone()
            conn.execute(
                "INSERT INTO audit_log (action, entity_type, entity_id, metadata) "
                "VALUES ('USER_CREATED', 'user', %s, %s)",
                (user_id, Jsonb({"email": payload.email, "username": payload.username})),
            )
            conn.execute(
                "INSERT INTO notifications (event_type, recipient, template_id, variables) "
                "VALUES ('USER_CREATED', %s, 'welcome-email', %s)",
                (payload.email, Jsonb({"username": payload.username})),
            )
    except psycopg.errors.UniqueViolation:
        return error(409, "A user with this email already exists")
    return JSONResponse(status_code=201, content=user_view(row))


@app.get("/users")
def list_users():
    with infra.connect_db() as conn:
        rows = conn.execute(
            "SELECT id, email, username, created_at FROM users ORDER BY created_at"
        ).fetchall()
    return {"users": [user_view(r) for r in rows]}


@app.get("/users/me")
def get_me(authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    if user_id is None:
        return error(401, "Authentication required")
    return fetch_user(user_id)


def fetch_user(user_id: str):
    with infra.connect_db() as conn:
        row = conn.execute(
            "SELECT id, email, username, created_at FROM users WHERE id = %s",
            (user_id,),
        ).fetchone()
    if row is None:
        return error(404, "User not found")
    return user_view(row)


@app.get("/users/{user_id}")
def get_user(user_id: str):
    return fetch_user(user_id)


@app.patch("/users/{user_id}")
def update_user(user_id: str, payload: UserPatch,
                authorization: str | None = Header(default=None)):
    caller = current_user_id(authorization)
    if caller is None:
        return error(401, "Authentication required")
    if caller != user_id:
        return error(403, "Cannot modify another user")
    try:
        with infra.connect_db() as conn:
            row = conn.execute(
                "UPDATE users SET email = COALESCE(%s, email), "
                "username = COALESCE(%s, username) WHERE id = %s "
                "RETURNING id, email, username, created_at",
                (payload.email, payload.username, user_id),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        return error(409, "A user with this email already exists")
    if row is None:
        return error(404, "User not found")
    return user_view(row)


# --- auth -------------------------------------------------------------------


@app.post("/auth/login")
def login(payload: Login):
    with infra.connect_db() as conn:
        row = conn.execute(
            "SELECT id, email, username, password_hash FROM users WHERE email = %s",
            (payload.email,),
        ).fetchone()
        if row is None or not infra.verify_password(payload.password, row["password_hash"]):
            return error(401, "Invalid credentials")
        conn.execute(
            "INSERT INTO audit_log (action, entity_type, entity_id, metadata) "
            "VALUES ('USER_LOGIN', 'user', %s, %s)",
            (row["id"], Jsonb({"email": row["email"], "username": row["username"]})),
        )
    jti = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(seconds=TOKEN_TTL_SECONDS)
    token = jwt.encode(
        {"sub": row["id"], "jti": jti, "exp": expires}, infra.JWT_SECRET, algorithm="HS256"
    )
    infra.connect_redis().set(f"session:{jti}", row["id"], ex=TOKEN_TTL_SECONDS)
    return {"token": token, "userId": row["id"], "expiresIn": TOKEN_TTL_SECONDS}


# --- admin (unauthenticated: demo only) -------------------------------------


@app.get("/admin/audit/users")
def audit_users():
    with infra.connect_db() as conn:
        rows = conn.execute(
            "SELECT action, entity_type, entity_id, metadata, created_at "
            "FROM audit_log ORDER BY id"
        ).fetchall()
    return {"entries": [
        {"action": r["action"], "entity_type": r["entity_type"],
         "entity_id": r["entity_id"], "metadata": r["metadata"],
         "timestamp": r["created_at"].isoformat()} for r in rows
    ]}


@app.get("/admin/notifications")
def notifications():
    with infra.connect_db() as conn:
        rows = conn.execute(
            "SELECT event_type, recipient, template_id, variables, created_at "
            "FROM notifications ORDER BY id"
        ).fetchall()
    return {"notifications": [
        {"eventType": r["event_type"], "recipient": r["recipient"],
         "templateId": r["template_id"], "variables": r["variables"],
         "timestamp": r["created_at"].isoformat()} for r in rows
    ]}
