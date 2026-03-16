"""
MediaPipe Pose-based fall detection for VideoGuard (mediapipe 0.10.x Task API).

Strategy:
  1. At module load, download the PoseLandmarker Lite model (~5.7 MB) once
     and cache it next to this file as pose_landmarker_lite.task.
  2. For each YOLO-detected person bounding box, crop the region
     (padded 15%) and run PoseLandmarker on it.
  3. Use normalised landmark Y-coordinates (0=top, 1=bottom of crop):

     STRONG  : shoulder_y > knee_y   (upper body below knees)
     PRIMARY : hip_y      > knee_y   (hips below knees)
     STANDING: hip_y      < knee_y   AND shoulder_y < knee_y

  4. Fall back to bounding-box aspect ratio (w/h > 0.75) when:
       - Model download / init fails
       - Crop too small (< 48 px)
       - No landmarks detected in the crop
       - Relevant keypoints have visibility < MIN_VISIBILITY

Thread safety:
  PoseLandmarker (IMAGE mode) is NOT thread-safe when shared, so each
  camera thread gets its own instance via threading.local().
"""

import os
import threading
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np

# ── PoseLandmarker landmark indices (same as COCO 17-pt) ─────────────────────
_LEFT_SHOULDER  = 11
_RIGHT_SHOULDER = 12
_LEFT_HIP       = 23
_RIGHT_HIP      = 24
_LEFT_KNEE      = 25
_RIGHT_KNEE     = 26

# ── Tunable constants ─────────────────────────────────────────────────────────
MIN_VISIBILITY   = 0.40   # ignore keypoints with visibility below this
MIN_CROP_PX      = 48     # skip pose on crops smaller than this (either dim)
CROP_PAD_RATIO   = 0.15   # pad bbox by 15% on each side for skeleton context
ASPECT_THRESHOLD = 0.75   # fallback: w/h > this → fallen

_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/latest/"
    "pose_landmarker_lite.task"
)
_MODEL_PATH = str(Path(__file__).parent / "pose_landmarker_lite.task")

# ── Module-level state ────────────────────────────────────────────────────────
_local        = threading.local()
_mp_available = False
_PoseLandmarker       = None
_PoseLandmarkerOpts   = None
_RunningMode          = None
_MpImage              = None


def _ensure_model() -> bool:
    """Download the model file if not already cached. Returns True on success."""
    if os.path.exists(_MODEL_PATH) and os.path.getsize(_MODEL_PATH) > 100_000:
        return True
    try:
        print("[FallDetect] Downloading PoseLandmarker Lite model (~5.7 MB)...")
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        print(f"[FallDetect] Model cached at {_MODEL_PATH}")
        return True
    except Exception as exc:
        print(f"[FallDetect] Model download failed: {exc}")
        return False


def _init_mediapipe():
    global _mp_available, _PoseLandmarker, _PoseLandmarkerOpts, _RunningMode, _MpImage
    try:
        from mediapipe.tasks.python.core.base_options import BaseOptions
        from mediapipe.tasks.python.vision.pose_landmarker import (
            PoseLandmarker, PoseLandmarkerOptions,
        )
        from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
            VisionTaskRunningMode,
        )
        import mediapipe as _mp

        if not _ensure_model():
            print("[FallDetect] Model unavailable — using aspect-ratio fallback.")
            return

        # Smoke-test: verify we can actually create an instance
        _opts_cls  = PoseLandmarkerOptions
        _opts_test = _opts_cls(
            base_options=BaseOptions(model_asset_path=_MODEL_PATH),
            running_mode=VisionTaskRunningMode.IMAGE,
            min_pose_detection_confidence=0.45,
        )
        _lm_test = PoseLandmarker.create_from_options(_opts_test)
        _lm_test.close()

        _PoseLandmarker     = PoseLandmarker
        _PoseLandmarkerOpts = _opts_cls
        _RunningMode        = VisionTaskRunningMode
        _MpImage            = _mp.Image
        _mp_available       = True
        print("[FallDetect] MediaPipe PoseLandmarker Task API loaded — skeleton fall detection active.")

    except Exception as exc:
        print(f"[FallDetect] MediaPipe init failed ({exc.__class__.__name__}: {exc}) — aspect-ratio fallback.")


_init_mediapipe()


# ── Per-thread PoseLandmarker instance ───────────────────────────────────────

def _get_landmarker() -> Optional[object]:
    """Return a thread-local PoseLandmarker, creating it lazily."""
    if not _mp_available:
        return None
    if not hasattr(_local, "lm"):
        try:
            from mediapipe.tasks.python.core.base_options import BaseOptions
            opts = _PoseLandmarkerOpts(
                base_options=BaseOptions(model_asset_path=_MODEL_PATH),
                running_mode=_RunningMode.IMAGE,
                min_pose_detection_confidence=0.45,
            )
            _local.lm = _PoseLandmarker.create_from_options(opts)
        except Exception as exc:
            print(f"[FallDetect] Thread-local landmarker creation failed: {exc}")
            _local.lm = None
    return _local.lm


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lm_y(landmarks: list, idx: int) -> Optional[float]:
    lm = landmarks[idx]
    return lm.y if lm.visibility >= MIN_VISIBILITY else None


def _avg_y(landmarks: list, *indices) -> Optional[float]:
    vals = [_lm_y(landmarks, i) for i in indices]
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


def _aspect_fallen(x1: int, y1: int, x2: int, y2: int) -> bool:
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    return (w / h) > ASPECT_THRESHOLD


# ── Public API ────────────────────────────────────────────────────────────────

def is_fallen_pose(
    frame: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
) -> Tuple[bool, str]:
    """
    Determine whether the person in the bounding box has fallen.

    Uses MediaPipe PoseLandmarker (Task API) when available; falls back to
    bounding-box aspect ratio for small crops or when the model is unavailable.

    Returns
    -------
    (is_fallen: bool, reason: str)
      reason tags: pose:shoulders_below_knees | pose:hips_below_knees |
                   pose:standing | pose:no_landmarks | pose:small_crop |
                   ratio:no_mediapipe | ratio:aspect | ratio:error
    """
    lm = _get_landmarker()

    if lm is not None:
        fh, fw = frame.shape[:2]
        pad_x  = max(8, int((x2 - x1) * CROP_PAD_RATIO))
        pad_y  = max(8, int((y2 - y1) * CROP_PAD_RATIO))
        cx1 = max(0, x1 - pad_x);  cy1 = max(0, y1 - pad_y)
        cx2 = min(fw, x2 + pad_x); cy2 = min(fh, y2 + pad_y)

        crop = frame[cy1:cy2, cx1:cx2]
        ch, cw = crop.shape[:2]

        if ch < MIN_CROP_PX or cw < MIN_CROP_PX:
            return _aspect_fallen(x1, y1, x2, y2), "pose:small_crop"

        try:
            rgb    = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            mp_img = _MpImage(image_format=1, data=rgb)   # format 1 = SRGB
            result = lm.detect(mp_img)

            if result.pose_landmarks:
                lms = result.pose_landmarks[0]   # first (only) detected person

                shoulder_y = _avg_y(lms, _LEFT_SHOULDER, _RIGHT_SHOULDER)
                hip_y      = _avg_y(lms, _LEFT_HIP,      _RIGHT_HIP)
                knee_y     = _avg_y(lms, _LEFT_KNEE,     _RIGHT_KNEE)

                if knee_y is not None:
                    if shoulder_y is not None and shoulder_y > knee_y:
                        return True,  "pose:shoulders_below_knees"
                    if hip_y is not None and hip_y > knee_y:
                        return True,  "pose:hips_below_knees"
                    if hip_y is not None:
                        return False, "pose:standing"

            return _aspect_fallen(x1, y1, x2, y2), "pose:no_landmarks"

        except Exception:
            return _aspect_fallen(x1, y1, x2, y2), "ratio:error"

    reason = "ratio:no_mediapipe" if not _mp_available else "ratio:aspect"
    return _aspect_fallen(x1, y1, x2, y2), reason
