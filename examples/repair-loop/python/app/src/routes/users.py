import uuid

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import infra
from ..auth import hash_password

router = APIRouter()


class NewUser(BaseModel):
    email: str
    username: str
    password: str


def view(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "username": row["username"],
        "createdAt": row["created_at"].isoformat(),
    }


@router.post("/users", status_code=201)
def create_user(body: NewUser):
    with infra.connect_db() as conn:
        row = conn.execute(
            """INSERT INTO users (id, email, username, password_hash) VALUES (%s, %s, %s, %s)
               ON CONFLICT (email) DO NOTHING RETURNING id, email, username, created_at""",
            (str(uuid.uuid4()), body.email, body.username, hash_password(body.password)),
        ).fetchone()
    if row is None:
        return JSONResponse(status_code=409, content={"error": "Email already exists"})
    return view(row)


@router.get("/users/{id}")
def get_user(id: str):
    with infra.connect_db() as conn:
        row = conn.execute(
            "SELECT id, email, username, created_at FROM users WHERE id = %s", (id,)
        ).fetchone()
    if row is None:
        return JSONResponse(status_code=404, content={"error": "User not found"})
    return view(row)
