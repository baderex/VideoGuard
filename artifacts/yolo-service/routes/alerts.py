from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from db import get_cursor

router = APIRouter()


def _alert_dict(row, camera_map=None):
    d = dict(row)
    d["cameraId"] = d.pop("camera_id", None)
    d["missingPpe"] = d.pop("missing_ppe", []) or []
    d["personCount"] = d.pop("person_count", 0)
    d["createdAt"] = d.pop("created_at", None)
    d["acknowledgedAt"] = d.pop("acknowledged_at", None)
    d["resolvedAt"] = d.pop("resolved_at", None)
    for k in ("createdAt", "acknowledgedAt", "resolvedAt"):
        if d[k] and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    if camera_map is not None:
        d["cameraName"] = camera_map.get(d["cameraId"], f"Camera {d['cameraId']}")
    return d


@router.get("/api/alerts")
def list_alerts(
    cameraId: int = None,
    status: str = None,
    limit: int = Query(50),
    offset: int = Query(0),
):
    with get_cursor() as cur:
        cur.execute("SELECT id, name FROM cameras")
        camera_map = {r["id"]: r["name"] for r in cur.fetchall()}

        conditions = []
        params = []
        if cameraId:
            conditions.append("camera_id = %s")
            params.append(cameraId)
        if status:
            conditions.append("status = %s")
            params.append(status)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"SELECT count(*)::int AS cnt FROM alerts {where}",
            params,
        )
        total = cur.fetchone()["cnt"]

        cur.execute(
            f"SELECT * FROM alerts {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return {
        "alerts": [_alert_dict(r, camera_map) for r in rows],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    now = datetime.now(timezone.utc)
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE alerts SET status = 'acknowledged', acknowledged_at = %s WHERE id = %s RETURNING *",
            (now, alert_id),
        )
        alert = cur.fetchone()
        if not alert:
            raise HTTPException(status_code=404, detail="Not found")

        cur.execute("SELECT name FROM cameras WHERE id = %s", (alert["camera_id"],))
        cam = cur.fetchone()
        camera_name = cam["name"] if cam else f"Camera {alert['camera_id']}"

    result = _alert_dict(alert)
    result["cameraName"] = camera_name
    return result


@router.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    now = datetime.now(timezone.utc)
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE alerts SET status = 'resolved', resolved_at = %s WHERE id = %s RETURNING *",
            (now, alert_id),
        )
        alert = cur.fetchone()
        if not alert:
            raise HTTPException(status_code=404, detail="Not found")

        cur.execute("SELECT name FROM cameras WHERE id = %s", (alert["camera_id"],))
        cam = cur.fetchone()
        camera_name = cam["name"] if cam else f"Camera {alert['camera_id']}"

    result = _alert_dict(alert)
    result["cameraName"] = camera_name
    return result
