import random
import math
from datetime import datetime, timezone, timedelta
from db import get_cursor


def auto_seed_if_empty():
    with get_cursor() as cur:
        cur.execute("SELECT count(*)::int AS cnt FROM cameras")
        row = cur.fetchone()
        if row and row["cnt"] > 0:
            return

    print("[seed] No cameras found — seeding initial data...")

    with get_cursor(commit=True) as cur:
        camera_data = [
            ("Main Entrance", "Building A - Gate 1", "active", "rtsp://example.com/stream/cam1", ["hard_hat", "safety_vest", "safety_boots"]),
            ("Production Floor", "Building B - Section 2", "active", "rtsp://example.com/stream/cam2", ["hard_hat", "safety_vest", "gloves", "safety_glasses"]),
            ("Warehouse Zone A", "Warehouse - North Wing", "active", "rtsp://example.com/stream/cam3", ["hard_hat", "safety_vest", "safety_boots"]),
            ("Chemical Lab", "Lab Building - Floor 1", "active", "rtsp://example.com/stream/cam4", ["hard_hat", "safety_vest", "gloves", "safety_glasses", "face_mask"]),
            ("Outdoor Loading Dock", "East Yard - Dock 3", "inactive", "rtsp://example.com/stream/cam5", ["hard_hat", "safety_vest"]),
            ("Assembly Line B", "Building C - Line 2", "error", "rtsp://example.com/stream/cam6", ["hard_hat", "safety_vest", "gloves"]),
        ]

        cameras = []
        for name, location, status, stream_url, ppe_reqs in camera_data:
            cur.execute(
                """INSERT INTO cameras (name, location, status, stream_url, ppe_requirements)
                   VALUES (%s, %s, %s, %s, %s) RETURNING *""",
                (name, location, status, stream_url, ppe_reqs),
            )
            cameras.append(cur.fetchone())

        now = datetime.now(timezone.utc)
        active_cameras = [c for c in cameras if c["status"] == "active"]

        for h in range(23, -1, -1):
            ts = now - timedelta(hours=h)
            for cam in active_cameras:
                person_count = random.randint(1, 8)
                compliant_count = math.floor(person_count * (0.6 + random.random() * 0.4))
                non_compliant_count = person_count - compliant_count
                compliance_rate = round((compliant_count / person_count) * 1000) / 10

                cur.execute(
                    """INSERT INTO analytics
                       (camera_id, person_count, compliant_count, non_compliant_count,
                        compliance_rate, missing_hard_hat, missing_safety_vest,
                        missing_gloves, missing_safety_glasses, missing_face_mask,
                        missing_safety_boots, recorded_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        cam["id"], person_count, compliant_count, non_compliant_count,
                        compliance_rate,
                        random.randint(0, 1), random.randint(0, 1),
                        random.randint(0, 1), random.randint(0, 1),
                        random.randint(0, 1), random.randint(0, 1),
                        ts,
                    ),
                )

        alert_data = [
            (cameras[0]["id"], "missing_ppe", "high", "2 workers detected without hard hats at Main Entrance", ["hard_hat"], "open", 2, now - timedelta(minutes=5), None, None),
            (cameras[1]["id"], "missing_ppe", "critical", "Worker missing safety gloves and glasses on Production Floor", ["gloves", "safety_glasses"], "open", 1, now - timedelta(minutes=12), None, None),
            (cameras[2]["id"], "low_compliance", "medium", "Compliance rate dropped below 70% in Warehouse Zone A", [], "acknowledged", 5, now - timedelta(minutes=30), now - timedelta(minutes=20), None),
            (cameras[5]["id"], "camera_offline", "high", "Camera Assembly Line B is offline — no feed available", [], "open", 0, now - timedelta(minutes=45), None, None),
            (cameras[3]["id"], "missing_ppe", "critical", "Multiple workers missing face masks in Chemical Lab", ["face_mask"], "resolved", 3, now - timedelta(hours=2), None, now - timedelta(minutes=90)),
        ]

        for cam_id, atype, severity, message, missing_ppe, status, person_count, created_at, ack_at, resolved_at in alert_data:
            cur.execute(
                """INSERT INTO alerts
                   (camera_id, type, severity, message, missing_ppe, status,
                    person_count, created_at, acknowledged_at, resolved_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (cam_id, atype, severity, message, missing_ppe, status, person_count, created_at, ack_at, resolved_at),
            )

    analytics_count = 24 * len(active_cameras)
    print(f"[seed] Done — seeded {len(cameras)} cameras, {analytics_count} analytics records, 5 alerts.")
