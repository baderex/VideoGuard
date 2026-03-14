# VideoGuard — AI-Powered PPE Compliance System

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/Angular-21-red?style=flat-square&logo=angular" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/YOLOv4--tiny-OpenCV-00FFFF?style=flat-square" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

**VideoGuard** is a real-time industrial safety monitoring platform. It ingests live camera feeds, runs YOLOv4-tiny person detection on every frame, and enforces PPE (Personal Protective Equipment) compliance — surfacing violations instantly on a dark, industrial-style dashboard.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages and Navigation](#pages-and-navigation)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Detection Pipeline](#detection-pipeline)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seeded Data](#seeded-data)
- [License](#license)

---

## Features

### Core Detection

- **Real YOLOv4-tiny inference** — OpenCV DNN backend; no PyTorch or GPU required. Weights (~24 MB) are downloaded automatically on first run.
- **Persistent bounding boxes** — Detections are re-drawn on every frame so boxes never flicker between inference intervals.
- **Per-person PPE analysis** — Each detected person gets a head ROI (hard hat) and torso ROI (safety vest) analyzed via HSV color thresholding.
- **25 fps MJPEG streaming** — Annotated frames are JPEG-encoded and served per camera as a continuous MJPEG stream.
- **6 concurrent camera threads** — Each camera runs in its own Python thread with independent inference and streaming.

### Dashboard and UI

- **Dark industrial theme** — Angular 21 frontend with the SecureSight design: neon cyan accent (`#00FFFF`), dark card backgrounds, dot-matrix textures, glowing status indicators.
- **Live telemetry** — Person count and compliance rate polled every 2 seconds per active camera.
- **Detection / Raw Feed toggle** — Switch any camera between the annotated YOLO stream and a clean unannotated feed with one click.
- **Multi-camera grid** — Dashboard shows all cameras simultaneously with live compliance rates.

### Site and Camera Management

- **Site directory** — Facilities are organized into sites (Alpha Industrial Complex, Beta Warehouse District, Gamma Research Campus). Each site card lists its camera nodes with live status indicators and direct links.
- **Camera CRUD** — Add, update, and toggle cameras. Each camera stores its PPE requirements (hard hat, vest, gloves, safety glasses, face mask, safety boots).
- **Automatic seeding** — 3 sites, 6 cameras, 24 hours of analytics history, and 5 seed alerts are inserted on first startup.

### Alerts and Incidents

- **Auto-generated alerts** — When the YOLO loop detects a violation, it captures a JPEG screenshot and inserts a new alert in the database (rate-limited to 1 per camera per 30 seconds).
- **Screenshot thumbnails** — Every auto-generated alert shows a thumbnail of the violation frame inline in the incident log.
- **Full-size preview modal** — Click any thumbnail to open a full-screen overlay showing the raw violation frame.
- **Acknowledge / Resolve workflow** — Operators can move alerts through `open → acknowledged → resolved` with timestamps.
- **Severity levels** — `low`, `medium`, `high`, `critical` with glowing color-coded badges.

### Reports and Analytics

- **Daily compliance reports** — Per-camera hourly breakdown, top PPE violations, peak person counts, and shift summaries.
- **Historical analytics** — 60-minute rolling compliance trend chart per camera (Chart.js via ng2-charts).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Angular 21 Frontend                                          │
│  – SecureSight dark/neon UI (Tailwind CSS v4)                │
│  – Standalone components, signals, ng2-charts                 │
│  – Camera grid · Site directory · Alerts · Reports            │
│  – Direct MJPEG <img> from FastAPI (no proxy hop)             │
└────────────────────────┬─────────────────────────────────────┘
                         │  REST API + MJPEG streams
┌────────────────────────▼─────────────────────────────────────┐
│  Python FastAPI + Uvicorn  (port 8080)                        │
│  – Cameras, alerts, analytics, reports, sites REST routes     │
│  – /api/yolo/stream/{id}     → annotated MJPEG (25 fps)      │
│  – /api/yolo/stream-raw/{id} → clean MJPEG (no overlays)     │
│  – /api/yolo/stats/{id}      → JSON telemetry                │
│  – /api/screenshots/{file}   → static violation JPEGs        │
│  – 6 camera inference threads (YOLOv4-tiny via OpenCV DNN)   │
└────────────────────────┬─────────────────────────────────────┘
                         │  psycopg2
┌────────────────────────▼─────────────────────────────────────┐
│  PostgreSQL                                                    │
│  – sites · cameras · alerts · analytics tables                │
│  – Seeded with 3 sites, 6 cameras, 24h analytics history     │
└──────────────────────────────────────────────────────────────┘
                         │  reads
┌──────────────────────────────────────────────────────────────┐
│  MP4 Video Files  (artifacts/ppe-dashboard/public/feeds/)     │
│  – cam1-entrance.mp4  · cam2-production.mp4                   │
│  – cam3-warehouse.mp4 · cam4-lab.mp4                          │
│  – cam5-dock.mp4      · cam6-assembly.mp4                     │
└──────────────────────────────────────────────────────────────┘
```

The Node.js `api-server` launcher installs Python dependencies and spawns `main.py` — it does not proxy API traffic. All requests go directly from the Angular app to the FastAPI service on port 8080.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 21.2 (standalone components, signals, `@if`/`@for` control flow) |
| **Styling** | Tailwind CSS v4 with PostCSS, CSS custom properties |
| **Charts** | Chart.js v4 via ng2-charts v10 (`BaseChartDirective`) |
| **HTTP** | Angular `HttpClient` + RxJS (`timer`, `switchMap`, `shareReplay`) |
| **Routing** | `provideRouter` with lazy-loaded `loadComponent` |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **AI / Vision** | OpenCV DNN, YOLOv4-tiny (COCO weights), NumPy |
| **PPE detection** | HSV color thresholding on head ROI (hard hat) and torso ROI (vest) |
| **Database** | PostgreSQL 16, psycopg2-binary |
| **Static files** | FastAPI `StaticFiles` for violation screenshots |
| **Launcher** | Node.js 24, TypeScript 5.9, esbuild (CJS bundle) |
| **Monorepo** | pnpm workspaces |

---

## Project Structure

```
VideoGuard/
├── artifacts/
│   ├── api-server/                # Node.js launcher
│   │   └── src/index.ts           # Installs pip deps, spawns main.py
│   ├── ppe-dashboard/             # Angular 21 frontend
│   │   ├── src/app/
│   │   │   ├── pages/
│   │   │   │   ├── dashboard/         # Live analytics overview
│   │   │   │   ├── cameras/           # Camera grid + add dialog
│   │   │   │   ├── camera-detail/     # YOLO stream + compliance chart + mode toggle
│   │   │   │   ├── sites/             # Facility directory with camera nodes
│   │   │   │   ├── alerts/            # Incident log + screenshot modal
│   │   │   │   └── reports/           # Daily compliance reports
│   │   │   ├── components/
│   │   │   │   ├── simulated-feed.component.ts    # MJPEG <img> + stats polling
│   │   │   │   └── ppe-icons.component.ts
│   │   │   ├── services/
│   │   │   │   ├── camera.service.ts
│   │   │   │   ├── alert.service.ts
│   │   │   │   ├── analytics.service.ts
│   │   │   │   ├── site.service.ts
│   │   │   │   └── toast.service.ts
│   │   │   ├── layout/
│   │   │   │   ├── app-layout.component.ts
│   │   │   │   └── sidebar.component.ts
│   │   │   └── lib/
│   │   │       ├── models.ts          # TypeScript interfaces (Camera, Site, Alert, etc.)
│   │   │       └── utils.ts
│   │   └── public/feeds/              # MP4 source videos
│   └── yolo-service/              # Python FastAPI + YOLO inference
│       ├── main.py                # App entry, YOLO loop, streaming routes
│       ├── db.py                  # psycopg2 connection + cursor helper
│       ├── seed.py                # DB schema migration + data seeding
│       ├── simulation.py          # Snapshot simulation helper
│       ├── requirements.txt
│       ├── screenshots/           # Auto-saved violation JPEGs
│       └── routes/
│           ├── cameras.py
│           ├── alerts.py
│           ├── analytics.py
│           ├── reports.py
│           ├── sites.py
│           └── health.py
└── README.md
```

---

## Pages and Navigation

| Page | Route | Description |
|---|---|---|
| **Live Dashboard** | `/` | Multi-camera compliance overview, global stats, active alert count, per-camera compliance rates |
| **Cameras** | `/cameras` | Card grid of all camera nodes with status badges, PPE requirement tags, add/edit dialog |
| **Camera Detail** | `/cameras/:id` | Live YOLO stream with Detection / Raw Feed toggle, 60-minute compliance trend chart, live person count |
| **Sites** | `/sites` | Facility cards (name, address, status), camera count, clickable camera node list with live status dots |
| **Alerts** | `/alerts` | Incident log with severity/status filters, violation thumbnails, full-size screenshot modal, acknowledge/resolve actions |
| **Reports** | `/reports` | Daily compliance report: hourly bar chart, top violations, peak hour, shift summary |

---

## API Reference

All endpoints are served by the FastAPI service on port 8080.

### Cameras

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cameras` | List all cameras (includes `siteId`) |
| `POST` | `/api/cameras` | Create a camera |
| `GET` | `/api/cameras/:id` | Get camera by ID |
| `PATCH` | `/api/cameras/:id` | Update camera |
| `DELETE` | `/api/cameras/:id` | Delete camera |
| `GET` | `/api/cameras/:id/snapshot` | Latest detection snapshot |

### Sites

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sites` | List all sites with live `cameraCount` |
| `GET` | `/api/sites/:id` | Get site by ID |
| `GET` | `/api/sites/:id/cameras` | List cameras belonging to a site |

### Alerts

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/alerts` | List alerts (query: `cameraId`, `status`, `limit`, `offset`) |
| `POST` | `/api/alerts/:id/acknowledge` | Mark alert as acknowledged |
| `POST` | `/api/alerts/:id/resolve` | Mark alert as resolved |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/live` | Real-time global analytics |
| `GET` | `/api/analytics/history` | Historical compliance data points |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/daily` | Daily compliance report for a camera |

### YOLO Streaming

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/yolo/stream/:id` | Annotated MJPEG feed (bounding boxes + status overlays) |
| `GET` | `/api/yolo/stream-raw/:id` | Clean MJPEG feed (no annotations) |
| `GET` | `/api/yolo/stats/:id` | JSON: `{ personCount, violationCount, complianceRate, timestamp }` |
| `GET` | `/api/yolo/status` | Model readiness check |
| `GET` | `/api/screenshots/:filename` | Static violation JPEG |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | API liveness check |
| `GET` | `/api/yolo/health` | YOLO service health + model state |

---

## Database Schema

```sql
CREATE TABLE sites (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cameras (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  location         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'inactive',
  stream_url       TEXT,
  ppe_requirements TEXT[] DEFAULT '{}',
  site_id          INTEGER REFERENCES sites(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alerts (
  id              SERIAL PRIMARY KEY,
  camera_id       INTEGER REFERENCES cameras(id),
  type            TEXT NOT NULL,
  severity        TEXT NOT NULL,      -- low | medium | high | critical
  message         TEXT NOT NULL,
  missing_ppe     TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'open',  -- open | acknowledged | resolved
  person_count    INTEGER DEFAULT 0,
  screenshot_url  TEXT,              -- path to /api/screenshots/<filename>
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE analytics (
  id                     SERIAL PRIMARY KEY,
  camera_id              INTEGER REFERENCES cameras(id),
  person_count           INTEGER DEFAULT 0,
  compliant_count        INTEGER DEFAULT 0,
  non_compliant_count    INTEGER DEFAULT 0,
  compliance_rate        NUMERIC(5,1) DEFAULT 100.0,
  missing_hard_hat       INTEGER DEFAULT 0,
  missing_safety_vest    INTEGER DEFAULT 0,
  missing_gloves         INTEGER DEFAULT 0,
  missing_safety_glasses INTEGER DEFAULT 0,
  missing_face_mask      INTEGER DEFAULT 0,
  missing_safety_boots   INTEGER DEFAULT 0,
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Schema migrations are non-destructive: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ensures restarts never break existing data.

---

## Detection Pipeline

```
MP4 Video File
     │
     ▼  cv2.VideoCapture (loops continuously)
Raw Frame (resized to max 960px wide)
     │
     ├──────────────────────────►  raw_frame stored in CameraState
     │                              served by /api/yolo/stream-raw
     │
     ▼  every ~8th frame
YOLOv4-tiny inference (OpenCV DNN, CPU-only)
     │   COCO class 0 = person
     │   Confidence threshold: 0.40 · NMS threshold: 0.45
     │   Inference lock (net is not thread-safe)
     ▼
Per-person PPE analysis
     │   Head ROI  → HSV mask for yellow/white → hard_hat flag
     │   Torso ROI → HSV mask for orange/yellow → safety_vest flag
     │   compliant = vest OR hat
     ▼
PersonDetection objects stored in CameraState
     │
     ├──────────────────────────►  Violation detected?
     │                              Save JPEG to screenshots/
     │                              INSERT alert with screenshot_url
     │                              (throttled: 1 per 30 s per camera)
     ▼  every frame (~25 fps output)
annotate_frame()  — corner bounding boxes, VEST/HARDHAT tags, status bar
add_hud()         — scan-line effect, CAM-XX label, REC indicator, timestamp
     │
     ▼
JPEG encode  →  MJPEG yield  →  /api/yolo/stream/{id}
```

**Key design decisions:**

- **Persistent boxes** — Stored detections are re-applied on every frame so the stream never shows bare video between inference calls.
- **Inference lock** — A `threading.Lock()` serialises calls to `net.setInput / net.forward` since OpenCV DNN is not thread-safe across threads.
- **Screenshot throttle** — One violation JPEG per camera per 30 seconds prevents alert spam while still capturing evidence frames.

---

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm
- Python 3.11+
- PostgreSQL (or use the Replit built-in database via `DATABASE_URL`)

### Install

```bash
# Install Node.js dependencies
pnpm install

# Python dependencies are installed automatically on first run,
# but you can install them manually:
pip install -r artifacts/yolo-service/requirements.txt
```

### Run (development)

```bash
# Terminal 1 — Python FastAPI service + YOLO inference (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Angular dev server
pnpm --filter @workspace/ppe-dashboard run dev
```

On first start:
1. YOLOv4-tiny weights (~24 MB) are downloaded to `artifacts/yolo-service/.cache/`
2. The database is seeded with 3 sites, 6 cameras, 24 hours of analytics history, and 5 sample alerts

### Python Dependencies

```
opencv-python-headless
fastapi
uvicorn[standard]
numpy
psycopg2-binary
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `PORT` | Port for the Angular dev server (set per artifact by Replit) |

The FastAPI service binds to port 8080 and reads `DATABASE_URL` directly from the environment.

---

## Seeded Data

On first startup (empty cameras table), the system creates:

**Sites**

| ID | Name | Address |
|---|---|---|
| 1 | Alpha Industrial Complex | 100 Factory Road, Zone A |
| 2 | Beta Warehouse District | 55 Logistics Lane, Zone B |
| 3 | Gamma Research Campus | 200 Lab Boulevard, Zone C |

**Cameras**

| Cam | Name | Location | Status | Site |
|---|---|---|---|---|
| 1 | Main Entrance | Building A - Gate 1 | active | Alpha |
| 2 | Production Floor | Building B - Section 2 | active | Alpha |
| 3 | Warehouse Zone A | Warehouse - North Wing | active | Beta |
| 4 | Chemical Lab | Lab Building - Floor 1 | active | Gamma |
| 5 | Outdoor Loading Dock | East Yard - Dock 3 | inactive | Beta |
| 6 | Assembly Line B | Building C - Line 2 | error | Alpha |

---

## License

MIT
