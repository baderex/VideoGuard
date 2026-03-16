import random
import math
from datetime import datetime, timezone, timedelta
from db import get_cursor, get_conn


def _ensure_schema():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL,
                address     TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'active',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("ALTER TABLE cameras ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)")
        cur.execute("ALTER TABLE alerts  ADD COLUMN IF NOT EXISTS screenshot_url TEXT")
        cur.execute("ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'fall_detected'")
        cur.execute("ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'red_zone_intrusion'")
        cur.execute("ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'fire_detected'")
        cur.execute("ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'smoke_detected'")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS red_zones (
                id          SERIAL PRIMARY KEY,
                camera_id   INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
                name        TEXT NOT NULL DEFAULT 'Restricted Zone',
                points      JSONB NOT NULL DEFAULT '[]',
                color       TEXT NOT NULL DEFAULT '#ff3333',
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            SERIAL PRIMARY KEY,
                username      TEXT NOT NULL UNIQUE,
                email         TEXT,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'support',
                site_id       INTEGER REFERENCES sites(id),
                active        BOOLEAN NOT NULL DEFAULT true,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.close()
    except Exception as e:
        conn.rollback()
        print(f"[seed] Schema migration error (non-fatal): {e}")
    finally:
        conn.close()


def _ensure_users():
    """Seed default user accounts if none exist."""
    try:
        import bcrypt as _bcrypt

        def _hash(pw: str) -> str:
            return _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt()).decode()

        with get_cursor() as cur:
            cur.execute("SELECT count(*)::int AS cnt FROM users")
            if cur.fetchone()["cnt"] > 0:
                return

        with get_cursor() as cur:
            cur.execute("SELECT id FROM sites ORDER BY id LIMIT 3")
            site_ids = [r["id"] for r in cur.fetchall()]

        accounts = [
            ("admin",   "admin@videoguard.io",   _hash("admin123"),    "admin",       None),
            ("support", "support@videoguard.io",  _hash("support123"),  "support",     None),
        ]
        for i, sid in enumerate(site_ids):
            accounts.append((
                f"site{i+1}",
                f"site{i+1}@videoguard.io",
                _hash("site123"),
                "site_viewer",
                sid,
            ))

        with get_cursor(commit=True) as cur:
            for username, email, pw_hash, role, site_id in accounts:
                cur.execute(
                    """INSERT INTO users (username, email, password_hash, role, site_id)
                       VALUES (%s, %s, %s, %s, %s) ON CONFLICT (username) DO NOTHING""",
                    (username, email, pw_hash, role, site_id),
                )
        print(f"[seed] Seeded {len(accounts)} user accounts.")
    except Exception as e:
        print(f"[seed] User seeding error (non-fatal): {e}")


def auto_seed_if_empty():
    _ensure_schema()

    with get_cursor() as cur:
        cur.execute("SELECT count(*)::int AS cnt FROM cameras")
        row = cur.fetchone()
        if row and row["cnt"] > 0:
            _ensure_sites()
            _ensure_red_zones()
            _ensure_users()
            return

    print("[seed] No cameras found — seeding initial data...")

    with get_cursor(commit=True) as cur:
        site_data = [
            ("Alpha Industrial Complex", "100 Factory Road, Zone A",  "active"),
            ("Beta Warehouse District",  "55 Logistics Lane, Zone B", "active"),
            ("Gamma Research Campus",    "200 Lab Boulevard, Zone C", "active"),
        ]
        site_ids = []
        for name, address, status in site_data:
            cur.execute("INSERT INTO sites (name, address, status) VALUES (%s,%s,%s) RETURNING id",
                        (name, address, status))
            site_ids.append(cur.fetchone()["id"])

        camera_data = [
            ("Main Entrance",       "Building A - Gate 1",    "active",   "rtsp://example.com/stream/cam1", ["hard_hat","safety_vest","safety_boots"],                         site_ids[0]),
            ("Production Floor",    "Building B - Section 2", "active",   "rtsp://example.com/stream/cam2", ["hard_hat","safety_vest","gloves","safety_glasses"],              site_ids[0]),
            ("Warehouse Zone A",    "Warehouse - North Wing", "active",   "rtsp://example.com/stream/cam3", ["hard_hat","safety_vest","safety_boots"],                         site_ids[1]),
            ("Chemical Lab",        "Lab Building - Floor 1", "active",   "rtsp://example.com/stream/cam4", ["hard_hat","safety_vest","gloves","safety_glasses","face_mask"], site_ids[2]),
            ("Outdoor Loading Dock","East Yard - Dock 3",     "inactive", "rtsp://example.com/stream/cam5", ["hard_hat","safety_vest"],                                        site_ids[1]),
            ("Assembly Line B",     "Building C - Line 2",   "error",    "rtsp://example.com/stream/cam6", ["hard_hat","safety_vest","gloves"],                               site_ids[0]),
        ]
        cameras = []
        for name, location, status, stream_url, ppe_reqs, site_id in camera_data:
            cur.execute("""INSERT INTO cameras (name,location,status,stream_url,ppe_requirements,site_id)
                           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (name, location, status, stream_url, ppe_reqs, site_id))
            cameras.append(cur.fetchone())

        now = datetime.now(timezone.utc)
        active_cameras = [c for c in cameras if c["status"] == "active"]
        for h in range(23, -1, -1):
            ts = now - timedelta(hours=h)
            for cam in active_cameras:
                pc = random.randint(1, 8)
                cc = math.floor(pc * (0.6 + random.random() * 0.4))
                nc = pc - cc
                cr = round((cc / pc) * 1000) / 10
                cur.execute("""INSERT INTO analytics
                    (camera_id,person_count,compliant_count,non_compliant_count,compliance_rate,
                     missing_hard_hat,missing_safety_vest,missing_gloves,missing_safety_glasses,
                     missing_face_mask,missing_safety_boots,recorded_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (cam["id"],pc,cc,nc,cr,
                     random.randint(0,1),random.randint(0,1),random.randint(0,1),
                     random.randint(0,1),random.randint(0,1),random.randint(0,1),ts))

        alert_data = [
            (cameras[0]["id"],"missing_ppe",   "high",    "2 workers without hard hats at Main Entrance",           ["hard_hat"],                "open",        2, now-timedelta(minutes=5),  None,                      None),
            (cameras[1]["id"],"missing_ppe",   "critical","Worker missing gloves and glasses on Production Floor",  ["gloves","safety_glasses"], "open",        1, now-timedelta(minutes=12), None,                      None),
            (cameras[2]["id"],"low_compliance","medium",  "Compliance rate dropped below 70% in Warehouse Zone A", [],                          "acknowledged",5, now-timedelta(minutes=30), now-timedelta(minutes=20), None),
            (cameras[5]["id"],"camera_offline","high",    "Camera Assembly Line B is offline",                     [],                          "open",        0, now-timedelta(minutes=45), None,                      None),
            (cameras[3]["id"],"missing_ppe",   "critical","Multiple workers missing face masks in Chemical Lab",   ["face_mask"],               "resolved",    3, now-timedelta(hours=2),   None,                      now-timedelta(minutes=90)),
        ]
        for cam_id,atype,severity,message,missing_ppe,status,pc,created_at,ack_at,resolved_at in alert_data:
            cur.execute("""INSERT INTO alerts (camera_id,type,severity,message,missing_ppe,status,
                           person_count,created_at,acknowledged_at,resolved_at)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (cam_id,atype,severity,message,missing_ppe,status,pc,created_at,ack_at,resolved_at))

    import json
    zone_data = [
        (cameras[0]["id"], "Gate Entry Zone",       [{"x":0.0,"y":0.6},{"x":0.35,"y":0.6},{"x":0.35,"y":1.0},{"x":0.0,"y":1.0}], "#ff3333"),
        (cameras[1]["id"], "Machine Hazard Area",   [{"x":0.55,"y":0.3},{"x":0.95,"y":0.3},{"x":0.95,"y":0.85},{"x":0.55,"y":0.85}], "#ff8800"),
        (cameras[2]["id"], "Forklift Corridor",     [{"x":0.1,"y":0.0},{"x":0.5,"y":0.0},{"x":0.5,"y":0.55},{"x":0.1,"y":0.55}], "#ff3333"),
    ]
    for cam_id, name, points, color in zone_data:
        cur.execute(
            "INSERT INTO red_zones (camera_id, name, points, color, active) VALUES (%s,%s,%s,%s,true)",
            (cam_id, name, json.dumps(points), color)
        )

    print(f"[seed] Done — seeded 3 sites, {len(cameras)} cameras, 5 alerts, {len(zone_data)} red zones.")
    _ensure_users()


def _ensure_red_zones():
    import json
    with get_cursor() as cur:
        cur.execute("SELECT count(*)::int AS cnt FROM red_zones")
        if cur.fetchone()["cnt"] > 0:
            return
    with get_cursor() as cur:
        cur.execute("SELECT id FROM cameras ORDER BY id LIMIT 3")
        cam_ids = [r["id"] for r in cur.fetchall()]
    if len(cam_ids) < 1:
        return
    zone_data = [
        (cam_ids[0], "Entry Restricted Zone",  [{"x":0.0,"y":0.6},{"x":0.35,"y":0.6},{"x":0.35,"y":1.0},{"x":0.0,"y":1.0}], "#ff3333"),
    ]
    if len(cam_ids) > 1:
        zone_data.append((cam_ids[1], "Machine Hazard Area", [{"x":0.55,"y":0.3},{"x":0.95,"y":0.3},{"x":0.95,"y":0.85},{"x":0.55,"y":0.85}], "#ff8800"))
    if len(cam_ids) > 2:
        zone_data.append((cam_ids[2], "Forklift Corridor", [{"x":0.1,"y":0.0},{"x":0.5,"y":0.0},{"x":0.5,"y":0.55},{"x":0.1,"y":0.55}], "#ff3333"))
    with get_cursor(commit=True) as cur:
        for cam_id, name, points, color in zone_data:
            cur.execute(
                "INSERT INTO red_zones (camera_id, name, points, color, active) VALUES (%s,%s,%s,%s,true)",
                (cam_id, name, json.dumps(points), color)
            )
    print(f"[seed] Seeded {len(zone_data)} default red zones.")


def _ensure_sites():
    with get_cursor() as cur:
        cur.execute("SELECT count(*)::int AS cnt FROM sites")
        if cur.fetchone()["cnt"] > 0:
            return
    print("[seed] No sites — seeding sites and assigning cameras...")
    with get_cursor(commit=True) as cur:
        site_data = [
            ("Alpha Industrial Complex","100 Factory Road, Zone A","active"),
            ("Beta Warehouse District", "55 Logistics Lane, Zone B","active"),
            ("Gamma Research Campus",   "200 Lab Boulevard, Zone C","active"),
        ]
        site_ids = []
        for name, address, status in site_data:
            cur.execute("INSERT INTO sites (name,address,status) VALUES (%s,%s,%s) RETURNING id",
                        (name,address,status))
            site_ids.append(cur.fetchone()["id"])
        cur.execute("SELECT id FROM cameras ORDER BY id")
        cam_ids = [r["id"] for r in cur.fetchall()]
        site_map = [site_ids[0],site_ids[0],site_ids[1],site_ids[2],site_ids[1],site_ids[0]]
        for i, cam_id in enumerate(cam_ids):
            sid = site_map[i] if i < len(site_map) else site_ids[0]
            cur.execute("UPDATE cameras SET site_id=%s WHERE id=%s AND site_id IS NULL",(sid,cam_id))
    print("[seed] Sites seeded and cameras assigned.")
