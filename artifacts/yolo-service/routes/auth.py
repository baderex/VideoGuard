from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from db import get_cursor
from auth_utils import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth")


class LoginRequest(BaseModel):
    username: str
    password: str


def _safe_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row.get("email"),
        "role": row["role"],
        "siteId": row.get("site_id"),
        "siteName": row.get("site_name"),
    }


@router.post("/login")
def login(req: LoginRequest):
    with get_cursor() as cur:
        cur.execute(
            """SELECT u.*, s.name AS site_name
               FROM users u
               LEFT JOIN sites s ON s.id = u.site_id
               WHERE u.username = %s AND u.active = true""",
            (req.username,),
        )
        user = cur.fetchone()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user["id"], user["role"], user.get("site_id"))
    return {"token": token, "user": _safe_user(dict(user))}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    with get_cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.role, u.site_id, s.name AS site_name
               FROM users u
               LEFT JOIN sites s ON s.id = u.site_id
               WHERE u.id = %s AND u.active = true""",
            (current_user["id"],),
        )
        user = cur.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return _safe_user(dict(user))
