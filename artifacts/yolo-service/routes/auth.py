import time
import threading
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator
from typing import Optional

from db import get_cursor
from auth_utils import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth")

_rate_lock = threading.Lock()
_attempts: dict = defaultdict(list)
_WINDOW_SECS = 60
_MAX_ATTEMPTS = 10


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    with _rate_lock:
        window = [t for t in _attempts[ip] if now - t < _WINDOW_SECS]
        _attempts[ip] = window
        if len(window) >= _MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please wait a minute and try again.",
            )
        _attempts[ip].append(now)


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Invalid username")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if not v or len(v) > 200:
            raise ValueError("Invalid password")
        return v


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
def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
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
