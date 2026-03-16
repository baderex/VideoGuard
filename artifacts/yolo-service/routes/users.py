from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from db import get_cursor
from auth_utils import require_admin, hash_password

router = APIRouter(prefix="/api/users")

VALID_ROLES = {"admin", "support", "site_viewer"}


class CreateUserRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str
    site_id: Optional[int] = None


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    site_id: Optional[int] = None
    active: Optional[bool] = None


def _user_dict(row: dict) -> dict:
    d = dict(row)
    d["siteId"] = d.pop("site_id", None)
    d["siteName"] = d.pop("site_name", None)
    d["createdAt"] = d.pop("created_at", None)
    if d["createdAt"] and hasattr(d["createdAt"], "isoformat"):
        d["createdAt"] = d["createdAt"].isoformat()
    d.pop("password_hash", None)
    return d


@router.get("")
def list_users(admin: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.username, u.email, u.role, u.site_id,
                   u.active, u.created_at, s.name AS site_name
            FROM users u
            LEFT JOIN sites s ON s.id = u.site_id
            ORDER BY u.id
        """)
        users = [_user_dict(dict(r)) for r in cur.fetchall()]
    return {"users": users, "total": len(users)}


@router.post("")
def create_user(req: CreateUserRequest, admin: dict = Depends(require_admin)):
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    if req.role == "site_viewer" and not req.site_id:
        raise HTTPException(status_code=400, detail="site_id is required for site_viewer role")

    hashed = hash_password(req.password)
    try:
        with get_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO users (username, email, password_hash, role, site_id)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (req.username, req.email, hashed, req.role, req.site_id),
            )
            new_id = cur.fetchone()["id"]
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Username already exists")
        raise HTTPException(status_code=500, detail=str(e))

    return {"id": new_id, "message": "User created"}


@router.put("/{user_id}")
def update_user(user_id: int, req: UpdateUserRequest, admin: dict = Depends(require_admin)):
    updates: dict = {}
    if req.email is not None:
        updates["email"] = req.email
    if req.password is not None:
        updates["password_hash"] = hash_password(req.password)
    if req.role is not None:
        if req.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = req.role
    if req.site_id is not None:
        updates["site_id"] = req.site_id
    if req.active is not None:
        updates["active"] = req.active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    with get_cursor(commit=True) as cur:
        cur.execute(
            f"UPDATE users SET {set_clause} WHERE id = %s",
            (*updates.values(), user_id),
        )
    return {"message": "User updated"}


@router.delete("/{user_id}")
def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"message": "User deleted"}
