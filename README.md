# VideoGuard — AI-Powered PPE Compliance System

Real-time video analytics platform that monitors industrial camera feeds using YOLOv4 object detection to enforce PPE (Personal Protective Equipment) compliance.

---

## Features

- **Live YOLO Detection** — YOLOv4-tiny neural network detects persons in real time across 6 concurrent camera feeds
- **Bounding Boxes & Confidence Scores** — Every detected person is annotated with a green/red corner-style bounding box and YOLO confidence score
- **PPE Compliance Analysis** — Color-based heuristics identify high-vis vests and hard hats on each detected person
- **MJPEG Video Stream** — Annotated frames streamed at 25fps via MJPEG directly from the Python inference service
- **Live Telemetry Panel** — Person count and compliance % updated every 2 seconds per camera
- **Dark Industrial Dashboard** — React/Vite frontend with a dark theme, camera grid, alerts feed, and report generation
- **Alerts & Reports** — Automatic PostgreSQL-backed alerts for compliance violations; historical reports per camera/shift

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React/Vite Frontend  (port via Replit proxy)            │
│  – Camera grid, detail pages, alerts, reports            │
└────────────────────────┬─────────────────────────────────┘
                         │ MJPEG stream + REST API
┌────────────────────────▼─────────────────────────────────┐
│  Express API Server  (port 8080)                         │
│  – REST routes, PostgreSQL via Drizzle ORM               │
│  – Proxies /api/yolo/* → Python service (port 6000)      │
└────────────────────────┬─────────────────────────────────┘
                         │ spawns on startup
┌────────────────────────▼─────────────────────────────────┐
│  Python FastAPI + Uvicorn  (port 6000)                   │
│  – YOLOv4-tiny via OpenCV DNN (no PyTorch required)      │
│  – 6 camera threads: capture → detect → annotate → MJPEG │
│  – PPE heuristics: vest (HSV color) + hard hat (head ROI) │
└──────────────────────────────────────────────────────────┘
                         │ reads
┌────────────────────────▼─────────────────────────────────┐
│  PostgreSQL  (Drizzle ORM schema)                        │
│  – cameras, alerts, reports, compliance_events           │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| API Server | Node.js 24, Express 5, TypeScript |
| ORM | Drizzle ORM + drizzle-zod |
| Database | PostgreSQL |
| AI Vision | Python 3.11, OpenCV DNN, YOLOv4-tiny |
| Inference API | FastAPI + Uvicorn |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
artifacts/
  api-server/          # Express API (port 8080)
    src/
      app.ts           # Express app + YOLO proxy
      index.ts         # Entry point — spawns Python service
      lib/auto-seed.ts # DB seeder (cameras, sample alerts)
  ppe-dashboard/       # React/Vite frontend
    src/
      pages/           # Dashboard, Cameras, Alerts, Reports
      components/      # SimulatedFeed → real MJPEG stream
    public/feeds/      # Input video files (cam1–cam6.mp4)
  yolo-service/        # Python inference service
    main.py            # FastAPI + YOLOv4 detection + MJPEG
    .cache/            # Auto-downloaded model weights (gitignored)
lib/
  db/src/schema/       # Drizzle schema (cameras, alerts, reports)
  api-spec/            # OpenAPI spec
  api-client-react/    # Generated React Query hooks
```

---

## Getting Started

### Prerequisites

- Node.js 24 + pnpm
- Python 3.11 with pip
- PostgreSQL (or use Replit's built-in DB)

### Install

```bash
pnpm install
pip install opencv-python-headless fastapi uvicorn
```

### Environment Variables

```
DATABASE_URL=postgresql://...
PORT=8080
```

### Run

```bash
# Start the API server (auto-spawns the Python YOLO service)
pnpm --filter @workspace/api-server run dev

# Start the frontend
pnpm --filter @workspace/ppe-dashboard run dev
```

The YOLO service will auto-download YOLOv4-tiny weights (~24 MB) from GitHub on first run.

### Video Feeds

Place `.mp4` files in `artifacts/ppe-dashboard/public/feeds/`:
- `cam1-entrance.mp4`
- `cam2-production.mp4`
- `cam3-warehouse.mp4`
- `cam4-loading.mp4`
- `cam5-parking.mp4`
- `cam6-assembly.mp4`

---

## Detection Pipeline

1. Each camera runs in a dedicated Python thread
2. Every ~8th frame is passed through YOLOv4-tiny (COCO class 0 = person)
3. Detected bounding boxes are stored and **redrawn on every frame** (so boxes persist between inference intervals)
4. Per person: a head ROI and torso ROI are color-analyzed for PPE
5. Frames are JPEG-encoded and served as an MJPEG stream
6. Stats (person count, compliance %) are exposed via a REST endpoint polled by the frontend

---

## License

MIT
