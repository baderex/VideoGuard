"""
PPE Compliance Detection — VideoGuard
======================================
Two modes, switchable at any time via the PPE_DETECTION_MODE env var:

  hsv    (default)
         Fast HSV color analysis on person body sub-regions.
         No model files needed. Works out of the box.
         Known limitation: same-colour clothing produces false positives.

  yolov8
         Pre-trained YOLOv8 PPE detection model.
         Much more accurate for hardhat & safety vest.
         Model auto-downloaded from HuggingFace on first run (~22 MB).
         Custom model supported via PPE_MODEL_PATH env var.

         For items not covered by the model (gloves, goggles) the HSV
         method is used automatically as a complementary fallback.

Environment variables
---------------------
PPE_DETECTION_MODE   "hsv" | "yolov8"   (default: "hsv")
PPE_MODEL_PATH       Path to a custom .pt file            (optional)
PPE_CONFIDENCE       Detection confidence threshold       (default: 0.35)

Architecture
------------
  run_ppe_detection(frame) → List[PPEBox]
      Run the PPE model on a full frame. Returns all PPE bounding boxes.
      In HSV mode returns an empty list (analysis is per-person).
      Call once per inference cycle and pass the result to analyze_ppe().

  analyze_ppe(frame, x1, y1, x2, y2, frame_dets) → (vest, hat, gloves, goggles)
      Determine PPE compliance for ONE person bounding box.
      frame_dets is the list returned by run_ppe_detection().
"""

import os
import threading
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

# ── Configuration ─────────────────────────────────────────────────────────────
PPE_MODE       = os.environ.get("PPE_DETECTION_MODE", "hsv").lower().strip()
PPE_MODEL_PATH = os.environ.get("PPE_MODEL_PATH", "")
PPE_CONF       = float(os.environ.get("PPE_CONFIDENCE", "0.35"))

_MODEL_HF_URL  = (
    "https://huggingface.co/keremberke/yolov8s-ppe-detection"
    "/resolve/main/best.pt"
)
_MODEL_CACHE   = str(Path(__file__).parent / "ppe_model.pt")

# ── YOLOv8 class name → (ppe_category, wearing:bool) ─────────────────────────
# Covers keremberke/yolov8s-ppe-detection (10 classes) and common variants.
_CLASS_MAP: dict = {
    # wearing PPE
    "hardhat":          ("hat",    True),
    "hard hat":         ("hat",    True),
    "hard-hat":         ("hat",    True),
    "helmet":           ("hat",    True),
    "safety helmet":    ("hat",    True),
    "safety vest":      ("vest",   True),
    "safety_vest":      ("vest",   True),
    "vest":             ("vest",   True),
    "hi-vis":           ("vest",   True),
    "hiviz":            ("vest",   True),
    "jacket":           ("vest",   True),   # some datasets label it "jacket"
    "gloves":           ("gloves", True),
    "safety gloves":    ("gloves", True),
    "goggles":          ("goggles",True),
    "safety glasses":   ("goggles",True),
    "glasses":          ("goggles",True),
    "face shield":      ("goggles",True),
    # NOT wearing PPE
    "no-hardhat":       ("hat",    False),
    "no hardhat":       ("hat",    False),
    "no-helmet":        ("hat",    False),
    "no-safety vest":   ("vest",   False),
    "no safety vest":   ("vest",   False),
    "no-vest":          ("vest",   False),
    "no-jacket":        ("vest",   False),
    "no-gloves":        ("gloves", False),
    "no-glasses":       ("goggles",False),
    "no-face shield":   ("goggles",False),
}


@dataclass
class PPEBox:
    """A single PPE detection on a frame."""
    x1: int
    y1: int
    x2: int
    y2: int
    category: str     # "vest" | "hat" | "gloves" | "goggles"
    wearing:  bool    # True = has the item, False = missing
    conf:     float
    label:    str     # raw model class name


# ── HSV colour palettes (kept identical to original main.py) ──────────────────
_HIVIS_HSV = [
    (np.array([18, 80,  80]),  np.array([42, 255, 255])),
    (np.array([5,  100, 100]), np.array([18, 255, 255])),
    (np.array([38, 50,  50]),  np.array([80, 255, 200])),
]
_HAT_HSV = [
    (np.array([0,   0, 180]),  np.array([180, 40, 255])),
    (np.array([18, 80, 100]),  np.array([40, 255, 255])),
    (np.array([0, 100, 100]),  np.array([15, 255, 255])),
    (np.array([90, 50,  50]),  np.array([130, 255, 255])),
]
_GLOVES_HSV = [
    (np.array([15, 60,  60]),  np.array([45, 255, 255])),
    (np.array([5,  100, 80]),  np.array([18, 255, 255])),
    (np.array([85, 60,  50]),  np.array([130, 255, 255])),
    (np.array([0,  100, 80]),  np.array([10, 255, 255])),
    (np.array([165,100, 80]),  np.array([180, 255, 255])),
]
_GOGGLES_HSV = [
    (np.array([15, 50, 100]),  np.array([42, 255, 255])),
    (np.array([5,  80, 100]),  np.array([20, 255, 255])),
    (np.array([85, 60,  50]),  np.array([130, 255, 255])),
]


def _color_ratio(region: np.ndarray, ranges: list) -> float:
    if region.size == 0:
        return 0.0
    hsv  = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    mask = np.zeros(hsv.shape[:2], np.uint8)
    for lo, hi in ranges:
        mask |= cv2.inRange(hsv, lo, hi)
    return float(mask.sum()) / (mask.size + 1e-6)


def _hsv_analyze(
    frame: np.ndarray, x1: int, y1: int, x2: int, y2: int
) -> Tuple[bool, bool, bool, bool]:
    """Pure HSV region analysis (original algorithm)."""
    bh      = max(1, y2 - y1)
    mid_y   = (y1 + y2) // 2
    head_y2 = y1 + max(1, bh // 4)
    face_y1 = head_y2
    face_y2 = y1 + max(1, bh * 2 // 5)
    lower_y = y1 + bh * 3 // 5

    torso  = frame[mid_y   : y2,       x1:x2]
    head   = frame[y1      : head_y2,  x1:x2]
    face   = frame[face_y1 : face_y2,  x1:x2]
    lower  = frame[lower_y : y2,       x1:x2]

    vest    = _color_ratio(torso, _HIVIS_HSV)  > 0.08
    hat     = _color_ratio(head,  _HAT_HSV)    > 0.07
    gloves  = _color_ratio(lower, _GLOVES_HSV) > 0.06
    goggles = _color_ratio(face,  _GOGGLES_HSV)> 0.05
    return vest, hat, gloves, goggles


# ── YOLOv8 PPE model ──────────────────────────────────────────────────────────
_yolo_model      = None
_yolo_lock       = threading.Lock()
_yolo_ready      = False
_yolo_class_map  : dict = {}   # int class_id → (category, wearing)


def _resolve_model_path() -> Optional[str]:
    """Return path to the .pt file, downloading if needed."""
    # 1. User-specified path
    if PPE_MODEL_PATH and Path(PPE_MODEL_PATH).exists():
        return PPE_MODEL_PATH
    # 2. Custom model already in service dir
    if Path(_MODEL_CACHE).exists() and Path(_MODEL_CACHE).stat().st_size > 1_000_000:
        return _MODEL_CACHE
    # 3. Download from HuggingFace
    try:
        print(f"[PPEDet] Downloading YOLOv8 PPE model (~22 MB) from HuggingFace …")
        req = urllib.request.Request(_MODEL_HF_URL, headers={"User-Agent": "VideoGuard/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp, \
             open(_MODEL_CACHE, "wb") as out:
            out.write(resp.read())
        size_mb = Path(_MODEL_CACHE).stat().st_size / 1_048_576
        print(f"[PPEDet] Model saved to {_MODEL_CACHE} ({size_mb:.1f} MB)")
        return _MODEL_CACHE
    except Exception as exc:
        print(f"[PPEDet] Download failed: {exc}")
        return None


def _init_yolo():
    global _yolo_model, _yolo_ready, _yolo_class_map
    model_path = _resolve_model_path()
    if model_path is None:
        print("[PPEDet] No model available — falling back to HSV mode.")
        return
    try:
        from ultralytics import YOLO  # noqa
        with _yolo_lock:
            m = YOLO(model_path)
            # Build class-id → (category, wearing) lookup from the model's names
            _yolo_class_map = {}
            for cid, name in m.names.items():
                key = name.lower().strip()
                if key in _CLASS_MAP:
                    _yolo_class_map[cid] = _CLASS_MAP[key]
            _yolo_model = m
            _yolo_ready = True
        print(f"[PPEDet] YOLOv8 PPE model loaded. Classes mapped: "
              f"{[m.names[c] for c in _yolo_class_map]} "
              f"from {list(m.names.values())}")
    except ImportError:
        print("[PPEDet] ultralytics not installed — run: pip install ultralytics")
    except Exception as exc:
        print(f"[PPEDet] Model load failed: {exc} — falling back to HSV mode.")


def _effective_mode() -> str:
    """Return the actual mode in use (yolov8 may degrade to hsv if model missing)."""
    if PPE_MODE == "yolov8":
        return "yolov8" if _yolo_ready else "hsv"
    return "hsv"


# Initialise YOLOv8 if requested
if PPE_MODE == "yolov8":
    _init_yolo()

print(f"[PPEDet] Mode: {_effective_mode()} "
      f"(requested: {PPE_MODE})")


# ── Public API ────────────────────────────────────────────────────────────────

def run_ppe_detection(frame: np.ndarray) -> List[PPEBox]:
    """
    Run PPE model on a full frame and return all PPE bounding boxes.

    Call this once per inference cycle. Pass the returned list to
    analyze_ppe() for each person in the frame.

    In HSV mode: returns an empty list (per-person analysis is done inside
    analyze_ppe instead).
    """
    if not _yolo_ready:
        return []

    try:
        with _yolo_lock:
            results = _yolo_model.predict(
                frame,
                conf=PPE_CONF,
                verbose=False,
                imgsz=640,
            )
        boxes: List[PPEBox] = []
        if results and results[0].boxes is not None:
            r = results[0]
            for i in range(len(r.boxes)):
                cid  = int(r.boxes.cls[i].item())
                conf = float(r.boxes.conf[i].item())
                xyxy = r.boxes.xyxy[i].cpu().numpy().astype(int)
                if cid not in _yolo_class_map:
                    continue
                category, wearing = _yolo_class_map[cid]
                boxes.append(PPEBox(
                    x1=int(xyxy[0]), y1=int(xyxy[1]),
                    x2=int(xyxy[2]), y2=int(xyxy[3]),
                    category=category, wearing=wearing,
                    conf=conf, label=_yolo_model.names[cid],
                ))
        return boxes
    except Exception as exc:
        print(f"[PPEDet] Inference error: {exc}")
        return []


def _iou(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) -> float:
    """Intersection-over-Union of two boxes."""
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    iw  = max(0, ix2 - ix1); ih = max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return inter / (area_a + area_b - inter + 1e-6)


def analyze_ppe(
    frame: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    frame_dets: Optional[List[PPEBox]] = None,
) -> Tuple[bool, bool, bool, bool]:
    """
    Determine PPE compliance for a single person bounding box.

    Parameters
    ----------
    frame      : Full camera frame (BGR).
    x1..y2     : Person bounding box.
    frame_dets : Result from run_ppe_detection(). Pass None in HSV mode.

    Returns
    -------
    (has_vest, has_hat, has_gloves, has_goggles)
    """
    mode = _effective_mode()

    if mode == "yolov8" and frame_dets is not None:
        # --- YOLOv8 path -------------------------------------------------------
        # For each PPE category, check if any overlapping detection says "wearing"
        # or "not wearing". If both exist, the highest-confidence one wins.
        scores: dict = {}   # category → (wearing, conf)

        for det in frame_dets:
            iou = _iou(x1, y1, x2, y2, det.x1, det.y1, det.x2, det.y2)
            if iou < 0.05:      # minimal overlap required
                continue
            prev = scores.get(det.category)
            if prev is None or det.conf > prev[1]:
                scores[det.category] = (det.wearing, det.conf)

        vest    = scores.get("vest",    (False, 0))[0]
        hat     = scores.get("hat",     (False, 0))[0]
        # Gloves / goggles not always in PPE models → fall back to HSV
        if "gloves" in scores:
            gloves = scores["gloves"][0]
        else:
            _, _, gloves, _ = _hsv_analyze(frame, x1, y1, x2, y2)
        if "goggles" in scores:
            goggles = scores["goggles"][0]
        else:
            _, _, _, goggles = _hsv_analyze(frame, x1, y1, x2, y2)

        return vest, hat, gloves, goggles

    # --- HSV path (default) -----------------------------------------------
    return _hsv_analyze(frame, x1, y1, x2, y2)


def get_mode_info() -> dict:
    """Return a dict describing the current detection mode (for the API)."""
    return {
        "requested": PPE_MODE,
        "active":    _effective_mode(),
        "model_path": _MODEL_CACHE if _yolo_ready else None,
        "model_classes": (
            {str(cid): (_yolo_model.names[cid], cat, wear)
             for cid, (cat, wear) in _yolo_class_map.items()}
            if _yolo_ready and _yolo_model else {}
        ),
    }
