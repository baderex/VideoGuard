#!/usr/bin/env bash
set -e

# Resolve the Python executable
PYTHON=""
for candidate in \
  "$PYTHON" \
  "$(dirname "$0")/../../.pythonlibs/bin/python3" \
  "/home/runner/workspace/.pythonlibs/bin/python3" \
  "python3" \
  "python"; do
  if [ -n "$candidate" ] && "$candidate" --version >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[start.sh] WARNING: Python not found — YOLO service will be unavailable"
else
  echo "[start.sh] Using Python: $PYTHON"

  REQUIREMENTS="$(dirname "$0")/../../artifacts/yolo-service/requirements.txt"
  if [ -f "$REQUIREMENTS" ]; then
    echo "[start.sh] Installing Python dependencies..."
    "$PYTHON" -m pip install -q -r "$REQUIREMENTS" || echo "[start.sh] pip install failed — continuing anyway"
  fi
fi

echo "[start.sh] Starting API server..."
exec node "$(dirname "$0")/dist/index.cjs"
