import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

_DEFAULT_SECRET = "videoguard-industrial-secret-2026"
SECRET_KEY = os.environ.get("JWT_SECRET", "")
if not SECRET_KEY:
    import warnings
    warnings.warn(
        "\n\u26a0\ufe0f  JWT_SECRET environment variable is not set!\n"
        "   Using a weak default secret — this is INSECURE in production.\n"
        "   Set JWT_SECRET to a strong random value (32+ characters).",
        stacklevel=2,
    )
    SECRET_KEY = _DEFAULT_SECRET
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

_security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, role: str, site_id: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "site_id": site_id,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def _payload_to_user(payload: dict) -> dict:
    return {
        "id": int(payload["sub"]),
        "role": payload.get("role", "support"),
        "site_id": payload.get("site_id"),
    }


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        return _payload_to_user(payload)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def user_from_request(request: Request) -> Optional[dict]:
    return getattr(request.state, "user", None)


def site_filter_from_request(request: Request) -> Optional[int]:
    user = user_from_request(request)
    if user and user["role"] == "site_viewer":
        return user["site_id"]
    return None
