from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from db import get_cursor
from auth_utils import get_current_user
from simulation import generate_detection_snapshot

router = APIRouter()


class CreateCameraRequest(BaseModel):
    name: str
    location: str = ""
    streamUrl: Optional[str] = None
    ppeRequirements: List[str] = []
    siteId: Optional[int] = None


def _require_editor(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in ("admin", "support"):
        raise HTTPException(status_code=403, detail="Admin or Support role required")
    return user


def _camera_dict(row):
    d = dict(row)
    if d.get("ppe_requirements") is None:
        d["ppe_requirements"] = []
    d["ppeRequirements"] = d.pop("ppe_requirements", [])
    d["streamUrl"] = d.pop("stream_url", None)
    d["siteId"] = d.pop("site_id", None)
    d["createdAt"] = d.pop("created_at", None)
    d["updatedAt"] = d.pop("updated_at", None)
    if d["createdAt"] and hasattr(d["createdAt"], "isoformat"):
        d["createdAt"] = d["createdAt"].isoformat()
    if d["updatedAt"] and hasattr(d["updatedAt"], "isoformat"):
        d["updatedAt"] = d["updatedAt"].isoformat()
    return d


@router.get("/api/cameras")
def list_cameras():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM cameras ORDER BY id")
        rows = cur.fetchall()
    return [_camera_dict(r) for r in rows]


@router.post("/api/cameras", status_code=201)
def create_camera(body: CreateCameraRequest, _user: dict = Depends(_require_editor)):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO cameras (name, location, stream_url, ppe_requirements, site_id)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (body.name, body.location, body.streamUrl, body.ppeRequirements, body.siteId),
        )
        camera = cur.fetchone()
    return _camera_dict(camera)


@router.get("/api/cameras/{camera_id}")
def get_camera(camera_id: int):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM cameras WHERE id = %s", (camera_id,))
        camera = cur.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Not found")
    return _camera_dict(camera)


@router.patch("/api/cameras/{camera_id}")
def update_camera(camera_id: int, body: dict, _user: dict = Depends(_require_editor)):
    allowed = {"name", "location", "status", "streamUrl", "ppeRequirements"}
    col_map = {
        "name": "name",
        "location": "location",
        "status": "status",
        "streamUrl": "stream_url",
        "ppeRequirements": "ppe_requirements",
    }

    sets = []
    vals = []
    for key, col in col_map.items():
        if key in body:
            sets.append(f"{col} = %s")
            vals.append(body[key])

    sets.append("updated_at = %s")
    vals.append(datetime.now(timezone.utc))
    vals.append(camera_id)

    with get_cursor(commit=True) as cur:
        cur.execute(
            f"UPDATE cameras SET {', '.join(sets)} WHERE id = %s RETURNING *",
            vals,
        )
        camera = cur.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Not found")
    return _camera_dict(camera)


@router.delete("/api/cameras/{camera_id}", status_code=204)
def delete_camera(camera_id: int, _user: dict = Depends(_require_editor)):
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM cameras WHERE id = %s", (camera_id,))
    return None


@router.get("/api/cameras/{camera_id}/snapshot")
def get_snapshot(camera_id: int):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM cameras WHERE id = %s", (camera_id,))
        camera = cur.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Not found")
    snapshot = generate_detection_snapshot(dict(camera))
    return snapshot
