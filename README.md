# VideoGuard — AI-Powered Video Analytics & PPE Compliance System

[![GitHub commit](https://img.shields.io/badge/commit-latest-blue)](https://github.com/baderex/VideoGuard)
[![YOLOv4-tiny](https://img.shields.io/badge/model-YOLOv4--tiny-green)](https://github.com/AlexeyAB/darknet)
[![Angular 21](https://img.shields.io/badge/frontend-Angular%2021-red)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/db-PostgreSQL-336791)](https://postgresql.org)

> Real-time occupational safety enforcement through AI video analytics — running fully on CPU, no GPU required.

---

## Detection Capabilities

| Detection | Method | Alert Type | Severity |
|---|---|---|---|
| **Safety Vest** | HSV hi-vis color (yellow/orange/lime) | `missing_ppe` | medium–critical |
| **Hard Hat** | HSV color (white/yellow/red/blue) | `missing_ppe` | medium–critical |
| **Work Gloves** | HSV color (yellow/orange/blue/red) | `missing_ppe` | medium–critical |
| **Safety Goggles** | HSV color (yellow/orange/blue lenses) | `missing_ppe` | medium–critical |
| **Fall Detection** | Bounding-box aspect ratio (w/h > 0.75) | `fall_detected` | critical |
| **Red Zone Intrusion** | Point-in-polygon (normalised foot coords) | `red_zone_intrusion` | critical |
| **Fire Detection** | HSV bright flame blobs ≥ 1.5% of frame | `fire_detected` | critical |
| **Smoke Detection** | HSV low-saturation haze ≥ 28% of frame | `smoke_detected` | critical |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Angular 21)                     │
│  Dashboard · Cameras · Alerts · Analytics · Reports · Sites  │
│              Zone Editor (click-to-draw polygons)            │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST + MJPEG
┌──────────────────────────▼──────────────────────────────────┐
│              FastAPI + Uvicorn  (port 8080)                  │
│                                                              │
│  ┌─────────────────┐   ┌───────────────────────────────┐    │
│  │  YOLO Inference  │   │  REST Routes                  │    │
│  │  (OpenCV DNN)    │   │  /api/cameras   /api/alerts   │    │
│  │  YOLOv4-tiny CPU │   │  /api/analytics /api/reports  │    │
│  │                  │   │  /api/sites     /api/zones    │    │
│  │  Per-frame:      │   │  /api/yolo/stream/:id (MJPEG) │    │
│  │  · Person detect │   │  /api/yolo/raw/:id            │    │
│  │  · PPE analyze   │   │  /api/yolo/status             │    │
│  │  · Fall detect   │   └───────────────────────────────┘    │
│  │  · Zone check    │                                        │
│  │  · Fire/Smoke    │                                        │
│  └────────┬─────────┘                                        │
│           │                                                   │
│  ┌────────▼─────────┐                                        │
│  │   Alert Engine   │                                        │
│  │  Screenshots +   │                                        │
│  │  DB inserts      │                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  PostgreSQL Database                          │
│  sites · cameras · alerts · red_zones                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Detection Pipeline

### Person Detection
```
Video Frame → YOLOv4-tiny (416×416) → NMS (conf>0.40, iou>0.45) → Person bounding boxes
```

### PPE Analysis (per person, HSV color regions)
```
BBox → Split into head / face / torso / lower regions
     → cv2.inRange() against colour palettes
     → vest(8%) · hat(7%) · gloves(6%) · goggles(5%) thresholds
```

### Fall Detection
```
BBox (x1,y1,x2,y2) → aspect ratio = (x2-x1)/(y2-y1)
                    → ratio > 0.75 → FALLEN
```

### Red Zone Intrusion
```
Person foot = (cx_normalised, y2_normalised)
            → cv2.pointPolygonTest() vs all active zone polygons
            → inside any polygon → IN ZONE
```

### Fire Detection (full-frame, every 5 frames)
```
Frame → HSV → mask bright orange/red/yellow pixels (S>120, V>160)
      → morphological open + dilate → find contours
      → largest blob ≥ 1.5% of frame area → FIRE
```

### Smoke Detection (full-frame, every 5 frames)
```
Frame → HSV → mask low-saturation gray/white pixels (S<55, V: 45-215)
      → coverage ≥ 28% of frame AND no fire → SMOKE
```

---

## Alert Throttling

| Alert Type | Throttle Window | Notes |
|---|---|---|
| `missing_ppe` / `fall_detected` / `red_zone_intrusion` | 30 s / camera | One screenshot per event window |
| `fire_detected` / `smoke_detected` | 60 s / camera | Higher urgency, separate path |

---

## API Reference

### Cameras
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cameras` | List all cameras (with optional `site_id` filter) |
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

### Streams
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/yolo/stream/{id}` | Annotated MJPEG stream with overlays |
| GET | `/api/yolo/raw/{id}` | Raw un-annotated MJPEG feed |
| GET | `/api/yolo/status` | Model status `{modelReady, netLoaded, classes}` |
| GET | `/api/yolo/detections/{id}` | Latest frame stats `{personCount, violationCount, complianceRate, fireDetected, smokeDetected}` |

### Sites
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sites` | List all sites |
| POST | `/api/sites` | Create site |

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
  location   TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cameras (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  site_id     INTEGER REFERENCES sites(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alerts (
  id             SERIAL PRIMARY KEY,
  camera_id      INTEGER REFERENCES cameras(id),
  type           alert_type NOT NULL,
  severity       TEXT NOT NULL,       -- low | medium | high | critical
  message        TEXT NOT NULL,
  missing_ppe    TEXT[] DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'open',  -- open | acknowledged | resolved
  person_count   INTEGER DEFAULT 0,
  screenshot_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE red_zones (
  id         SERIAL PRIMARY KEY,
  camera_id  INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Restricted Zone',
  points     JSONB NOT NULL DEFAULT '[]',  -- [{x: 0.0-1.0, y: 0.0-1.0}, ...]
  color      TEXT NOT NULL DEFAULT '#ff3333',
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Seeded Demo Data

### Sites
| ID | Name | Location |
|---|---|---|
| 1 | North Industrial Complex | Dubai Industrial City |
| 2 | Offshore Platform Alpha | Arabian Gulf |
| 3 | South Warehouse Hub | Jebel Ali Freezone |

### Cameras (6 feeds)
| ID | Name | Location | Feed |
|---|---|---|---|
| 1 | CAM-01 Entrance Gate | Main Entrance | cam1-entrance.mp4 |
| 2 | CAM-02 Production Floor | Production Area | cam2-production.mp4 |
| 3 | CAM-03 Warehouse | Warehouse Zone | cam3-warehouse.mp4 |
| 4 | CAM-04 Lab | Laboratory | cam4-lab.mp4 |
| 5 | CAM-05 Loading Dock | Shipping Area | cam5-dock.mp4 |
| 6 | CAM-06 Assembly | Assembly Floor | cam6-assembly.mp4 |

### Default Red Zones
| Camera | Zone Name | Purpose |
|---|---|---|
| 1 | Entry Restricted Zone | Access control at entrance |
| 2 | Machine Hazard Area | Production machinery exclusion |
| 3 | Forklift Corridor | Forklift right-of-way protection |

---

## Frontend Pages

| Route | Component | Description |
|---|---|---|
| `/` | Dashboard | KPI cards, live feeds, recent alerts |
| `/cameras` | Camera Grid | All feeds with per-camera compliance |
| `/cameras/:id` | Camera Detail | Live feed + zone editor + zone list |
| `/alerts` | Incident Log | Filter/acknowledge/resolve alerts with screenshot viewer |
| `/analytics` | Analytics | Compliance trends, hourly chart, violation breakdown |
| `/reports` | Reports | Exportable daily/shift compliance reports |
| `/sites` | Sites | Multi-site management grid |

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
| Object detection | YOLOv4-tiny via OpenCV DNN (CPU, ~24 MB weights) |
| PPE / fire / smoke | HSV color thresholding + morphological filtering (OpenCV) |
| Backend | Python 3.11 · FastAPI · Uvicorn |
| Database | PostgreSQL (psycopg2) |
| Frontend | Angular 21 · Standalone components · Signals · Tailwind CSS |
| Streaming | MJPEG multipart/x-mixed-replace |
| Monorepo | pnpm workspaces |

---

## Competitive Position vs Altave

| Feature | VideoGuard | Altave |
|---|---|---|
| PPE: vest, hat, gloves, goggles | ✅ | ✅ |
| Fall / faint detection | ✅ | ✅ |
| Red zone / restricted area | ✅ Polygon editor UI | ✅ Dynamic Zones |
| Fire detection | ✅ HSV flame color analysis | ✅ |
| Smoke detection | ✅ HSV haze coverage analysis | ✅ |
| Face mask, safety boots | ❌ | ✅ |
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

# Start API server (downloads YOLO weights on first run ~24 MB)
pnpm --filter @workspace/api-server run dev

# Start Angular dashboard
pnpm --filter @workspace/ppe-dashboard run dev
```

Environment variable required: `DATABASE_URL` (PostgreSQL connection string).

