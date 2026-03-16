# VideoGuard — AI-Powered Video Analytics & PPE Compliance System

[![GitHub commit](https://img.shields.io/badge/commit-latest-blue)](https://github.com/baderex/VideoGuard)
[![YOLOv4-tiny](https://img.shields.io/badge/model-YOLOv4--tiny-green)](https://github.com/AlexeyAB/darknet)
[![Angular 21](https://img.shields.io/badge/frontend-Angular%2021-red)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/db-PostgreSQL-336791)](https://postgresql.org)

> Real-time occupational safety enforcement through AI video analytics — running fully on CPU, no GPU required.

---

## Features

- **Real-time person detection** — YOLOv4-tiny via OpenCV DNN (CPU-only, ~24 MB weights)
- **PPE compliance** — vest, hard hat, gloves, safety goggles via HSV color analysis
- **Fall detection** — bounding-box aspect-ratio heuristic
- **Red zone intrusion** — click-to-draw polygon editor, point-in-polygon test per frame
- **Fire & smoke detection** — HSV flame/haze analysis every 5 frames
- **Violation screenshots** — auto-captured JPEG snapshots with 30–60 s throttle
- **Multi-site management** — cameras organised under sites; role-based site filtering
- **JWT authentication** — HS256 tokens, 24 h expiry, role-based access control
- **User management** — admin panel to create / edit / delete operator accounts
- **Live MJPEG streams** — annotated overlays with PPE tags, zone polygons, fire/smoke banners
- **Dark industrial Angular 21 dashboard** — signals, standalone components, functional interceptors

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
│  │  (OpenCV DNN)    │    └─────────────────────────────────────┘  │
│  │  YOLOv4-tiny CPU │                                             │
│  │                  │   ┌──────────────────────────────────────┐  │
│  │  Per-frame:      │   │  Alert Engine                        │  │
│  │  · Person detect │   │  Screenshots + DB inserts            │  │
│  │  · PPE analyze   │   │  30 s / 60 s throttle per camera     │  │
│  │  · Fall detect   │   └──────────────────────────────────────┘  │
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

### Auth Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Returns `{token, user}` |
| GET | `/api/auth/me` | ✅ Bearer | Returns current user info |

### Protected vs Public Paths

All `/api/*` routes require a valid Bearer token **except**:
- `/api/auth/*` — login
- `/api/yolo/stream*` / `/api/yolo/stream-raw*` — MJPEG (browsers can't send headers on `<img>` src)
- `/api/screenshots/*` — violation image files
- `/api/health*` — health checks

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

All API routes require `Authorization: Bearer <token>` unless marked ❌.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Login — returns `{token, user}` |
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
| GET | `/api/cameras` | List cameras (optional `site_id` filter; auto-filtered for site_viewer) |
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

### Streams (no auth required — MJPEG)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/yolo/stream/{id}` | Annotated MJPEG stream with overlays |
| GET | `/api/yolo/stream-raw/{id}` | Raw un-annotated MJPEG feed |
| GET | `/api/yolo/status` | Model status `{modelReady, netLoaded, classes}` |
| GET | `/api/yolo/detections/{id}` | Latest frame stats |

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
| Object detection | YOLOv4-tiny via OpenCV DNN (CPU, ~24 MB weights) |
| PPE / fire / smoke | HSV color thresholding + morphological filtering (OpenCV) |
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
| PPE: vest, hat, gloves, goggles | ✅ | ✅ |
| Fall / faint detection | ✅ | ✅ |
| Red zone / restricted area | ✅ Polygon editor UI | ✅ Dynamic Zones |
| Fire detection | ✅ HSV flame color analysis | ✅ |
| Smoke detection | ✅ HSV haze coverage analysis | ✅ |
| JWT authentication + RBAC | ✅ admin / support / site_viewer | ✅ |
| User management panel | ✅ | ✅ |
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

Login at `http://localhost:4200/login` with any of the default accounts listed above.
