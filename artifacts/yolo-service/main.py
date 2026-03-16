"""
Unified PPE Detection API Service
- All REST API routes (cameras, alerts, analytics, reports, health)
- YOLO inference: Downloads YOLOv4-tiny weights on first run (~24 MB)
- Real YOLO object detection via OpenCV DNN (no PyTorch required)
- Person detection from COCO classes, PPE compliance via color analysis
- Streams annotated MJPEG frames per camera
- Database seeding on startup
"""

import os
import sys
import time
import threading
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

sys.path.insert(0, str(Path(__file__).parent))

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from routes.cameras import router as cameras_router
from routes.alerts import router as alerts_router
from routes.analytics import router as analytics_router
from routes.reports import router as reports_router
from routes.health import router as health_router
from routes.sites import router as sites_router
from routes.zones import router as zones_router
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.init import router as init_router
from auth_utils import decode_token
from fall_detection import is_fallen_pose
from ppe_detection import analyze_ppe, run_ppe_detection, get_mode_info

_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

app = FastAPI(title="PPE Detection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    allow_credentials=True,
)

# Auth middleware — sets request.state.user for protected routes
# Public paths: /api/auth/*, /api/yolo/stream*, /api/screenshots/*
_PUBLIC_PREFIXES = (
    "/api/auth/",
    "/api/init",
    "/api/yolo/stream",
    "/api/yolo/stream-raw",
    "/api/screenshots/",
    "/api/health",
    "/api/yolo/status",
    "/api/yolo/health",
)

@app.middleware("http")
async def auth_middleware(request, call_next):
    path = request.url.path
    if any(path.startswith(p) for p in _PUBLIC_PREFIXES) or path in ("/api/health", "/"):
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            payload = decode_token(auth_header.split(" ", 1)[1])
            request.state.user = {
                "id": int(payload["sub"]),
                "role": payload.get("role", "support"),
                "site_id": payload.get("site_id"),
            }
        except Exception:
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)
    else:
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)
    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(cameras_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(health_router)
app.include_router(sites_router)
app.include_router(zones_router)
app.include_router(init_router)

BASE_PATH = Path(__file__).parent.parent.parent
CACHE_DIR = BASE_PATH / "artifacts/yolo-service/.cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SCREENSHOTS_DIR = BASE_PATH / "artifacts/yolo-service/screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/screenshots", StaticFiles(directory=str(SCREENSHOTS_DIR)), name="screenshots")

VIDEO_PATHS: Dict[int, Path] = {
    1: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam1-entrance.mp4",
    2: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam2-production.mp4",
    3: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam3-warehouse.mp4",
    4: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam4-lab.mp4",
    5: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam5-dock.mp4",
    6: BASE_PATH / "artifacts/ppe-dashboard/public/feeds/cam6-assembly.mp4",
}

# COCO class for person
PERSON_CLASS = 0
CONF_THRESH = 0.40
NMS_THRESH  = 0.45

# Model sources
WEIGHTS_URL = "https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights"
CFG_URL     = "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg"
NAMES_URL   = "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"

WEIGHTS_PATH = CACHE_DIR / "yolov4-tiny.weights"
CFG_PATH     = CACHE_DIR / "yolov4-tiny.cfg"
NAMES_PATH   = CACHE_DIR / "coco.names"

# Global state
net: Optional[cv2.dnn.Net] = None
output_layer_names: List[str] = []
class_names: List[str] = []
model_ready = False
detection_stats: Dict[int, Any] = {}
stats_lock = threading.Lock()
# OpenCV DNN net.setInput / net.forward are NOT thread-safe — serialize with a lock
inference_lock = threading.Lock()

# Red zone polygons per camera: {camera_id: [{id, name, points:[{x,y},...], color}]}
camera_zones: Dict[int, list] = {}
zones_lock   = threading.Lock()


def load_camera_zones(camera_id: Optional[int] = None):
    """Load active red zone definitions from DB into in-memory cache."""
    import json as _json
    try:
        from db import get_cursor
        with get_cursor() as cur:
            if camera_id is not None:
                cur.execute(
                    "SELECT * FROM red_zones WHERE camera_id=%s AND active=true",
                    (camera_id,),
                )
            else:
                cur.execute("SELECT * FROM red_zones WHERE active=true")
            rows = cur.fetchall()

        grouped: Dict[int, list] = {}
        for row in rows:
            cid = row["camera_id"]
            pts = row["points"]
            if isinstance(pts, str):
                pts = _json.loads(pts)
            grouped.setdefault(cid, []).append({
                "id":    row["id"],
                "name":  row["name"],
                "points": pts,
                "color": row.get("color", "#ff3333"),
            })

        with zones_lock:
            if camera_id is not None:
                camera_zones[camera_id] = grouped.get(camera_id, [])
            else:
                camera_zones.clear()
                camera_zones.update(grouped)
        total = sum(len(v) for v in camera_zones.values())
        print(f"[YOLO] Zones loaded: {total} zones across {len(camera_zones)} cameras")
    except Exception as e:
        print(f"[YOLO] Zone load error: {e}")


def reload_camera_zones(camera_id: int):
    load_camera_zones(camera_id)


# ---------------------------------------------------------------------------
# Model download & load
# ---------------------------------------------------------------------------

def download(url: str, dest: Path, min_size: int = 100) -> bool:
    if dest.exists() and dest.stat().st_size >= min_size:
        print(f"[YOLO] Cached: {dest.name}")
        return True
    print(f"[YOLO] Downloading {dest.name} ...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            f.write(r.read())
        if dest.stat().st_size < min_size:
            dest.unlink()
            return False
        print(f"[YOLO] Done — {dest.stat().st_size // 1024} KB")
        return True
    except Exception as e:
        print(f"[YOLO] Download failed ({dest.name}): {e}")
        if dest.exists():
            dest.unlink()
        return False


def boot_models():
    global net, output_layer_names, class_names, model_ready

    ok_w = download(WEIGHTS_URL, WEIGHTS_PATH, min_size=1_000_000)
    ok_c = download(CFG_URL,     CFG_PATH,     min_size=100)
    ok_n = download(NAMES_URL,   NAMES_PATH,   min_size=10)

    if ok_w and ok_c:
        try:
            net = cv2.dnn.readNetFromDarknet(str(CFG_PATH), str(WEIGHTS_PATH))
            net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            all_layers = net.getLayerNames()
            unconnected = net.getUnconnectedOutLayers()
            output_layer_names = [all_layers[i - 1] for i in unconnected.flatten()]
            print(f"[YOLO] Network loaded. Output layers: {output_layer_names}")
        except Exception as e:
            print(f"[YOLO] Failed to load network: {e}")
            net = None

    if ok_n:
        with open(NAMES_PATH) as f:
            class_names = [l.strip() for l in f if l.strip()]
        print(f"[YOLO] {len(class_names)} COCO classes loaded")

    model_ready = True
    print(f"[YOLO] Ready — net={'OK' if net else 'FAILED'}")


threading.Thread(target=boot_models, daemon=True).start()


# ---------------------------------------------------------------------------
# YOLO inference (YOLOv4-tiny via OpenCV DNN)
# ---------------------------------------------------------------------------

def detect_persons(frame: np.ndarray, input_size: int = 416) -> List[Dict]:
    """Run YOLO detection, return list of person dicts with x1,y1,x2,y2,conf."""
    if net is None:
        return []
    h, w = frame.shape[:2]

    blob = cv2.dnn.blobFromImage(
        frame, 1 / 255.0, (input_size, input_size), swapRB=True, crop=False
    )
    # Serialize inference — OpenCV DNN is not thread-safe
    with inference_lock:
        try:
            net.setInput(blob)
            raw_outputs = net.forward(output_layer_names)
        except Exception as e:
            print(f"[YOLO] Forward pass error: {e}")
            return []

    boxes, confidences = [], []
    for output in raw_outputs:
        for det in output:
            scores = det[5:]
            cls_id = int(np.argmax(scores))
            conf   = float(scores[cls_id])
            if cls_id != PERSON_CLASS or conf < CONF_THRESH:
                continue
            cx, cy, bw, bh = det[0] * w, det[1] * h, det[2] * w, det[3] * h
            x1 = max(0, int(cx - bw / 2))
            y1 = max(0, int(cy - bh / 2))
            boxes.append([x1, y1, int(bw), int(bh)])
            confidences.append(conf)

    if not boxes:
        return []

    indices = cv2.dnn.NMSBoxes(boxes, confidences, CONF_THRESH, NMS_THRESH)
    results = []
    for i in (indices.flatten() if len(indices) > 0 else []):
        x, y, bw, bh = boxes[i]
        results.append({
            "x1": x, "y1": y,
            "x2": min(w, x + bw), "y2": min(h, y + bh),
            "conf": confidences[i],
        })
    return results


# ---------------------------------------------------------------------------
# Color-based PPE compliance — now handled by ppe_detection.py
# analyze_ppe() and run_ppe_detection() imported at the top of this file.
# Set PPE_DETECTION_MODE=yolov8 to use the YOLOv8 PPE model instead of HSV.
# ---------------------------------------------------------------------------
# Fire: bright orange-red and yellow-orange flame colors (high saturation + brightness)
FIRE_HSV: List[Tuple[np.ndarray, np.ndarray]] = [
    (np.array([0,  150, 170]), np.array([18,  255, 255])), # red-orange flame
    (np.array([18, 120, 160]), np.array([35,  255, 255])), # yellow-orange flame
    (np.array([165,150, 170]), np.array([180, 255, 255])), # deep red (hue wraps)
]
# Smoke: low-saturation gray/white haze areas
SMOKE_HSV: List[Tuple[np.ndarray, np.ndarray]] = [
    (np.array([0, 0,  45]),   np.array([180, 55, 215])),  # gray/white smoke haze
]


# _color_ratio and analyze_ppe removed — now live in ppe_detection.py
# analyze_ppe is imported from ppe_detection at the top of this file.


# is_fallen() replaced by is_fallen_pose() from fall_detection.py
# (MediaPipe Pose skeleton keypoint analysis — aspect-ratio used as fallback only)


def detect_fire_smoke(frame: np.ndarray) -> Tuple[bool, bool, float, float]:
    """
    Detect fire and smoke via HSV color analysis on the full frame.
    Returns (is_fire, is_smoke, fire_ratio, smoke_ratio).
    Fire:  bright orange/red/yellow pixels in a connected cluster ≥ 1.5% of frame.
    Smoke: low-saturation gray haze covering ≥ 28% of frame (only when no fire).
    """
    h, w = frame.shape[:2]
    total_px = h * w

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Build fire mask
    fire_mask = np.zeros(hsv.shape[:2], np.uint8)
    for lo, hi in FIRE_HSV:
        fire_mask |= cv2.inRange(hsv, lo, hi)

    # Morphological cleanup — remove noise, keep solid flame blobs
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN,   kernel, iterations=2)
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_DILATE, kernel, iterations=1)

    fire_ratio = float(cv2.countNonZero(fire_mask)) / (total_px + 1e-6)

    # Require at least one connected blob ≥ 1.5 % of frame (avoids orange-hat false positives)
    is_fire = False
    if fire_ratio > 0.02:
        contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        max_blob = max((cv2.contourArea(c) for c in contours), default=0)
        if max_blob > total_px * 0.015:
            is_fire = True

    # Build smoke mask — only when no fire (smoke ≈ desaturated gray haze)
    smoke_mask = np.zeros(hsv.shape[:2], np.uint8)
    for lo, hi in SMOKE_HSV:
        smoke_mask |= cv2.inRange(hsv, lo, hi)
    smoke_ratio = float(cv2.countNonZero(smoke_mask)) / (total_px + 1e-6)
    is_smoke = (smoke_ratio > 0.28) and not is_fire

    return is_fire, is_smoke, fire_ratio, smoke_ratio


def draw_fire_smoke_overlay(frame: np.ndarray, is_fire: bool, is_smoke: bool) -> None:
    """Render a full-frame warning overlay when fire or smoke is detected."""
    if not is_fire and not is_smoke:
        return
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    if is_fire:
        # Layered orange-red border
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 40, 220), 14)
        cv2.rectangle(frame, (5, 5), (w - 6, h - 6), (0, 90, 255), 4)
        # Semi-transparent alert banner at top
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 54), (0, 15, 180), -1)
        cv2.addWeighted(overlay, 0.78, frame, 0.22, 0, frame)
        label = "!! FIRE DETECTED !!"
        (tw, _), _ = cv2.getTextSize(label, font, 1.0, 2)
        cv2.putText(frame, label, (w // 2 - tw // 2, 37),
                    font, 1.0, (0, 200, 255), 2, cv2.LINE_AA)
    else:
        # Gray border for smoke
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (140, 140, 155), 10)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 50), (45, 45, 55), -1)
        cv2.addWeighted(overlay, 0.78, frame, 0.22, 0, frame)
        label = "SMOKE DETECTED"
        (tw, _), _ = cv2.getTextSize(label, font, 0.9, 2)
        cv2.putText(frame, label, (w // 2 - tw // 2, 34),
                    font, 0.9, (190, 190, 210), 2, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------

C_PERSON  = (0, 200, 255)
C_COMPLY  = (30, 220, 80)
C_VIOLATE = (0, 50, 230)
C_WARN    = (0, 140, 255)


def draw_box_with_corners(frame, x1, y1, x2, y2, color, label):
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    m = 12
    for (px, py, dx, dy) in [
        (x1,y1, m,0),(x1,y1,0, m),(x2,y1,-m,0),(x2,y1,0, m),
        (x1,y2, m,0),(x1,y2,0,-m),(x2,y2,-m,0),(x2,y2,0,-m),
    ]:
        cv2.line(frame, (px,py), (px+dx,py+dy), color, 2)

    font = cv2.FONT_HERSHEY_SIMPLEX
    fs = 0.44
    (tw, th), _ = cv2.getTextSize(label, font, fs, 1)
    ty = max(y1 - 3, th + 6)
    cv2.rectangle(frame, (x1, ty - th - 4), (x1 + tw + 6, ty + 2), color, -1)
    txt_c = (0, 0, 0) if color == C_COMPLY else (255, 255, 255)
    cv2.putText(frame, label, (x1 + 3, ty - 1), font, fs, txt_c, 1, cv2.LINE_AA)


def draw_ppe_tags(frame, x1, y1, x2, y2,
                  vest: bool, hat: bool,
                  gloves: bool = False, goggles: bool = False,
                  fallen: bool = False, in_zone: bool = False):
    font = cv2.FONT_HERSHEY_SIMPLEX
    h_frame, w_frame = frame.shape[:2]
    tags = []
    if fallen:
        tags.append(("FALL!", (0, 30, 255)))
    if in_zone:
        tags.append(("IN ZONE", (0, 80, 255)))
    tags.append(("VEST"    if vest    else "NO-VEST",   C_COMPLY if vest    else C_VIOLATE))
    tags.append(("HARDHAT" if hat     else "NO-HAT",    C_COMPLY if hat     else C_VIOLATE))
    tags.append(("GLOVES"  if gloves  else "NO-GLOVE",  C_COMPLY if gloves  else C_VIOLATE))
    tags.append(("GOGGLES" if goggles else "NO-GOGG",   C_COMPLY if goggles else C_VIOLATE))
    tx, ty = x1, min(y2 + 14, h_frame - 4)
    for tag, tc in tags:
        (tw, _), _ = cv2.getTextSize(tag, font, 0.35, 1)
        if tx + tw + 6 > w_frame:
            tx = x1
            ty = min(ty + 16, h_frame - 4)
        cv2.rectangle(frame, (tx, ty - 11), (tx + tw + 4, ty + 2), tc, -1)
        cv2.putText(frame, tag, (tx + 2, ty), font, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
        tx += tw + 6


def add_hud(frame: np.ndarray, camera_id: int) -> np.ndarray:
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    ts = time.strftime("%H:%M:%S")

    cv2.rectangle(frame, (0, 0), (136, 32), (0, 0, 0), -1)
    cv2.putText(frame, f"CAM-{camera_id:02d}", (6, 23), font, 0.72, C_PERSON, 2, cv2.LINE_AA)

    rec = f"REC  {ts}"
    (rw, _), _ = cv2.getTextSize(rec, font, 0.52, 1)
    cv2.rectangle(frame, (w - rw - 28, 0), (w, 32), (0, 0, 0), -1)
    cv2.circle(frame, (w - rw - 14, 16), 6, (0, 0, 200), -1)
    cv2.putText(frame, rec, (w - rw - 4, 23), font, 0.52, (230, 230, 230), 1, cv2.LINE_AA)

    badge = "YOLO v4  AI"
    (bw, _), _ = cv2.getTextSize(badge, font, 0.42, 1)
    bx = w // 2
    cv2.rectangle(frame, (bx - bw//2 - 5, 0), (bx + bw//2 + 5, 22), (0, 70, 0), -1)
    cv2.putText(frame, badge, (bx - bw//2, 15), font, 0.42, (0, 255, 100), 1, cv2.LINE_AA)

    scan_y = int((time.time() % 5.0) / 5.0 * h)
    cv2.line(frame, (0, scan_y), (w, scan_y), (0, 220, 180), 1)
    return frame


def draw_status_bar(frame, person_count: int, violation_count: int, compliance: float):
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    ov = frame.copy()
    cv2.rectangle(ov, (0, h - 44), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.72, frame, 0.28, 0, frame)

    cv2.putText(frame, f"PERSONS: {person_count}", (10, h - 14),
                font, 0.58, C_PERSON, 1, cv2.LINE_AA)

    bc = C_COMPLY if compliance >= 80 else (C_WARN if compliance >= 60 else C_VIOLATE)
    mid = f"PPE: {compliance:.0f}%"
    (mw, _), _ = cv2.getTextSize(mid, font, 0.58, 1)
    cv2.putText(frame, mid, (w//2 - mw//2, h - 14), font, 0.58, bc, 1, cv2.LINE_AA)

    status = "ALL CLEAR" if violation_count == 0 else f"VIOLATIONS: {violation_count}"
    (sw, _), _ = cv2.getTextSize(status, font, 0.58, 1)
    cv2.putText(frame, status, (w - sw - 10, h - 14), font, 0.58,
                C_COMPLY if violation_count == 0 else C_VIOLATE, 1, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Per-camera capture + inference thread
# ---------------------------------------------------------------------------

class PersonDetection:
    __slots__ = ("x1", "y1", "x2", "y2", "conf", "vest", "hat",
                 "gloves", "goggles", "fallen", "in_zone")
    def __init__(self, x1, y1, x2, y2, conf, vest, hat,
                 gloves=False, goggles=False, fallen=False, in_zone=False):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2
        self.conf    = conf
        self.vest    = vest
        self.hat     = hat
        self.gloves  = gloves
        self.goggles = goggles
        self.fallen  = fallen
        self.in_zone = in_zone


class CameraState:
    def __init__(self, cid: int):
        self.cid = cid
        self.frame: Optional[np.ndarray] = None
        self.raw_frame: Optional[np.ndarray] = None
        self.detections: List[PersonDetection] = []
        self.last_stats: Dict[str, Any] = {}
        self.lock = threading.Lock()


camera_states: Dict[int, CameraState] = {cid: CameraState(cid) for cid in VIDEO_PATHS}


C_ZONE   = (30,  30, 220)   # red (BGR) for danger zones
C_FALLEN = (0,   30, 255)   # bright red for fallen persons
C_INZONE = (0,   80, 220)   # red for in-zone persons


def draw_zones(frame: np.ndarray, zones: list):
    """Draw semi-transparent red-zone polygons onto the frame."""
    if not zones:
        return
    h, w = frame.shape[:2]
    overlay = frame.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    for zone in zones:
        pts_norm = zone.get("points", [])
        if len(pts_norm) < 3:
            continue
        try:
            chex = zone.get("color", "#ff3333").lstrip("#")
            r, g, b = int(chex[0:2], 16), int(chex[2:4], 16), int(chex[4:6], 16)
            bgr = (b, g, r)
        except Exception:
            bgr = (30, 30, 220)

        pts_px = np.array(
            [[int(p["x"] * w), int(p["y"] * h)] for p in pts_norm],
            dtype=np.int32,
        )
        cv2.fillPoly(overlay, [pts_px], bgr)
        cv2.polylines(frame, [pts_px], isClosed=True, color=bgr, thickness=2)

        label = zone.get("name", "ZONE")
        cx = int(np.mean(pts_px[:, 0]))
        cy = int(np.mean(pts_px[:, 1]))
        (tw, th), _ = cv2.getTextSize(label, font, 0.50, 1)
        cv2.rectangle(frame, (cx - tw // 2 - 3, cy - th - 4), (cx + tw // 2 + 3, cy + 2), bgr, -1)
        cv2.putText(frame, label, (cx - tw // 2, cy), font, 0.50, (255, 255, 255), 1, cv2.LINE_AA)

    cv2.addWeighted(overlay, 0.22, frame, 0.78, 0, frame)


def annotate_frame(frame: np.ndarray, dets: List["PersonDetection"],
                   person_count: int, violation_count: int, comp: float,
                   zones: Optional[list] = None,
                   is_fire: bool = False, is_smoke: bool = False) -> np.ndarray:
    """Draw zones, detections, fire/smoke overlay, and status bar onto frame."""
    if zones:
        draw_zones(frame, zones)
    for d in dets:
        if d.fallen:
            color = C_FALLEN
            label = f"FALLEN {d.conf:.0%}"
        elif d.in_zone:
            color = C_INZONE
            label = f"IN ZONE {d.conf:.0%}"
        elif d.vest or d.hat:
            color = C_COMPLY
            label = f"PERSON {d.conf:.0%}"
        else:
            color = C_VIOLATE
            label = f"PERSON {d.conf:.0%}"
        draw_box_with_corners(frame, d.x1, d.y1, d.x2, d.y2, color, label)
        draw_ppe_tags(frame, d.x1, d.y1, d.x2, d.y2,
                      d.vest, d.hat, d.gloves, d.goggles, d.fallen, d.in_zone)
    draw_fire_smoke_overlay(frame, is_fire, is_smoke)
    draw_status_bar(frame, person_count, violation_count, comp)
    return frame


def run_camera(cid: int):
    state = camera_states[cid]
    vpath = VIDEO_PATHS.get(cid)

    if not vpath or not vpath.exists():
        blank = np.zeros((480, 640, 3), np.uint8)
        cv2.putText(blank, f"CAM-{cid:02d} VIDEO NOT FOUND", (60, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, C_VIOLATE, 2)
        with state.lock:
            state.frame = blank
        return

    cap = cv2.VideoCapture(str(vpath))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    delay = 1.0 / min(fps, 25)
    detect_every = max(1, int(fps // 8))   # ~8 detections/sec
    idx = 0

    # Last known detections (persist across frames so boxes always display)
    last_dets: List[PersonDetection] = []
    last_person_count = 0
    last_violation_count = 0
    last_comp = 100.0
    last_screenshot_ts = 0.0   # throttle: one screenshot per 30 s per camera
    # Fire / smoke state (persists across frames)
    last_fire = False
    last_smoke = False
    last_env_ts = 0.0          # throttle: one fire/smoke alert per 60 s per camera

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        idx += 1
        h, w = frame.shape[:2]
        if w > 960:
            sc = 960 / w
            frame = cv2.resize(frame, (960, int(h * sc)))

        # Store clean (un-annotated) raw frame for the raw stream endpoint
        raw = frame.copy()

        # --- Fire / smoke detection every 5 frames (lightweight HSV analysis) ---
        if idx % 5 == 0:
            try:
                is_fire, is_smoke, fire_ratio, smoke_ratio = detect_fire_smoke(frame)
                last_fire = is_fire
                last_smoke = is_smoke
                now_env = time.time()
                if (is_fire or is_smoke) and (now_env - last_env_ts) > 60:
                    last_env_ts = now_env
                    env_type = "fire_detected" if is_fire else "smoke_detected"
                    _capture_env_alert(cid, raw, env_type)
            except Exception as e:
                print(f"[YOLO] cam{cid} fire/smoke error: {e}")

        if model_ready and net is not None and idx % detect_every == 0:
            try:
                persons = detect_persons(frame)
                new_dets: List[PersonDetection] = []
                person_count    = 0
                violation_count = 0
                fall_detected   = False
                zone_intrusion  = False

                h_f, w_f = frame.shape[:2]
                with zones_lock:
                    cam_zones = camera_zones.get(cid, [])[:]

                # Run PPE model on the full frame once (no-op in HSV mode)
                ppe_frame_dets = run_ppe_detection(frame)

                for p in persons:
                    x1, y1, x2, y2, conf = p["x1"], p["y1"], p["x2"], p["y2"], p["conf"]
                    vest, hat, gloves, goggles = analyze_ppe(frame, x1, y1, x2, y2, ppe_frame_dets)
                    fallen, _fall_reason = is_fallen_pose(frame, x1, y1, x2, y2)

                    # Red zone check: use person foot-centre (cx, foot) in normalised coords
                    cx_n   = ((x1 + x2) / 2.0) / w_f
                    foot_n = y2 / h_f
                    in_zone = False
                    for zone in cam_zones:
                        pts = zone.get("points", [])
                        if len(pts) < 3:
                            continue
                        pts_arr = np.array([[pt["x"], pt["y"]] for pt in pts], dtype=np.float32)
                        if cv2.pointPolygonTest(pts_arr, (cx_n, foot_n), False) >= 0:
                            in_zone = True
                            break

                    compliant = vest or hat
                    person_count += 1
                    if not compliant or fallen or in_zone:
                        violation_count += 1
                    if fallen:
                        fall_detected = True
                    if in_zone:
                        zone_intrusion = True

                    new_dets.append(PersonDetection(
                        x1, y1, x2, y2, conf, vest, hat,
                        gloves=gloves, goggles=goggles,
                        fallen=fallen, in_zone=in_zone,
                    ))

                comp = round(
                    (person_count - violation_count) / person_count * 100, 1
                ) if person_count > 0 else 100.0

                last_dets = new_dets
                last_person_count   = person_count
                last_violation_count = violation_count
                last_comp = comp

                with stats_lock:
                    detection_stats[cid] = {
                        "personCount": person_count,
                        "violationCount": violation_count,
                        "complianceRate": comp,
                        "fireDetected": last_fire,
                        "smokeDetected": last_smoke,
                        "timestamp": time.time(),
                    }

                # --- Violation screenshot capture (throttled to 1 per 30 s) ---
                now_ts = time.time()
                if violation_count > 0 and (now_ts - last_screenshot_ts) > 30:
                    last_screenshot_ts = now_ts
                    alert_type = (
                        "fall_detected" if fall_detected
                        else "red_zone_intrusion" if zone_intrusion
                        else "missing_ppe"
                    )
                    _capture_violation_screenshot(
                        cid, raw, violation_count, person_count,
                        alert_type=alert_type,
                        fall=fall_detected, zone=zone_intrusion,
                    )

            except Exception as e:
                print(f"[YOLO] cam{cid} error: {e}")

        # Always annotate every frame with the latest known detections
        with zones_lock:
            frame_zones = camera_zones.get(cid, [])[:]
        annotate_frame(frame, last_dets, last_person_count, last_violation_count, last_comp,
                       frame_zones, is_fire=last_fire, is_smoke=last_smoke)
        frame = add_hud(frame, cid)

        with state.lock:
            state.frame = frame.copy()
            state.raw_frame = raw

        time.sleep(delay)

    cap.release()


def _capture_violation_screenshot(cid: int, raw_frame: np.ndarray,
                                   violation_count: int, person_count: int,
                                   alert_type: str = "missing_ppe",
                                   fall: bool = False, zone: bool = False):
    """Save a JPEG screenshot and insert an alert with the screenshot URL."""
    try:
        ts = int(time.time())
        filename = f"cam{cid}_{ts}.jpg"
        cv2.imwrite(str(SCREENSHOTS_DIR / filename), raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        screenshot_url = f"/api/screenshots/{filename}"

        severity = "medium"
        if fall or zone:
            severity = "critical"
        elif violation_count >= 3:
            severity = "critical"
        elif violation_count >= 2:
            severity = "high"

        if fall:
            message = f"Fall detected! Worker down on camera {cid}"
            missing = ["fall_detected"]
        elif zone:
            message = f"Red zone intrusion: {violation_count} person(s) in restricted area on camera {cid}"
            missing = ["red_zone"]
        else:
            message = (
                f"{violation_count} of {person_count} worker(s) missing PPE "
                f"detected by camera {cid}"
            )
            missing = []

        from db import get_cursor
        with get_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO alerts
                  (camera_id, type, severity, message, missing_ppe, status,
                   person_count, screenshot_url, created_at)
                VALUES (%s, %s, %s, %s, %s, 'open', %s, %s, NOW())
            """, (cid, alert_type, severity, message, missing,
                  person_count, screenshot_url))
        print(f"[YOLO] cam{cid} alert ({alert_type}) saved: {filename}")
    except Exception as e:
        print(f"[YOLO] Screenshot capture error cam{cid}: {e}")


def _capture_env_alert(cid: int, raw_frame: np.ndarray, alert_type: str):
    """Save a screenshot and insert a fire or smoke alert."""
    try:
        ts = int(time.time())
        filename = f"cam{cid}_env_{ts}.jpg"
        cv2.imwrite(str(SCREENSHOTS_DIR / filename), raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        screenshot_url = f"/api/screenshots/{filename}"

        if alert_type == "fire_detected":
            message = f"FIRE detected on camera {cid} — immediate evacuation required"
        else:
            message = f"SMOKE detected on camera {cid} — possible fire hazard"

        from db import get_cursor
        with get_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO alerts
                  (camera_id, type, severity, message, missing_ppe, status,
                   person_count, screenshot_url, created_at)
                VALUES (%s, %s, 'critical', %s, %s, 'open', 0, %s, NOW())
            """, (cid, alert_type, message, [], screenshot_url))
        print(f"[YOLO] cam{cid} env alert ({alert_type}) saved: {filename}")
    except Exception as e:
        print(f"[YOLO] Env alert error cam{cid}: {e}")


for cid in VIDEO_PATHS:
    threading.Thread(target=run_camera, args=(cid,), daemon=True).start()


# ---------------------------------------------------------------------------
# MJPEG generator
# ---------------------------------------------------------------------------

def generate_mjpeg(cid: int):
    state = camera_states.get(cid)
    ph = np.zeros((480, 640, 3), np.uint8)
    cv2.putText(ph, f"CAM-{cid:02d}  Loading YOLO...", (80, 230),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, C_PERSON, 2)
    cv2.putText(ph, "Downloading model weights (~24 MB)", (60, 270),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)

    while True:
        frame = ph
        if state is not None:
            with state.lock:
                if state.frame is not None:
                    frame = state.frame

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
        time.sleep(0.04)  # ~25 fps output


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def generate_mjpeg_raw(cid: int):
    """Yield raw (un-annotated) MJPEG frames — no bounding boxes or overlays."""
    state = camera_states.get(cid)
    ph = np.zeros((480, 640, 3), np.uint8)
    cv2.putText(ph, f"CAM-{cid:02d}  RAW FEED", (100, 230),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (200, 200, 200), 2)

    while True:
        frame = ph
        if state is not None:
            with state.lock:
                if state.raw_frame is not None:
                    frame = state.raw_frame
                elif state.frame is not None:
                    frame = state.frame

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
        time.sleep(0.04)


@app.get("/api/yolo/stream/{camera_id}")
def stream(camera_id: int):
    return StreamingResponse(
        generate_mjpeg(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/api/yolo/stream-raw/{camera_id}")
def stream_raw(camera_id: int):
    return StreamingResponse(
        generate_mjpeg_raw(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/api/ppe/mode")
def ppe_mode():
    """Return the active PPE detection mode and model information."""
    return JSONResponse(get_mode_info())


@app.get("/api/yolo/stats/{camera_id}")
def stats(camera_id: int):
    with stats_lock:
        data = detection_stats.get(camera_id, {
            "personCount": 0,
            "violationCount": 0,
            "complianceRate": 100.0,
            "timestamp": time.time(),
        })
    return JSONResponse(data)


@app.get("/api/yolo/status")
def yolo_status():
    return {
        "status": "ok",
        "modelReady": model_ready,
        "netLoaded": net is not None,
        "classes": len(class_names),
    }


@app.get("/api/yolo/health")
def yolo_health():
    return {
        "status": "ok",
        "modelReady": model_ready,
        "netLoaded": net is not None,
        "classes": len(class_names),
    }


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


def _run_seed():
    try:
        from seed import auto_seed_if_empty
        auto_seed_if_empty()
    except Exception as e:
        print(f"[seed] Error: {e}")
    # Load red zones into cache after seeding
    load_camera_zones()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    threading.Thread(target=_run_seed, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
