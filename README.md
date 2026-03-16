# VideoGuard — AI-Powered Video Analytics & PPE Compliance System

  [![GitHub](https://img.shields.io/badge/repo-VideoGuard-181717?logo=github)](https://github.com/baderex/VideoGuard)
  [![YOLOv4-tiny](https://img.shields.io/badge/model-YOLOv4--tiny-green)](https://github.com/AlexeyAB/darknet)
  [![Angular 21](https://img.shields.io/badge/frontend-Angular%2021-red)](https://angular.io)
  [![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com)
  [![PostgreSQL](https://img.shields.io/badge/db-PostgreSQL-336791)](https://postgresql.org)
  [![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

  > Real-time occupational safety enforcement through AI video analytics — running fully on CPU, no GPU required.

  ---

  ## Overview

  VideoGuard is a production-ready industrial safety platform that combines **real YOLOv4-tiny object detection** with a **dark Angular 21 dashboard** to monitor PPE compliance, detect falls, track red-zone intrusions, and identify fire/smoke events across multiple camera feeds simultaneously — all without requiring a GPU.

  ---

  ## Features

  - **Real-time person detection** — YOLOv4-tiny via OpenCV DNN (CPU-only, ~24 MB weights auto-downloaded)
  - **PPE compliance** — safety vest, hard hat, gloves, safety goggles via HSV color analysis
  - **Fall detection** — bounding-box aspect-ratio heuristic per frame
  - **Red zone intrusion** — click-to-draw polygon editor, point-in-polygon test per frame
  - **Fire & smoke detection** — HSV flame/haze analysis every 5 frames
  - **Violation screenshots** — auto-captured JPEG snapshots with 30–60 s throttle per camera
  - **Multi-site management** — cameras organised under sites with role-based site filtering
  - **JWT authentication** — HS256 tokens, 24 h expiry, bcrypt password hashing
  - **Full RBAC** — admin / support / site_viewer with route-level and DB-level enforcement
  - **User management** — admin panel to create / edit / deactivate operator accounts
  - **Live MJPEG streams** — annotated overlays with PPE tags, zone polygons, fire/smoke banners
  - **Connection pooling** — `ThreadedConnectionPool(2–20)` for production DB throughput
  - **Rate limiting** — login endpoint limited to 10 attempts per IP per 60 s
  - **Security headers** — `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
  - **Init API** — `POST /api/init` to provision schema + dummy data on a fresh deployment
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
  │  ↓ 401 → auto-logout + redirect to /login                        │
  └────────────────────────┬────────────────────────────────────────┘
                           │ REST + MJPEG
  ┌────────────────────────▼────────────────────────────────────────┐
  │               FastAPI + Uvicorn  (port $PORT)                    │
  │                                                                  │
  │  ┌─────────────────────────────────────────────────────────┐     │
  │  │  Middleware Stack (innermost → outermost)                │     │
  │  │  1. Security Headers  (X-Frame, X-Content-Type, …)      │     │
  │  │  2. JWT Auth          (verify Bearer, skip public paths) │     │
  │  │  3. CORS              (ALLOWED_ORIGINS env var)          │     │
  │  └─────────────────────────────────────────────────────────┘     │
  │                                                                  │
  │  ┌──────────────────┐   ┌─────────────────────────────────────┐  │
  │  │  YOLO Inference  │   │  REST Routes                        │  │
  │  │  (OpenCV DNN)    │   │  /api/auth/*      /api/init         │  │
  │  │  YOLOv4-tiny CPU │   │  /api/users       (admin only)      │  │
  │  │                  │   │  /api/cameras     /api/alerts        │  │
  │  │  Per-frame:      │   │  /api/analytics   /api/reports       │  │
  │  │  · Person detect │   │  /api/sites       /api/zones         │  │
  │  │  · PPE analyze   │   │  /api/yolo/stream/:id  (MJPEG)      │  │
  │  │  · Fall detect   │   └─────────────────────────────────────┘  │
  │  │  · Zone check    │                                             │
  │  │  · Fire/Smoke    │   ┌──────────────────────────────────────┐  │
  │  └──────────────────┘   │  Alert Engine                        │  │
  │                          │  Screenshots + DB inserts            │  │
  │  ┌──────────────────┐    │  30 s / 60 s throttle per camera    │  │
  │  │  Login Rate Limiter│  └──────────────────────────────────────┘  │
  │  │  10 req/IP/60 s   │                                             │
  │  └──────────────────┘                                             │
  └────────────────────────┬────────────────────────────────────────┘
                           │ ThreadedConnectionPool(2–20)
  ┌────────────────────────▼────────────────────────────────────────┐
  │                   PostgreSQL Database                             │
  │  sites · cameras · alerts · red_zones · analytics · users        │
  └─────────────────────────────────────────────────────────────────┘
  ```

  ---

  ## Quick Start (Fresh Deployment)

  ### 1. Clone & install

  ```bash
  git clone https://github.com/baderex/VideoGuard.git
  cd VideoGuard
  pnpm install
  ```

  ### 2. Set environment variables

  ```bash
  export DATABASE_URL="postgresql://user:password@host:5432/videoguard"
  export JWT_SECRET="$(openssl rand -hex 32)"          # Required — 32+ chars
  export INIT_SECRET="$(openssl rand -hex 16)"         # For /api/init endpoint
  export ALLOWED_ORIGINS="https://your-domain.com"     # Comma-separated, default: *
  export PORT=8080
  ```

  ### 3. Start services

  ```bash
  # API + YOLO service
  pnpm --filter @workspace/api-server run dev

  # Angular dashboard
  pnpm --filter @workspace/ppe-dashboard run dev
  ```

  ### 4. Initialize the database

  ```bash
  # Check if already initialized
  curl http://localhost:8080/api/init/status

  # Seed schema + all dummy data
  curl -X POST http://localhost:8080/api/init \
    -H "X-Init-Secret: $INIT_SECRET"

  # Or force wipe + re-seed (useful for demos / testing)
  curl -X POST "http://localhost:8080/api/init?force=true" \
    -H "X-Init-Secret: $INIT_SECRET"
  ```

  > **Tip:** If `INIT_SECRET` is not set, the server auto-generates a one-time secret and prints it to the server log on the first request to `/api/init`.

  ---

  ## Environment Variables

  | Variable | Required | Default | Description |
  |---|---|---|---|
  | `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
  | `JWT_SECRET` | ✅ (production) | weak default (logs warning) | HS256 signing key — use 32+ random chars |
  | `PORT` | ✅ | — | Port the FastAPI service binds to |
  | `INIT_SECRET` | Recommended | auto-generated (logged) | Secret for `POST /api/init` endpoint |
  | `ALLOWED_ORIGINS` | Recommended | `*` | Comma-separated allowed CORS origins |

  ---

  ## Authentication & RBAC

  VideoGuard uses JWT (HS256, 24 h expiry) for all API access.

  ### Roles

  | Role | Cameras / Alerts | Sites | Analytics | Create/Edit Camera | User Management |
  |---|---|---|---|---|---|
  | `admin` | All sites | All | All | ✅ | ✅ Full CRUD |
  | `support` | All sites | All | All | ✅ | ❌ |
  | `site_viewer` | Assigned site only | Own site | Own site | ❌ (403) | ❌ |

  > Camera create, update, and delete require at least **support** role. Site viewers get HTTP 403.

  ### Default Accounts (seeded by `/api/init`)

  | Username | Password | Role | Scope |
  |---|---|---|---|
  | `admin` | `admin123` | Admin | All sites |
  | `support` | `support123` | Support | All sites |
  | `site1` | `site123` | Site Viewer | Alpha Industrial Complex |
  | `site2` | `site123` | Site Viewer | Beta Warehouse District |
  | `site3` | `site123` | Site Viewer | Gamma Research Campus |

  > Change all default passwords immediately via **Admin → User Management** after deployment.

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
       → vest(8%) · hat(7%) · gloves(6%) · goggles(5%) pixel thresholds
  ```

  ### Fall Detection
  ```
  BBox (x1,y1,x2,y2) → aspect ratio = (x2-x1)/(y2-y1) → ratio > 0.75 → FALLEN
  ```

  ### Red Zone Intrusion
  ```
  Person foot = (cx_normalised, y2_normalised)
              → cv2.pointPolygonTest() vs all active zone polygons
              → inside any polygon → INTRUSION
  ```

  ### Fire Detection (every 5 frames)
  ```
  Frame → HSV → mask bright orange/red/yellow (S>120, V>160)
        → morphological open + dilate → contours
        → largest blob ≥ 1.5% of frame area → FIRE
  ```

  ### Smoke Detection (every 5 frames)
  ```
  Frame → HSV → mask low-saturation gray/white (S<55, V: 45-215)
        → coverage ≥ 28% of frame AND no fire → SMOKE
  ```

  ---

  ## Alert Throttling

  | Alert Type | Throttle | Notes |
  |---|---|---|
  | `missing_ppe` / `fall_detected` / `red_zone_intrusion` | 30 s / camera | Screenshot captured per event |
  | `fire_detected` / `smoke_detected` | 60 s / camera | Separate env-alert path |

  ---

  ## API Reference

  All routes require `Authorization: Bearer <token>` unless marked ❌.

  ### Initialization (Public — secured by `X-Init-Secret` header)

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/init/status` | DB population counts — no auth needed |
  | POST | `/api/init` | Create schema + seed dummy data |
  | POST | `/api/init?force=true` | Wipe all data + full re-seed |

  **Request example:**
  ```bash
  curl -X POST http://localhost:8080/api/init \
    -H "X-Init-Secret: your-secret"
  ```

  **Response:**
  ```json
  {
    "status": "ok",
    "message": "System initialized successfully.",
    "seeded": {
      "sites": 3,
      "cameras": 6,
      "analytics_rows": 96,
      "alerts": 8,
      "red_zones": 3,
      "users": 5,
      "default_accounts": [...]
    }
  }
  ```

  ### Auth

  | Method | Endpoint | Auth | Description |
  |---|---|---|---|
  | POST | `/api/auth/login` | ❌ | Returns `{token, user}`. Rate-limited: 10/IP/60 s |
  | GET | `/api/auth/me` | ✅ | Current user info |

  ### Users (Admin only)

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/users` | List all users |
  | POST | `/api/users` | Create user `{username, password, role, site_id?}` |
  | PUT | `/api/users/{id}` | Update user fields |
  | DELETE | `/api/users/{id}` | Delete user |

  ### Cameras (mutations require admin or support)

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/cameras` | List cameras (auto-filtered for site_viewer) |
  | POST | `/api/cameras` | Create camera — admin/support only |
  | GET | `/api/cameras/{id}` | Single camera details |
  | PATCH | `/api/cameras/{id}` | Update camera — admin/support only |
  | DELETE | `/api/cameras/{id}` | Delete camera — admin/support only |
  | GET | `/api/cameras/{id}/snapshot` | Latest inference snapshot |

  ### Red Zones

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/cameras/{id}/zones` | List zones for camera |
  | POST | `/api/cameras/{id}/zones` | Create zone `{name, points:[{x,y}], color}` |
  | PUT | `/api/cameras/{id}/zones/{zid}` | Update zone (name / points / active) |
  | DELETE | `/api/cameras/{id}/zones/{zid}` | Delete zone |
  | POST | `/api/cameras/{id}/zones/reload` | Reload zones into YOLO inference cache |

  ### Alerts

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/alerts` | List alerts (`?status=open`, `?cameraId=1`, `?limit=50`, `?offset=0`) |
  | POST | `/api/alerts/{id}/acknowledge` | Acknowledge alert |
  | POST | `/api/alerts/{id}/resolve` | Resolve alert |

  ### Analytics

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/analytics/compliance` | Per-camera compliance rate summary |
  | GET | `/api/analytics/hourly` | Alert counts by hour (last 24 h) |
  | GET | `/api/analytics/violations` | Top violation types breakdown |

  ### Streams (❌ no auth — MJPEG / browser `<img>`)

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/yolo/stream/{id}` | Annotated MJPEG with overlays |
  | GET | `/api/yolo/stream-raw/{id}` | Raw un-annotated MJPEG |
  | GET | `/api/yolo/status` | Model status `{modelReady, netLoaded, classes}` |
  | GET | `/api/yolo/detections/{id}` | Latest frame stats for camera |

  ### Sites

  | Method | Endpoint | Description |
  |---|---|---|
  | GET | `/api/sites` | List all sites with camera counts |
  | GET | `/api/sites/{id}` | Site detail |
  | GET | `/api/sites/{id}/cameras` | Cameras belonging to a site |

  ### Health

  | Method | Endpoint | Auth | Description |
  |---|---|---|---|
  | GET | `/api/health` | ❌ | `{"status":"ok"}` |

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
    location         TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'active',  -- active | inactive | error
    stream_url       TEXT,
    ppe_requirements TEXT[] NOT NULL DEFAULT '{}',
    site_id          INTEGER REFERENCES sites(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE alerts (
    id              SERIAL PRIMARY KEY,
    camera_id       INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,    -- missing_ppe | fall_detected | red_zone_intrusion | ...
    severity        TEXT NOT NULL,    -- low | medium | high | critical
    message         TEXT NOT NULL,
    missing_ppe     TEXT[] DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'open',  -- open | acknowledged | resolved
    person_count    INTEGER DEFAULT 0,
    screenshot_url  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ
  );

  CREATE TABLE red_zones (
    id         SERIAL PRIMARY KEY,
    camera_id  INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT 'Restricted Zone',
    points     JSONB NOT NULL DEFAULT '[]',   -- [{x: 0.0–1.0, y: 0.0–1.0}, …]
    color      TEXT NOT NULL DEFAULT '#ff3333',
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE analytics (
    id                     SERIAL PRIMARY KEY,
    camera_id              INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    person_count           INTEGER NOT NULL DEFAULT 0,
    compliant_count        INTEGER NOT NULL DEFAULT 0,
    non_compliant_count    INTEGER NOT NULL DEFAULT 0,
    compliance_rate        NUMERIC(5,1) NOT NULL DEFAULT 100.0,
    missing_hard_hat       INTEGER NOT NULL DEFAULT 0,
    missing_safety_vest    INTEGER NOT NULL DEFAULT 0,
    missing_gloves         INTEGER NOT NULL DEFAULT 0,
    missing_safety_glasses INTEGER NOT NULL DEFAULT 0,
    missing_face_mask      INTEGER NOT NULL DEFAULT 0,
    missing_safety_boots   INTEGER NOT NULL DEFAULT 0,
    recorded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT,
    password_hash TEXT NOT NULL,              -- bcrypt
    role          TEXT NOT NULL DEFAULT 'support',  -- admin | support | site_viewer
    site_id       INTEGER REFERENCES sites(id),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

  ---

  ## Frontend Pages

  | Route | Component | Access | Description |
  |---|---|---|---|
  | `/login` | Login | Public | Dark industrial login with demo account quick-fill |
  | `/` | Dashboard | Any | KPI cards, live feeds, compliance chart, recent incidents |
  | `/cameras` | Camera Grid | Any | All feeds with status badges, compliance bars, AI shimmer |
  | `/cameras/:id` | Camera Detail | Any | Live annotated feed + polygon zone editor |
  | `/alerts` | Incident Log | Any | Summary cards, filter/ACK/resolve, severity-coded rows |
  | `/reports` | Reports | Any | Daily/shift compliance reports, exportable data |
  | `/sites` | Sites | Any | Multi-site overview with camera counts |
  | `/admin/users` | User Management | Admin | Create/edit/deactivate users with role and site assignment |

  ---

  ## Seeded Demo Data

  ### Sites
  | ID | Name | Address |
  |---|---|---|
  | 1 | Alpha Industrial Complex | 100 Factory Road, Zone A |
  | 2 | Beta Warehouse District | 55 Logistics Lane, Zone B |
  | 3 | Gamma Research Campus | 200 Lab Boulevard, Zone C |

  ### Cameras
  | ID | Name | Location | PPE Requirements | Site |
  |---|---|---|---|---|
  | 1 | Main Entrance | Building A - Gate 1 | hard_hat, safety_vest, safety_boots | Alpha |
  | 2 | Production Floor | Building B - Section 2 | hard_hat, safety_vest, gloves, safety_glasses | Alpha |
  | 3 | Warehouse Zone A | Warehouse - North Wing | hard_hat, safety_vest, safety_boots | Beta |
  | 4 | Chemical Lab | Lab Building - Floor 1 | hard_hat, safety_vest, gloves, safety_glasses, face_mask | Gamma |
  | 5 | Outdoor Loading Dock | East Yard - Dock 3 | hard_hat, safety_vest | Beta |
  | 6 | Assembly Line B | Building C - Line 2 | hard_hat, safety_vest, gloves | Alpha |

  ### Pre-seeded Alerts
  | Type | Severity | Status | Camera |
  |---|---|---|---|
  | missing_ppe | high | open | Main Entrance |
  | missing_ppe | critical | open | Production Floor |
  | low_compliance | medium | acknowledged | Warehouse Zone A |
  | camera_offline | high | open | Assembly Line B |
  | missing_ppe | critical | resolved | Chemical Lab |
  | fall_detected | critical | open | Main Entrance |
  | red_zone_intrusion | high | open | Production Floor |
  | fire_detected | critical | acknowledged | Chemical Lab |

  ---

  ## Security Considerations for Production

  1. **Set `JWT_SECRET`** — always provide a strong random secret (32+ chars). The server logs a loud warning if the default is used.
  2. **Set `ALLOWED_ORIGINS`** — restrict CORS to your actual domain(s).
  3. **Set `INIT_SECRET`** — fix the init secret so it doesn't rotate on restart.
  4. **Change default passwords** — use Admin → User Management immediately after seeding.
  5. **Run behind a reverse proxy** — put Nginx/Caddy in front, enable HTTPS, set `Strict-Transport-Security`.
  6. **Database credentials** — keep `DATABASE_URL` in an environment secret, never in code.

  ---

  ## Tech Stack

  | Layer | Technology |
  |---|---|
  | Frontend | Angular 21, Tailwind CSS, Chart.js, standalone components + signals |
  | Backend | FastAPI, Uvicorn, Python 3.11 |
  | AI / CV | YOLOv4-tiny, OpenCV DNN, NumPy (CPU-only) |
  | Database | PostgreSQL, psycopg2 connection pool |
  | Auth | JWT (HS256), bcrypt password hashing |
  | Monorepo | pnpm workspaces |

  ---

  ## License

  MIT — see [LICENSE](LICENSE) for details.
  