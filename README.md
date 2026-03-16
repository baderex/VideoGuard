# VideoGuard — AI-Powered Video Analytics & PPE Compliance System

[![GitHub commit](https://img.shields.io/badge/commit-latest-blue)](https://github.com/baderex/VideoGuard)
[![YOLOv4-tiny](https://img.shields.io/badge/person%20detection-YOLOv4--tiny-green)](https://github.com/AlexeyAB/darknet)
[![MediaPipe](https://img.shields.io/badge/fall%20detection-MediaPipe%20Pose-orange)](https://mediapipe.readthedocs.io)
[![YOLOv8](https://img.shields.io/badge/PPE%20detection-YOLOv8%20%7C%20HSV-blueviolet)](https://docs.ultralytics.com)
[![Angular 21](https://img.shields.io/badge/frontend-Angular%2021-red)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/db-PostgreSQL-336791)](https://postgresql.org)

> Real-time occupational safety enforcement through AI video analytics — running fully on CPU, no GPU required.

---

## Features

- **Real-time person detection** — YOLOv4-tiny via OpenCV DNN (CPU-only, ~24 MB weights)
- **Dual-mode PPE compliance** — switchable between fast HSV color analysis and accurate YOLOv8 model detection; gloves/goggles auto-fall back to HSV
- **MediaPipe skeleton fall detection** — PoseLandmarker Task API (0.10.x) with hip/knee keypoint logic; aspect-ratio used only as fallback
- **Red zone intrusion** — click-to-draw polygon editor, point-in-polygon test per frame
- **Fire & smoke detection** — HSV flame/haze analysis every 5 frames
- **Violation screenshots** — auto-captured JPEG snapshots with 30–60 s throttle
- **Multi-site management** — cameras organised under sites; role-based site filtering
- **JWT authentication** — HS256 tokens, 24 h expiry, role-based access control
- **User management** — admin panel to create / edit / delete operator accounts
- **Live MJPEG streams** — annotated overlays with PPE tags, zone polygons, fire/smoke banners
- **Dark industrial Angular 21 dashboard** — signals, standalone components, functional interceptors
- **Custom model training** — `train_ppe.py` downloads a Roboflow PPE dataset and fine-tunes YOLOv8

---

## Detection Capabilities

| Detection | Method | Alert Type | Severity |
|---|---|---|---|
| **Safety Vest** | YOLOv8 PPE model **or** HSV hi-vis color | `missing_ppe` | medium–critical |
| **Hard Hat** | YOLOv8 PPE model **or** HSV color | `missing_ppe` | medium–critical |
| **Work Gloves** | HSV color (yellow/orange/blue/red) | `missing_ppe` | medium–critical |
| **Safety Goggles** | HSV color (yellow/orange/blue lenses) | `missing_ppe` | medium–critical |
| **Fall Detection** | MediaPipe PoseLandmarker skeleton (hip > knee → fallen) | `fall_detected` | critical |
| **Red Zone Intrusion** | Point-in-polygon (normalised foot coords) | `red_zone_intrusion` | critical |
| **Fire Detection** | HSV bright flame blobs ≥ 1.5% of frame | `fire_detected` | critical |
| **Smoke Detection** | HSV low-saturation haze ≥ 28% of frame | `smoke_detected` | critical |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser (Angular 21)                        │
│  Login · Dashboard · Cameras · Alerts · Analytics · Reports      │
│  Sites · Zone Editor · Admin / User Management                   │
│  ↓ JWT Bearer token on every request (functional interceptor)    │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + MJPEG
┌────────────────────────▼────────────────────────────────────────┐
│               FastAPI + Uvicorn  (port 8080)                     │
│                                                                  │
│  ┌──────────────────┐   ┌─────────────────────────────────────┐  │
│  │  Auth Middleware  │   │  REST Routes                        │  │
│  │  JWT verify       │   │  /api/auth/login  /api/auth/me      │  │
│  │  role → state     │   │  /api/users       (admin only)      │  │
│  └──────────────────┘   │  /api/cameras     /api/alerts        │  │
│                          │  /api/analytics   /api/reports       │  │
│  ┌──────────────────┐    │  /api/sites       /api/zones         │  │
│  │  YOLO Inference  │    │  /api/yolo/stream/:id  (MJPEG)      │  │
│  │  (OpenCV DNN)    │    │  /api/ppe/mode    (detection info)   │  │
│  │  YOLOv4-tiny CPU │    └─────────────────────────────────────┘  │
│  │                  │                                             │
│  │  Per-frame:      │   ┌──────────────────────────────────────┐  │
│  │  · Person detect │   │  Alert Engine                        │  │
│  │  · PPE analyze   │   │  Screenshots + DB inserts            │  │
│  │    (HSV|YOLOv8)  │   │  30 s / 60 s throttle per camera     │  │
│  │  · Fall detect   │   └──────────────────────────────────────┘  │
│  │    (MediaPipe)   │                                             │
│  │  · Zone check    │                                             │
│  │  · Fire/Smoke    │                                             │
│  └──────────────────┘                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   PostgreSQL Database                             │
│  sites · cameras · alerts · red_zones · analytics · users        │
└─────────────────────────────────────────────────────────────────┘
```

---

## PPE Detection Modes

VideoGuard ships with two interchangeable PPE detection engines, switchable via an environment variable — no code changes needed.

### HSV Mode (default)

```
PPE_DETECTION_MODE=hsv
```

Fast color analysis on person body sub-regions. Works out of the box with no extra model files.

```
Person BBox → split into head / face / torso / lower regions
           → cv2.inRange() against colour palettes
           → vest(8%) · hat(7%) · gloves(6%) · goggles(5%) thresholds
```

**Pros:** Zero extra dependencies, instant startup, ~0 ms inference overhead.  
**Cons:** Same-colour clothing can trigger false positives.

---

### YOLOv8 Mode

```
PPE_DETECTION_MODE=yolov8
```

Pre-trained [`keremberke/yolov8s-ppe-detection`](https://huggingface.co/keremberke/yolov8s-ppe-detection) model (~22 MB, auto-downloaded from HuggingFace on first run). A custom `.pt` file can also be used.

```
Frame → YOLOv8s PPE model (640×640) → PPE bounding boxes
      → overlay with person boxes (IoU ≥ 0.05)
      → per-category highest-confidence detection wins
      → gloves / goggles not in model → HSV fallback
```

**Pros:** Far more accurate for vest and hardhat, handles occlusion, scale variation.  
**Cons:** ~150–300 ms per frame on CPU; `ultralytics` package required.

---

### Custom Model

Train your own model with `train_ppe.py` (requires a free [Roboflow](https://app.roboflow.com) API key):

```bash
pip install ultralytics roboflow
python train_ppe.py --api-key YOUR_ROBOFLOW_KEY --model yolov8n --epochs 50
# Weights saved to artifacts/yolo-service/ppe_model.pt
```

Then point VideoGuard at it:

```bash
PPE_DETECTION_MODE=yolov8
PPE_MODEL_PATH=/path/to/ppe_model.pt
```

---

## Fall Detection

Fall detection uses **MediaPipe PoseLandmarker Task API** (v0.10.x) for skeleton-based analysis:

```
Frame + Person BBox → MediaPipe PoseLandmarker
                    → 33-point body skeleton
                    → left_hip.y > left_knee.y  → FALLEN
                    → right_hip.y > right_knee.y → FALLEN
                    → aspect ratio fallback if pose unavailable
```

The pose model (`pose_landmarker_lite.task`, ~5.7 MB) is downloaded automatically on first run and cached locally.

---

## Authentication & RBAC

VideoGuard uses JWT (HS256, 24 h expiry) for all API access.

### Roles

| Role | Cameras / Alerts | Sites | Analytics | User Management |
|---|---|---|---|---|
| `admin` | All sites | All | All | ✅ Full CRUD |
| `support` | All sites | All | All | ❌ |
| `site_viewer` | Assigned site only | Own site | Own site | ❌ |

### Default Accounts

| Username | Password | Role | Scope |
|---|---|---|---|
| `admin` | `admin123` | Admin | All sites |
| `support` | `support123` | Support | All sites |
| `site1` | `site123` | Site Viewer | Alpha Industrial Complex |
| `site2` | `site123` | Site Viewer | Beta Warehouse District |
| `site3` | `site123` | Site Viewer | Gamma Research Campus |

---

## API Reference

All routes require `Authorization: Bearer <token>` unless marked ❌.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Returns `{token, user}` |
| GET | `/api/auth/me` | ✅ | Current user info |

### Users (Admin only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user `{username, password, role, site_id?}` |
| PUT | `/api/users/{id}` | Update user fields |
| DELETE | `/api/users/{id}` | Delete user |

### Cameras
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cameras` | List cameras (optional `site_id`; auto-filtered for site_viewer) |
| GET | `/api/cameras/{id}` | Single camera details |
| PUT | `/api/cameras/{id}/status` | Set camera status |

### Red Zones
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cameras/{id}/zones` | List zones for camera |
| POST | `/api/cameras/{id}/zones` | Create zone `{name, points:[{x,y}], color}` |
| PUT | `/api/cameras/{id}/zones/{zid}` | Update zone (name / points / active) |
| DELETE | `/api/cameras/{id}/zones/{zid}` | Delete zone |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts` | List alerts (filter: `status`, `camera_id`, `limit`) |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/{id}/resolve` | Resolve alert |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/compliance` | Compliance rate by camera |
| GET | `/api/analytics/hourly` | Alert counts by hour (last 24 h) |
| GET | `/api/analytics/violations` | Top violation types |

### Streams (no auth — MJPEG)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/yolo/stream/{id}` | Annotated MJPEG stream with overlays |
| GET | `/api/yolo/stream-raw/{id}` | Raw un-annotated MJPEG feed |
| GET | `/api/yolo/status` | Model status `{modelReady, netLoaded, classes}` |
| GET | `/api/yolo/detections/{id}` | Latest frame detection stats |

### PPE Detection
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/ppe/mode` | ✅ | Active detection mode, model info, class mapping |

### Sites
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sites` | List all sites |
| POST | `/api/sites` | Create site |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | weak default | HS256 signing key — use 32+ random chars in production |
| `PORT` | ✅ | — | Port for FastAPI / Uvicorn |
| `INIT_SECRET` | ✅ | — | Protects the `/api/init` seed endpoint |
| `ALLOWED_ORIGINS` | ❌ | `*` | Comma-separated CORS origins |
| `PPE_DETECTION_MODE` | ❌ | `hsv` | `hsv` or `yolov8` |
| `PPE_MODEL_PATH` | ❌ | auto | Path to a custom `.pt` PPE model file |
| `PPE_CONFIDENCE` | ❌ | `0.35` | YOLOv8 detection confidence threshold |

---

## Database Schema

```sql
CREATE TYPE alert_type AS ENUM (
  'missing_ppe', 'camera_offline', 'low_compliance',
  'fall_detected', 'red_zone_intrusion',
  'fire_detected', 'smoke_detected'
);

CREATE TABLE sites (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cameras (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  site_id         INTEGER REFERENCES sites(id),
  ppe_requirements TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alerts (
  id             SERIAL PRIMARY KEY,
  camera_id      INTEGER REFERENCES cameras(id),
  type           alert_type NOT NULL,
  severity       TEXT NOT NULL,
  message        TEXT NOT NULL,
  missing_ppe    TEXT[] DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'open',
  person_count   INTEGER DEFAULT 0,
  screenshot_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE red_zones (
  id         SERIAL PRIMARY KEY,
  camera_id  INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Restricted Zone',
  points     JSONB NOT NULL DEFAULT '[]',   -- [{x: 0.0-1.0, y: 0.0-1.0}, ...]
  color      TEXT NOT NULL DEFAULT '#ff3333',
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT NOT NULL,              -- bcrypt
  role          TEXT NOT NULL DEFAULT 'support',  -- admin | support | site_viewer
  site_id       INTEGER REFERENCES sites(id),     -- required for site_viewer
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Frontend Pages

| Route | Component | Auth | Description |
|---|---|---|---|
| `/login` | Login | Public | Dark industrial login with demo account quick-fill |
| `/` | Dashboard | ✅ Any | KPI cards, live feeds, recent alerts |
| `/cameras` | Camera Grid | ✅ Any | All feeds with per-camera compliance |
| `/cameras/:id` | Camera Detail | ✅ Any | Live feed + zone editor + zone list |
| `/alerts` | Incident Log | ✅ Any | Filter/acknowledge/resolve alerts + screenshot viewer |
| `/reports` | Reports | ✅ Any | Exportable daily/shift compliance reports |
| `/sites` | Sites | ✅ Any | Multi-site management grid |
| `/admin/users` | User Management | ✅ Admin | Create/edit/delete users, assign roles and sites |

---

## Seeded Demo Data

### Sites
| ID | Name |
|---|---|
| 1 | Alpha Industrial Complex |
| 2 | Beta Warehouse District |
| 3 | Gamma Research Campus |

### Cameras (6 feeds)
| ID | Name | Location | Site |
|---|---|---|---|
| 1 | Main Entrance | Building A - Gate 1 | Alpha |
| 2 | Production Floor | Building B - Section 2 | Alpha |
| 3 | Warehouse Zone A | Warehouse - North Wing | Beta |
| 4 | Chemical Lab | Lab Building - Floor 1 | Gamma |
| 5 | Outdoor Loading Dock | East Yard - Dock 3 | Beta |
| 6 | Assembly Line B | Building C - Line 2 | Alpha |

### Default Red Zones
| Camera | Zone Name | Purpose |
|---|---|---|
| 1 | Gate Entry Zone | Access control at entrance |
| 2 | Machine Hazard Area | Production machinery exclusion |
| 3 | Forklift Corridor | Forklift right-of-way protection |

---

## Visual Stream Overlays

Every annotated MJPEG frame renders:
- **Bounding boxes** with corner indicators (green = compliant, red = violation, bright red = fallen, blue = in-zone)
- **PPE tag bar** per person: `VEST/NO-VEST · HARDHAT/NO-HAT · GLOVES/NO-GLOVE · GOGGLES/NO-GOGG`
- **Special badges**: `FALL!` (bright red), `IN ZONE` (blue)
- **Red zone polygons**: semi-transparent filled with zone name label
- **🔥 Fire overlay**: layered orange-red border + `!! FIRE DETECTED !!` banner
- **Smoke overlay**: gray border + `SMOKE DETECTED` banner
- **Status bar** (bottom): person count, violation count, compliance %
- **HUD** (top): camera ID, timestamp, REC indicator, AI badge, scan-line

---

## Tech Stack

| Layer | Technology |
|---|---|
| Person detection | YOLOv4-tiny via OpenCV DNN (CPU, ~24 MB weights) |
| PPE detection | YOLOv8s (`keremberke/yolov8s-ppe-detection`) **or** HSV color thresholding |
| Fall detection | MediaPipe PoseLandmarker Task API (skeleton keypoints) |
| Fire / smoke | HSV color thresholding + morphological filtering (OpenCV) |
| Backend | Python 3.11 · FastAPI · Uvicorn |
| Auth | python-jose (JWT HS256) · bcrypt |
| Database | PostgreSQL · psycopg2 |
| Frontend | Angular 21 · Standalone components · Signals · Tailwind CSS |
| Auth (frontend) | JWT in localStorage · functional HTTP interceptor · route guards |
| Streaming | MJPEG multipart/x-mixed-replace |
| Monorepo | pnpm workspaces |

---

## Competitive Position vs Altave

| Feature | VideoGuard | Altave |
|---|---|---|
| PPE: vest, hat, gloves, goggles | ✅ HSV + YOLOv8 | ✅ |
| Fall / faint detection | ✅ MediaPipe skeleton | ✅ |
| Red zone / restricted area | ✅ Polygon editor UI | ✅ Dynamic Zones |
| Fire detection | ✅ HSV flame color analysis | ✅ |
| Smoke detection | ✅ HSV haze coverage analysis | ✅ |
| JWT authentication + RBAC | ✅ admin / support / site_viewer | ✅ |
| User management panel | ✅ | ✅ |
| Custom model training | ✅ `train_ppe.py` + Roboflow | ❌ |
| Face mask, safety boots | ❌ (trainable via custom model) | ✅ |
| Ergonomics / posture | ❌ (needs pose estimation) | ✅ |
| Environmental (methane, thermal) | ❌ (needs sensor hardware) | ✅ |
| Mobile app | ❌ | ✅ |
| Multi-site management | ✅ | ✅ |
| Self-hosted / open-source | ✅ MIT licence | ❌ Managed SaaS |
| GPU required | ❌ CPU-only | ✅ GPU |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start API server (downloads YOLO weights + pose model on first run)
pnpm --filter @workspace/api-server run dev

# Start Angular dashboard
pnpm --filter @workspace/ppe-dashboard run dev
```

Environment variables required: `DATABASE_URL`, `JWT_SECRET`, `INIT_SECRET`.

Login at `http://localhost:4200/login` with any default account listed above.

### Enable YOLOv8 PPE detection

```bash
PPE_DETECTION_MODE=yolov8   # auto-downloads ~22 MB model on first start
```

### Seed the database (first run only)

```bash
curl -X POST http://localhost:8080/api/init \
  -H "Content-Type: application/json" \
  -d '{"secret": "YOUR_INIT_SECRET"}'
```

---

## Security Checklist (Production)

- [ ] Set `JWT_SECRET` to a cryptographically random 32+ character string
- [ ] Set `INIT_SECRET` to a strong value and remove or disable `/api/init` after seeding
- [ ] Restrict `ALLOWED_ORIGINS` to your actual frontend domain
- [ ] Rotate default account passwords immediately after first login
- [ ] Run behind a TLS-terminating reverse proxy (nginx, Caddy, etc.)
- [ ] Do not expose port 8080 directly to the internet
