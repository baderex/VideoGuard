"""
YOLO PPE Detection Service
- Downloads YOLOv4-tiny weights on first run (~24 MB)
- Runs real YOLO object detection via OpenCV DNN (no PyTorch required)
- Person detection from COCO classes, PPE compliance via color analysis
- Streams annotated MJPEG frames per camera
"""

import os
import time
import threading
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI(title="YOLO PPE Detection Service")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

BASE_PATH = Path(__file__).parent.parent.parent
CACHE_DIR = BASE_PATH / "artifacts/yolo-service/.cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

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
# Color-based PPE compliance
# ---------------------------------------------------------------------------

HIVIS_HSV: List[Tuple[np.ndarray, np.ndarray]] = [
    (np.array([18, 80, 80]),  np.array([42, 255, 255])),   # yellow
    (np.array([5, 100, 100]), np.array([18, 255, 255])),   # orange
    (np.array([38, 50, 50]),  np.array([80, 255, 200])),   # lime/green
]
HAT_HSV: List[Tuple[np.ndarray, np.ndarray]] = [
    (np.array([0,   0, 180]),   np.array([180, 40, 255])), # white
    (np.array([18, 80, 100]),   np.array([40, 255, 255])), # yellow
    (np.array([0, 100, 100]),   np.array([15, 255, 255])), # red/orange
    (np.array([90, 50, 50]),    np.array([130, 255, 255])),# blue
]


def _color_ratio(region: np.ndarray, ranges: List[Tuple]) -> float:
    if region.size == 0:
        return 0.0
    hsv  = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    mask = np.zeros(hsv.shape[:2], np.uint8)
    for lo, hi in ranges:
        mask |= cv2.inRange(hsv, lo, hi)
    return float(mask.sum()) / (mask.size + 1e-6)


def ppe_compliant(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> Tuple[bool, bool]:
    """Returns (has_vest, has_hat) based on region color analysis."""
    mid_y   = (y1 + y2) // 2
    torso   = frame[mid_y:y2, x1:x2]
    head_y2 = y1 + max(1, (y2 - y1) // 4)
    head    = frame[y1:head_y2, x1:x2]

    vest = _color_ratio(torso, HIVIS_HSV) > 0.08
    hat  = _color_ratio(head,  HAT_HSV)  > 0.07
    return vest, hat


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


def draw_ppe_tags(frame, x1, y1, x2, y2, vest: bool, hat: bool):
    font = cv2.FONT_HERSHEY_SIMPLEX
    tags = []
    tags.append(("VEST" if vest else "NO-VEST", C_COMPLY if vest else C_VIOLATE))
    tags.append(("HARDHAT" if hat else "NO-HAT",   C_COMPLY if hat  else C_VIOLATE))
    tx, ty = x1, y2 + 14
    for tag, tc in tags:
        (tw, _), _ = cv2.getTextSize(tag, font, 0.38, 1)
        cv2.rectangle(frame, (tx, ty - 12), (tx + tw + 4, ty + 2), tc, -1)
        cv2.putText(frame, tag, (tx + 2, ty), font, 0.38, (0,0,0), 1, cv2.LINE_AA)
        tx += tw + 8


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
    __slots__ = ("x1", "y1", "x2", "y2", "conf", "vest", "hat")
    def __init__(self, x1, y1, x2, y2, conf, vest, hat):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2
        self.conf = conf
        self.vest = vest
        self.hat  = hat


class CameraState:
    def __init__(self, cid: int):
        self.cid = cid
        self.frame: Optional[np.ndarray] = None
        self.detections: List[PersonDetection] = []
        self.last_stats: Dict[str, Any] = {}
        self.lock = threading.Lock()


camera_states: Dict[int, CameraState] = {cid: CameraState(cid) for cid in VIDEO_PATHS}


def annotate_frame(frame: np.ndarray, dets: List["PersonDetection"],
                    person_count: int, violation_count: int, comp: float) -> np.ndarray:
    """Draw all stored detections and status bar onto frame."""
    for d in dets:
        compliant = d.vest or d.hat
        color = C_COMPLY if compliant else C_VIOLATE
        draw_box_with_corners(frame, d.x1, d.y1, d.x2, d.y2, color, f"PERSON {d.conf:.0%}")
        draw_ppe_tags(frame, d.x1, d.y1, d.x2, d.y2, d.vest, d.hat)
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

        if model_ready and net is not None and idx % detect_every == 0:
            try:
                persons = detect_persons(frame)
                new_dets: List[PersonDetection] = []
                person_count   = 0
                violation_count = 0

                for p in persons:
                    x1, y1, x2, y2, conf = p["x1"], p["y1"], p["x2"], p["y2"], p["conf"]
                    vest, hat = ppe_compliant(frame, x1, y1, x2, y2)
                    compliant = vest or hat
                    person_count += 1
                    if not compliant:
                        violation_count += 1
                    new_dets.append(PersonDetection(x1, y1, x2, y2, conf, vest, hat))

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
                        "timestamp": time.time(),
                    }
            except Exception as e:
                print(f"[YOLO] cam{cid} error: {e}")

        # Always annotate every frame with the latest known detections
        annotate_frame(frame, last_dets, last_person_count, last_violation_count, last_comp)
        frame = add_hud(frame, cid)

        with state.lock:
            state.frame = frame.copy()

        time.sleep(delay)

    cap.release()


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

@app.get("/yolo/stream/{camera_id}")
def stream(camera_id: int):
    return StreamingResponse(
        generate_mjpeg(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/yolo/stats/{camera_id}")
def stats(camera_id: int):
    with stats_lock:
        data = detection_stats.get(camera_id, {
            "personCount": 0,
            "violationCount": 0,
            "complianceRate": 100.0,
            "timestamp": time.time(),
        })
    return JSONResponse(data)


@app.get("/yolo/health")
def health():
    return {
        "status": "ok",
        "modelReady": model_ready,
        "netLoaded": net is not None,
        "classes": len(class_names),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 6000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
