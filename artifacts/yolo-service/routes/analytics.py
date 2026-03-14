from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from db import get_cursor
from simulation import generate_detection_snapshot

router = APIRouter()


@router.get("/api/analytics/live")
def analytics_live():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM cameras ORDER BY id")
        cameras = [dict(r) for r in cur.fetchall()]

        snapshots = [generate_detection_snapshot(c) for c in cameras]
        active_cameras = sum(1 for c in cameras if c["status"] == "active")
        total_persons = sum(s["personCount"] for s in snapshots)
        total_compliant = sum(s["compliantCount"] for s in snapshots)
        total_non_compliant = sum(s["nonCompliantCount"] for s in snapshots)
        overall_rate = round((total_compliant / total_persons) * 1000) / 10 if total_persons > 0 else 100

        cur.execute("SELECT count(*)::int AS cnt FROM alerts WHERE status = 'open'")
        open_alerts = cur.fetchone()["cnt"]

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalCameras": len(cameras),
        "activeCameras": active_cameras,
        "totalPersonsDetected": total_persons,
        "totalCompliant": total_compliant,
        "totalNonCompliant": total_non_compliant,
        "overallComplianceRate": overall_rate,
        "openAlerts": open_alerts,
        "cameraSnapshots": snapshots,
    }


@router.get("/api/analytics/history")
def analytics_history(
    cameraId: int = None,
    interval: str = Query("hour"),
    from_date: str = Query(None, alias="from"),
    to_date: str = Query(None, alias="to"),
):
    trunc_unit = "minute" if interval == "minute" else ("day" if interval == "day" else "hour")

    if from_date:
        from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
    else:
        from_dt = datetime.now(timezone.utc) - timedelta(hours=24)

    if to_date:
        to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
    else:
        to_dt = datetime.now(timezone.utc)

    conditions = [
        "recorded_at >= %s",
        "recorded_at <= %s",
    ]
    params = [from_dt, to_dt]

    if cameraId:
        conditions.append("camera_id = %s")
        params.append(cameraId)

    where = " AND ".join(conditions)

    with get_cursor() as cur:
        cur.execute(
            f"""SELECT
                date_trunc('{trunc_unit}', recorded_at) AS timestamp,
                camera_id AS "cameraId",
                sum(person_count)::int AS "personCount",
                sum(compliant_count)::int AS "compliantCount",
                sum(non_compliant_count)::int AS "nonCompliantCount",
                round(avg(compliance_rate)::numeric, 1)::float AS "complianceRate"
            FROM analytics
            WHERE {where}
            GROUP BY date_trunc('{trunc_unit}', recorded_at), camera_id
            ORDER BY date_trunc('{trunc_unit}', recorded_at)""",
            params,
        )
        rows = cur.fetchall()

    result = []
    for r in rows:
        d = dict(r)
        if d["timestamp"] and hasattr(d["timestamp"], "isoformat"):
            d["timestamp"] = d["timestamp"].isoformat()
        result.append(d)
    return result


@router.get("/api/analytics/compliance-summary")
def compliance_summary(period: str = Query("today")):
    now = datetime.now(timezone.utc)

    if period == "week":
        from_date = now - timedelta(days=7)
    elif period == "month":
        from_date = now - timedelta(days=30)
    else:
        from_date = now.replace(hour=0, minute=0, second=0, microsecond=0)

    with get_cursor() as cur:
        cur.execute(
            """SELECT
                camera_id,
                sum(person_count)::int AS detections,
                sum(compliant_count)::int AS compliant,
                sum(non_compliant_count)::int AS non_compliant,
                round(avg(compliance_rate)::numeric, 1)::float AS compliance_rate,
                sum(missing_hard_hat)::int AS missing_hard_hat,
                sum(missing_safety_vest)::int AS missing_safety_vest,
                sum(missing_gloves)::int AS missing_gloves,
                sum(missing_safety_glasses)::int AS missing_safety_glasses,
                sum(missing_face_mask)::int AS missing_face_mask,
                sum(missing_safety_boots)::int AS missing_safety_boots
            FROM analytics
            WHERE recorded_at >= %s
            GROUP BY camera_id""",
            (from_date,),
        )
        rows = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT id, name FROM cameras")
        camera_map = {r["id"]: r["name"] for r in cur.fetchall()}

    total_detections = sum(r.get("detections") or 0 for r in rows)
    total_compliant = sum(r.get("compliant") or 0 for r in rows)
    total_non_compliant = sum(r.get("non_compliant") or 0 for r in rows)
    overall_rate = round((total_compliant / total_detections) * 1000) / 10 if total_detections > 0 else 100

    return {
        "period": period,
        "totalDetections": total_detections,
        "totalCompliant": total_compliant,
        "totalNonCompliant": total_non_compliant,
        "overallComplianceRate": overall_rate,
        "ppeMissingBreakdown": {
            "hard_hat": sum(r.get("missing_hard_hat") or 0 for r in rows),
            "safety_vest": sum(r.get("missing_safety_vest") or 0 for r in rows),
            "gloves": sum(r.get("missing_gloves") or 0 for r in rows),
            "safety_glasses": sum(r.get("missing_safety_glasses") or 0 for r in rows),
            "face_mask": sum(r.get("missing_face_mask") or 0 for r in rows),
            "safety_boots": sum(r.get("missing_safety_boots") or 0 for r in rows),
        },
        "cameraBreakdown": [
            {
                "cameraId": r["camera_id"],
                "cameraName": camera_map.get(r["camera_id"], f"Camera {r['camera_id']}"),
                "detections": r.get("detections") or 0,
                "complianceRate": r.get("compliance_rate") or 0,
            }
            for r in rows
        ],
    }
