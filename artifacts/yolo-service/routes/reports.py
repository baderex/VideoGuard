from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from db import get_cursor

router = APIRouter()


@router.get("/api/reports/daily")
def daily_report(date: str = None):
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        target_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    next_day = target_date + timedelta(days=1)

    with get_cursor() as cur:
        cur.execute("SELECT id, name FROM cameras")
        camera_map = {r["id"]: r["name"] for r in cur.fetchall()}

        cur.execute(
            """SELECT
                date_trunc('hour', recorded_at) AS timestamp,
                camera_id AS "cameraId",
                sum(person_count)::int AS "personCount",
                sum(compliant_count)::int AS "compliantCount",
                sum(non_compliant_count)::int AS "nonCompliantCount",
                round(avg(compliance_rate)::numeric, 1)::float AS "complianceRate"
            FROM analytics
            WHERE recorded_at >= %s AND recorded_at <= %s
            GROUP BY date_trunc('hour', recorded_at), camera_id
            ORDER BY date_trunc('hour', recorded_at)""",
            (target_date, next_day),
        )
        rows = [dict(r) for r in cur.fetchall()]

        for r in rows:
            if r["timestamp"] and hasattr(r["timestamp"], "isoformat"):
                r["timestamp"] = r["timestamp"].isoformat()

        cur.execute(
            "SELECT count(*)::int AS cnt FROM alerts WHERE created_at >= %s AND created_at <= %s",
            (target_date, next_day),
        )
        alert_count = cur.fetchone()["cnt"]

        cur.execute(
            """SELECT
                sum(missing_hard_hat)::int AS hard_hat,
                sum(missing_safety_vest)::int AS safety_vest,
                sum(missing_gloves)::int AS gloves,
                sum(missing_safety_glasses)::int AS safety_glasses,
                sum(missing_face_mask)::int AS face_mask,
                sum(missing_safety_boots)::int AS safety_boots
            FROM analytics
            WHERE recorded_at >= %s AND recorded_at <= %s""",
            (target_date, next_day),
        )
        v = dict(cur.fetchone())

    total_person_detections = sum(r.get("personCount") or 0 for r in rows)
    total_non_compliant = sum(r.get("nonCompliantCount") or 0 for r in rows)
    avg_compliance = (
        sum(r.get("complianceRate") or 0 for r in rows) / len(rows)
        if rows
        else 100
    )

    hourly_totals = {}
    for r in rows:
        h = str(r["timestamp"])
        if h not in hourly_totals:
            hourly_totals[h] = {"personCount": 0, "hour": h}
        hourly_totals[h]["personCount"] += r.get("personCount") or 0
    peak_entry = max(hourly_totals.values(), key=lambda x: x["personCount"]) if hourly_totals else None

    top_violations = [
        {"ppe": k, "count": v.get(k) or 0}
        for k in ["hard_hat", "safety_vest", "gloves", "safety_glasses", "face_mask", "safety_boots"]
        if (v.get(k) or 0) > 0
    ]
    top_violations.sort(key=lambda x: x["count"], reverse=True)

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "totalPersonDetections": total_person_detections,
        "uniqueViolations": total_non_compliant,
        "averageComplianceRate": round(avg_compliance * 10) / 10,
        "peakHour": peak_entry["hour"] if peak_entry else None,
        "peakPersonCount": peak_entry["personCount"] if peak_entry else 0,
        "alerts": alert_count,
        "hourlyData": rows,
        "topViolations": top_violations,
    }
