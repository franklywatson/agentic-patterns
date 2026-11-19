import hashlib
import hmac
import secrets

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import infra

SESSION_TTL_SECONDS = 3600
router = APIRouter()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split(":")
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(digest.hex(), digest_hex)


class Login(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: Login):
    with infra.connect_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = %s", (body.email,)
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        return JSONResponse(status_code=401, content={"error": "Invalid credentials"})
    token = secrets.token_hex(24)
    infra.redis_client.set(f"session:{token}", str(row["id"]), ex=SESSION_TTL_SECONDS)
    return {"token": token, "userId": str(row["id"]), "expiresIn": SESSION_TTL_SECONDS}
