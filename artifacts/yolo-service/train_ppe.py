#!/usr/bin/env python3
"""
PPE YOLOv8 Training Script — VideoGuard
=========================================
Downloads a PPE dataset from Roboflow Universe and fine-tunes
YOLOv8 nano for PPE detection.

On completion the best weights are saved as  artifacts/yolo-service/ppe_model.pt
and VideoGuard will automatically use them when
PPE_DETECTION_MODE=yolov8 is set.

Usage
-----
  # Install extra deps (one-time)
  pip install ultralytics roboflow

  # Run training (30–90 min on CPU, ~5 min on GPU)
  python train_ppe.py --api-key YOUR_ROBOFLOW_KEY

  # Or set via environment variable
  ROBOFLOW_API_KEY=your_key python train_ppe.py

  # Advanced options
  python train_ppe.py \\
      --api-key  YOUR_KEY \\
      --model    yolov8n          # n=nano s=small m=medium (n is fastest) \\
      --epochs   50               # more epochs = better accuracy \\
      --imgsz    640              # image size (must be multiple of 32) \\
      --output   ppe_model.pt     # where to save the final weights

Roboflow dataset used
---------------------
  Workspace  : roboflow-100
  Project    : hard-hat-and-safety-vest-detection-pz8ai
  Version    : 7
  Classes    : Hardhat, Safety Vest, NO-Hardhat, NO-Safety Vest, Person

  Alternative datasets on Roboflow Universe that work with this script:
    - roboflow-100 / ppe-detection-yolov8
    - gabinete / ppe-detection-from-cctv
    - Any dataset exported in YOLOv8 format

After training
--------------
  1. Set PPE_DETECTION_MODE=yolov8 in your environment / .env file.
  2. Optionally set PPE_MODEL_PATH=/path/to/ppe_model.pt for a custom path.
  3. Restart the VideoGuard API server.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

THIS_DIR = Path(__file__).parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train YOLOv8 PPE detection model")
    p.add_argument("--api-key", default=os.environ.get("ROBOFLOW_API_KEY", ""),
                   help="Roboflow API key (or set ROBOFLOW_API_KEY env var)")
    p.add_argument("--workspace",  default="roboflow-100",
                   help="Roboflow workspace slug")
    p.add_argument("--project",    default="hard-hat-and-safety-vest-detection-pz8ai",
                   help="Roboflow project slug")
    p.add_argument("--version",    default=7, type=int,
                   help="Dataset version number")
    p.add_argument("--model",      default="yolov8n",
                   choices=["yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x"],
                   help="YOLOv8 model size (n=nano fastest, x=xlarge most accurate)")
    p.add_argument("--epochs",     default=50, type=int,
                   help="Number of training epochs")
    p.add_argument("--imgsz",      default=640, type=int,
                   help="Input image size (must be multiple of 32)")
    p.add_argument("--output",     default=str(THIS_DIR / "ppe_model.pt"),
                   help="Output path for the trained model weights")
    p.add_argument("--device",     default="",
                   help="Training device: 'cpu', '0' (GPU 0), '' (auto)")
    p.add_argument("--batch",      default=16, type=int,
                   help="Batch size (-1 for auto)")
    return p.parse_args()


def check_deps() -> bool:
    """Check and optionally install required packages."""
    missing = []
    try:
        import ultralytics  # noqa
    except ImportError:
        missing.append("ultralytics")
    try:
        import roboflow  # noqa
    except ImportError:
        missing.append("roboflow")

    if missing:
        print(f"Missing packages: {', '.join(missing)}")
        ans = input("Install them now? [y/N] ").strip().lower()
        if ans == "y":
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
            print("Packages installed. Please re-run the script.")
        else:
            print("Install with:  pip install " + " ".join(missing))
        return False
    return True


def download_dataset(args: argparse.Namespace) -> Path:
    """Download dataset from Roboflow and return the path to data.yaml."""
    from roboflow import Roboflow

    print(f"\n[Step 1] Connecting to Roboflow …")
    rf = Roboflow(api_key=args.api_key)
    project = rf.workspace(args.workspace).project(args.project)
    version  = project.version(args.version)

    print(f"[Step 1] Downloading dataset v{args.version} in YOLOv8 format …")
    dataset = version.download("yolov8", location=str(THIS_DIR / "ppe_dataset"))

    yaml_path = Path(dataset.location) / "data.yaml"
    if not yaml_path.exists():
        # Search for it
        hits = list(Path(dataset.location).rglob("data.yaml"))
        if not hits:
            raise FileNotFoundError(f"data.yaml not found in {dataset.location}")
        yaml_path = hits[0]

    print(f"[Step 1] Dataset ready. Config: {yaml_path}")
    return yaml_path


def train(args: argparse.Namespace, yaml_path: Path) -> Path:
    """Train YOLOv8 and return path to best weights."""
    from ultralytics import YOLO

    model_name = f"{args.model}.pt"
    print(f"\n[Step 2] Loading base model {model_name} …")
    model = YOLO(model_name)

    run_dir = THIS_DIR / "ppe_runs"
    run_dir.mkdir(exist_ok=True)

    print(f"\n[Step 2] Training for {args.epochs} epochs  "
          f"(image size {args.imgsz}, batch {args.batch}) …")
    print("         This may take 30–90 minutes on CPU.\n")

    results = model.train(
        data    = str(yaml_path),
        epochs  = args.epochs,
        imgsz   = args.imgsz,
        batch   = args.batch,
        device  = args.device or "cpu",
        project = str(run_dir),
        name    = "ppe",
        verbose = True,
    )

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    if not best_pt.exists():
        # Fallback search
        hits = list(run_dir.rglob("best.pt"))
        if not hits:
            raise FileNotFoundError("best.pt not found after training")
        best_pt = max(hits, key=lambda p: p.stat().st_mtime)

    return best_pt


def validate(model_path: Path, yaml_path: Path) -> None:
    """Run validation and print mAP metrics."""
    from ultralytics import YOLO
    print(f"\n[Step 3] Validating model …")
    model = YOLO(str(model_path))
    metrics = model.val(data=str(yaml_path), verbose=True)
    print(f"\n[Step 3] mAP50: {metrics.box.map50:.3f}  "
          f"mAP50-95: {metrics.box.map:.3f}")


def main() -> None:
    args = parse_args()

    if not args.api_key:
        print("ERROR: Roboflow API key required.")
        print("  Pass --api-key YOUR_KEY  or  set  ROBOFLOW_API_KEY env var.")
        print("  Get your free key at: https://app.roboflow.com")
        sys.exit(1)

    if not check_deps():
        sys.exit(1)

    print("=" * 60)
    print("  VideoGuard — PPE YOLOv8 Training")
    print(f"  Model   : {args.model}")
    print(f"  Epochs  : {args.epochs}")
    print(f"  Output  : {args.output}")
    print("=" * 60)

    yaml_path = download_dataset(args)
    best_pt   = train(args, yaml_path)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(best_pt, output)
    print(f"\n✅ Training complete! Model saved to: {output}")
    print(f"\nNext steps:")
    print(f"  1. Set  PPE_DETECTION_MODE=yolov8  in your environment")
    if str(output) != str(THIS_DIR / "ppe_model.pt"):
        print(f"  2. Set  PPE_MODEL_PATH={output}")
    print(f"  3. Restart the VideoGuard API server")

    try:
        validate(output, yaml_path)
    except Exception as e:
        print(f"Validation skipped: {e}")


if __name__ == "__main__":
    main()
