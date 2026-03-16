"""
MediaPipe Pose-based fall detection for VideoGuard.

Strategy:
  1. For each YOLO-detected person bounding box, crop the person region
     (padded by 15% for better skeleton coverage).
  2. Run MediaPipe Pose (model_complexity=0 — fastest) on the crop.
  3. Use normalised keypoint Y-coordinates (0=top, 1=bottom of crop) to
     determine body orientation:

     STRONG   : shoulder_y  > knee_y   → torso/upper body is below knees
     PRIMARY  : hip_y       > knee_y   → hips below knees
     STANDING : hip_y       < knee_y   AND shoulder_y < knee_y → upright

  4. Fall back to bounding-box aspect ratio (w/h > 0.75) when:
       - MediaPipe is not installed
       - The crop is too small (< 48 px) to get reliable landmarks
       - Pose landmarks are not detected in the crop
       - All relevant keypoints have visibility < MIN_VISIBILITY threshold

Thread safety:
  Each camera runs in its own thread. A single mediapipe.solutions.pose.Pose
  instance is NOT thread-safe, so we use threading.local() to give each
  thread its own instance (lazily initialised on first use).
"""

import threading
import numpy as np
import cv2
from typing import Optional, Tuple

# ── MediaPipe landmark indices ────────────────────────────────────────────────
_LEFT_SHOULDER  = 11
_RIGHT_SHOULDER = 12
_LEFT_HIP       = 23
_RIGHT_HIP      = 24
_LEFT_KNEE      = 25
_RIGHT_KNEE     = 26
_LEFT_ANKLE     = 27
_RIGHT_ANKLE    = 28

# ── Tunable constants ─────────────────────────────────────────────────────────
MIN_VISIBILITY   = 0.40   # ignore keypoints with visibility below this
MIN_CROP_PX      = 48     # skip pose on crops smaller than this in either dim
CROP_PAD_RATIO   = 0.15   # pad bbox by 15% on each side before cropping
ASPECT_THRESHOLD = 0.75   # fallback: w/h ratio above this → fallen

# ── Module-level state ────────────────────────────────────────────────────────
_local         = threading.local()
_mp_available  = False
_mp_pose_mod   = None

try:
    import mediapipe as mp
    _mp_pose_mod  = mp.solutions.pose
    _mp_available = True
    print("[FallDetect] MediaPipe Pose loaded — using skeleton keypoint fall detection.")
except ImportError:
    print("[FallDetect] MediaPipe not installed — falling back to aspect-ratio heuristic.")


# ── Thread-local pose instance ────────────────────────────────────────────────

def _get_pose():
    """Return a per-thread MediaPipe Pose instance, creating it on first access."""
    if not _mp_available:
        return None
    if not hasattr(_local, "pose"):
        _local.pose = _mp_pose_mod.Pose(
            static_image_mode=True,
            model_complexity=0,           # fastest model variant (~50 ms / crop on CPU)
            enable_segmentation=False,
            min_detection_confidence=0.45,
            min_tracking_confidence=0.45,
        )
    return _local.pose


# ── Helpers ───────────────────────────────────────────────────────────────────

def _visible_y(landmarks, idx: int) -> Optional[float]:
    """Return normalised Y of landmark idx if visibility >= threshold, else None."""
    lm = landmarks[idx]
    return lm.y if lm.visibility >= MIN_VISIBILITY else None


def _avg_y(landmarks, *indices) -> Optional[float]:
    """Average visible Y-coordinates of the given landmark indices."""
    vals = [_visible_y(landmarks, i) for i in indices]
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
    Determine if the person in the given bounding box has fallen.

    Parameters
    ----------
    frame : np.ndarray  Full camera frame (BGR).
    x1, y1, x2, y2 : int  YOLO bounding box coordinates.

    Returns
    -------
    (is_fallen: bool, reason: str)
      reason is one of:
        "pose:shoulders_below_knees"
        "pose:hips_below_knees"
        "pose:standing"
        "pose:no_landmarks"
        "pose:small_crop"
        "ratio:aspect"          ← aspect-ratio fallback
        "ratio:no_mediapipe"    ← MediaPipe not installed
    """
    pose = _get_pose()

    if pose is not None:
        fh, fw = frame.shape[:2]

        # Pad the crop for better context
        pad_x = max(8, int((x2 - x1) * CROP_PAD_RATIO))
        pad_y = max(8, int((y2 - y1) * CROP_PAD_RATIO))
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(fw, x2 + pad_x)
        cy2 = min(fh, y2 + pad_y)

        crop = frame[cy1:cy2, cx1:cx2]
        ch, cw = crop.shape[:2]

        if ch < MIN_CROP_PX or cw < MIN_CROP_PX:
            # Crop too small — use fallback
            return _aspect_fallen(x1, y1, x2, y2), "pose:small_crop"

        try:
            rgb    = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)

            if result.pose_landmarks:
                lms = result.pose_landmarks.landmark

                shoulder_y = _avg_y(lms, _LEFT_SHOULDER, _RIGHT_SHOULDER)
                hip_y      = _avg_y(lms, _LEFT_HIP,      _RIGHT_HIP)
                knee_y     = _avg_y(lms, _LEFT_KNEE,     _RIGHT_KNEE)

                if knee_y is not None:
                    # Strong signal: upper body (shoulders) below knees
                    if shoulder_y is not None and shoulder_y > knee_y:
                        return True, "pose:shoulders_below_knees"

                    # Primary signal: hips below knees
                    if hip_y is not None and hip_y > knee_y:
                        return True, "pose:hips_below_knees"

                    # Verified standing
                    if hip_y is not None:
                        return False, "pose:standing"

            # Landmarks present but knee not visible — use aspect ratio
            return _aspect_fallen(x1, y1, x2, y2), "pose:no_landmarks"

        except Exception:
            pass  # fall through to aspect ratio on any error

    # MediaPipe not available
    reason = "ratio:no_mediapipe" if not _mp_available else "ratio:aspect"
    return _aspect_fallen(x1, y1, x2, y2), reason
