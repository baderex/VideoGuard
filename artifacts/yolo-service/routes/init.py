"""
POST /api/init  — First-time database initialization & seeding.

Security:
  Pass header  X-Init-Secret: <value>  matching the INIT_SECRET env var.
  If INIT_SECRET is not set, a one-time secret is printed to the server log on startup.

Query params:
  force=false  (default) — only seeds if all tables are empty
  force=true             — TRUNCATES all data tables and re-seeds from scratch
"""

import os
import json
import random
import math
import threading
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional
import bcrypt

from db import get_conn, get_cursor

router = APIRouter()

# ── Secret ────────────────────────────────────────────────────────────────────
_INIT_SECRET_ENV = os.environ.get("INIT_SECRET", "")
_AUTO_SECRET: str = ""
_secret_lock = threading.Lock()

def _get_secret() -> str:
    global _AUTO_SECRET
    if _INIT_SECRET_ENV:
        return _INIT_SECRET_ENV
    with _secret_lock:
        if not _AUTO_SECRET:
            import secrets
            _AUTO_SECRET = secrets.token_hex(16)
            print(
                f"\n{'='*60}\n"
                f"[INIT] No INIT_SECRET env var set.\n"
                f"[INIT] One-time init secret: {_AUTO_SECRET}\n"
                f"[INIT] Use header: X-Init-Secret: {_AUTO_SECRET}\n"
                f"{'='*60}\n"
            )
        return _AUTO_SECRET


# ── Schema ────────────────────────────────────────────────────────────────────
def _create_schema():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id         SERIAL PRIMARY KEY,
                name       TEXT NOT NULL,
                address    TEXT NOT NULL,
                status     TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
                CREATE TYPE alert_type AS ENUM (
                  'missing_ppe','low_compliance','camera_offline',
                  'fall_detected','red_zone_intrusion','fire_detected','smoke_detected'
                );
              END IF;
            END $$
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id               SERIAL PRIMARY KEY,
                name             TEXT NOT NULL,
                location         TEXT NOT NULL DEFAULT '',
                status           TEXT NOT NULL DEFAULT 'active',
                stream_url       TEXT,
                ppe_requirements TEXT[] NOT NULL DEFAULT '{}',
                site_id          INTEGER REFERENCES sites(id),
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id               SERIAL PRIMARY KEY,
                camera_id        INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
                type             TEXT NOT NULL,
                severity         TEXT NOT NULL DEFAULT 'medium',
                message          TEXT NOT NULL DEFAULT '',
                missing_ppe      TEXT[] NOT NULL DEFAULT '{}',
                status           TEXT NOT NULL DEFAULT 'open',
                person_count     INTEGER NOT NULL DEFAULT 0,
                screenshot_url   TEXT,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                acknowledged_at  TIMESTAMPTZ,
                resolved_at      TIMESTAMPTZ
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS analytics (
                id                    SERIAL PRIMARY KEY,
                camera_id             INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
                person_count          INTEGER NOT NULL DEFAULT 0,
                compliant_count       INTEGER NOT NULL DEFAULT 0,
                non_compliant_count   INTEGER NOT NULL DEFAULT 0,
                compliance_rate       NUMERIC(5,1) NOT NULL DEFAULT 100.0,
                missing_hard_hat      INTEGER NOT NULL DEFAULT 0,
                missing_safety_vest   INTEGER NOT NULL DEFAULT 0,
                missing_gloves        INTEGER NOT NULL DEFAULT 0,
                missing_safety_glasses INTEGER NOT NULL DEFAULT 0,
                missing_face_mask     INTEGER NOT NULL DEFAULT 0,
                missing_safety_boots  INTEGER NOT NULL DEFAULT 0,
                recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS red_zones (
                id         SERIAL PRIMARY KEY,
                camera_id  INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
                name       TEXT NOT NULL DEFAULT 'Restricted Zone',
                points     JSONB NOT NULL DEFAULT '[]',
                color      TEXT NOT NULL DEFAULT '#ff3333',
                active     BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        # Safe ALTER TABLE additions
        for stmt in [
            "ALTER TABLE cameras ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)",
            "ALTER TABLE alerts  ADD COLUMN IF NOT EXISTS screenshot_url TEXT",
        ]:
            try:
                cur.execute(stmt)
            except Exception:
                conn.rollback()
        conn.commit()
        cur.close()
    except Exception as e:
        conn.rollback()
        raise RuntimeError(f"Schema error: {e}") from e
    finally:
        conn.close()


# ── Seed data ─────────────────────────────────────────────────────────────────
def _seed_all(force: bool) -> dict:
    def _h(pw: str) -> str:
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

    summary: dict = {}

    with get_cursor(commit=True) as cur:
        if force:
            cur.execute("TRUNCATE TABLE analytics, alerts, red_zones, users, cameras, sites RESTART IDENTITY CASCADE")
            summary["wiped"] = True

        # ── Sites ──────────────────────────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM sites")
        if cur.fetchone()["cnt"] == 0:
            site_rows = [
                ("Alpha Industrial Complex", "100 Factory Road, Zone A",   "active"),
                ("Beta Warehouse District",  "55 Logistics Lane, Zone B",  "active"),
                ("Gamma Research Campus",    "200 Lab Boulevard, Zone C",  "active"),
            ]
            site_ids = []
            for name, address, status in site_rows:
                cur.execute("INSERT INTO sites (name,address,status) VALUES (%s,%s,%s) RETURNING id",
                            (name, address, status))
                site_ids.append(cur.fetchone()["id"])
            summary["sites"] = len(site_ids)
        else:
            cur.execute("SELECT id FROM sites ORDER BY id LIMIT 3")
            site_ids = [r["id"] for r in cur.fetchall()]
            summary["sites"] = "existing"

        # ── Cameras ────────────────────────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM cameras")
        if cur.fetchone()["cnt"] == 0:
            cam_rows = [
                ("Main Entrance",        "Building A - Gate 1",    "active",   "rtsp://example.com/stream/cam1", ["hard_hat","safety_vest","safety_boots"],                          site_ids[0]),
                ("Production Floor",     "Building B - Section 2", "active",   "rtsp://example.com/stream/cam2", ["hard_hat","safety_vest","gloves","safety_glasses"],               site_ids[0]),
                ("Warehouse Zone A",     "Warehouse - North Wing", "active",   "rtsp://example.com/stream/cam3", ["hard_hat","safety_vest","safety_boots"],                          site_ids[1]),
                ("Chemical Lab",         "Lab Building - Floor 1", "active",   "rtsp://example.com/stream/cam4", ["hard_hat","safety_vest","gloves","safety_glasses","face_mask"],  site_ids[2]),
                ("Outdoor Loading Dock", "East Yard - Dock 3",     "inactive", "rtsp://example.com/stream/cam5", ["hard_hat","safety_vest"],                                         site_ids[1]),
                ("Assembly Line B",      "Building C - Line 2",    "error",    "rtsp://example.com/stream/cam6", ["hard_hat","safety_vest","gloves"],                                site_ids[0]),
            ]
            cameras = []
            for name, location, status, stream_url, ppe_reqs, site_id in cam_rows:
                cur.execute(
                    """INSERT INTO cameras (name,location,status,stream_url,ppe_requirements,site_id)
                       VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (name, location, status, stream_url, ppe_reqs, site_id))
                cameras.append(cur.fetchone())
            summary["cameras"] = len(cameras)
        else:
            cur.execute("SELECT * FROM cameras ORDER BY id LIMIT 6")
            cameras = cur.fetchall()
            summary["cameras"] = "existing"

        # ── Analytics (24 h history) ───────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM analytics")
        if cur.fetchone()["cnt"] == 0:
            now = datetime.now(timezone.utc)
            active_cams = [c for c in cameras if c["status"] == "active"]
            analytic_rows = 0
            for h in range(23, -1, -1):
                ts = now - timedelta(hours=h)
                for cam in active_cams:
                    pc  = random.randint(1, 8)
                    cc  = math.floor(pc * (0.6 + random.random() * 0.4))
                    nc  = pc - cc
                    cr  = round((cc / pc) * 1000) / 10
                    cur.execute("""
                        INSERT INTO analytics
                          (camera_id,person_count,compliant_count,non_compliant_count,compliance_rate,
                           missing_hard_hat,missing_safety_vest,missing_gloves,
                           missing_safety_glasses,missing_face_mask,missing_safety_boots,recorded_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (cam["id"], pc, cc, nc, cr,
                          random.randint(0,1), random.randint(0,1), random.randint(0,1),
                          random.randint(0,1), random.randint(0,1), random.randint(0,1), ts))
                    analytic_rows += 1
            summary["analytics_rows"] = analytic_rows

        # ── Alerts ─────────────────────────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM alerts")
        if cur.fetchone()["cnt"] == 0:
            now = datetime.now(timezone.utc)
            alert_rows = [
                (cameras[0]["id"],"missing_ppe",       "high",    "2 workers without hard hats at Main Entrance",             ["hard_hat"],                "open",         2, now-timedelta(minutes=5),  None,                     None),
                (cameras[1]["id"],"missing_ppe",       "critical","Worker missing gloves and glasses on Production Floor",    ["gloves","safety_glasses"], "open",         1, now-timedelta(minutes=12), None,                     None),
                (cameras[2]["id"],"low_compliance",    "medium",  "Compliance rate dropped below 70% in Warehouse Zone A",   [],                          "acknowledged", 5, now-timedelta(minutes=30), now-timedelta(minutes=20),None),
                (cameras[5]["id"],"camera_offline",    "high",    "Camera Assembly Line B is offline",                       [],                          "open",         0, now-timedelta(minutes=45), None,                     None),
                (cameras[3]["id"],"missing_ppe",       "critical","Multiple workers missing face masks in Chemical Lab",      ["face_mask"],               "resolved",     3, now-timedelta(hours=2),   None,                     now-timedelta(minutes=90)),
                (cameras[0]["id"],"fall_detected",     "critical","Worker fall detected near Main Entrance gate",             [],                          "open",         1, now-timedelta(minutes=3),  None,                     None),
                (cameras[1]["id"],"red_zone_intrusion","high",    "Unauthorized entry into Machine Hazard Area",             [],                          "open",         2, now-timedelta(minutes=8),  None,                     None),
                (cameras[3]["id"],"fire_detected",     "critical","Smoke/heat signature detected in Chemical Lab",           [],                          "acknowledged", 0, now-timedelta(minutes=60), now-timedelta(minutes=55),None),
            ]
            for cam_id,atype,severity,message,missing_ppe,status,pc,created_at,ack_at,resolved_at in alert_rows:
                cur.execute("""
                    INSERT INTO alerts (camera_id,type,severity,message,missing_ppe,
                                        status,person_count,created_at,acknowledged_at,resolved_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (cam_id,atype,severity,message,missing_ppe,status,pc,created_at,ack_at,resolved_at))
            summary["alerts"] = len(alert_rows)

        # ── Red zones ──────────────────────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM red_zones")
        if cur.fetchone()["cnt"] == 0:
            zone_rows = [
                (cameras[0]["id"], "Gate Entry Zone",     [{"x":0.0,"y":0.6},{"x":0.35,"y":0.6},{"x":0.35,"y":1.0},{"x":0.0,"y":1.0}], "#ff3333"),
                (cameras[1]["id"], "Machine Hazard Area", [{"x":0.55,"y":0.3},{"x":0.95,"y":0.3},{"x":0.95,"y":0.85},{"x":0.55,"y":0.85}], "#ff8800"),
                (cameras[2]["id"], "Forklift Corridor",   [{"x":0.1,"y":0.0},{"x":0.5,"y":0.0},{"x":0.5,"y":0.55},{"x":0.1,"y":0.55}], "#ff3333"),
            ]
            for cam_id, name, points, color in zone_rows:
                cur.execute(
                    "INSERT INTO red_zones (camera_id,name,points,color,active) VALUES (%s,%s,%s,%s,true)",
                    (cam_id, name, json.dumps(points), color))
            summary["red_zones"] = len(zone_rows)

        # ── Users ──────────────────────────────────────────────────────────
        cur.execute("SELECT count(*)::int AS cnt FROM users")
        if cur.fetchone()["cnt"] == 0:
            accounts = [
                ("admin",   "admin@videoguard.io",   _h("admin123"),   "admin",       None),
                ("support", "support@videoguard.io", _h("support123"), "support",     None),
            ]
            for i, sid in enumerate(site_ids[:3]):
                accounts.append((
                    f"site{i+1}", f"site{i+1}@videoguard.io",
                    _h("site123"), "site_viewer", sid,
                ))
            for username, email, pw_hash, role, site_id in accounts:
                cur.execute(
                    """INSERT INTO users (username,email,password_hash,role,site_id)
                       VALUES (%s,%s,%s,%s,%s) ON CONFLICT (username) DO NOTHING""",
                    (username, email, pw_hash, role, site_id))
            summary["users"] = len(accounts)
            summary["default_accounts"] = [
                {"username": "admin",   "password": "admin123",   "role": "admin"},
                {"username": "support", "password": "support123", "role": "support"},
                {"username": "site1",   "password": "site123",    "role": "site_viewer"},
                {"username": "site2",   "password": "site123",    "role": "site_viewer"},
                {"username": "site3",   "password": "site123",    "role": "site_viewer"},
            ]

    return summary


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/api/init")
def initialize_system(
    force: bool = Query(False, description="Wipe all existing data and re-seed from scratch"),
    x_init_secret: Optional[str] = Header(None, alias="x-init-secret"),
):
    secret = _get_secret()
    if x_init_secret != secret:
        raise HTTPException(
            status_code=403,
            detail="Missing or invalid X-Init-Secret header. Check the server log for the one-time secret.",
        )

    try:
        _create_schema()
        result = _seed_all(force=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": "ok",
        "message": "System initialized successfully." if not force else "System wiped and re-seeded successfully.",
        "seeded": result,
        "note": "Change default passwords in production via Admin → User Management.",
    }


@router.get("/api/init/status")
def init_status():
    """Returns current DB population counts — no auth required."""
    try:
        with get_cursor() as cur:
            counts = {}
            for table in ("sites", "cameras", "users", "alerts", "analytics", "red_zones"):
                cur.execute(f"SELECT count(*)::int AS cnt FROM {table}")
                counts[table] = cur.fetchone()["cnt"]
        initialized = counts["cameras"] > 0 and counts["users"] > 0
        return {"initialized": initialized, "counts": counts}
    except Exception as e:
        return {"initialized": False, "error": str(e)}
