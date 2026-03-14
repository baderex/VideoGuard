# VideoGuard — AI-Powered PPE Compliance System

Real-time video analytics platform that monitors industrial camera feeds using YOLOv4 object detection to enforce PPE (Personal Protective Equipment) compliance.

---

## Features

- **Live YOLO Detection** — YOLOv4-tiny neural network detects persons in real time across 6 concurrent camera feeds
- **Bounding Boxes & Confidence Scores** — Every detected person is annotated with a green/red corner-style bounding box and YOLO confidence score
- **PPE Compliance Analysis** — Color-based heuristics identify high-vis vests and hard hats on each detected person
- **MJPEG Video Stream** — Annotated frames streamed at 25fps via MJPEG directly from the Python inference service
- **Live Telemetry Panel** — Person count and compliance % updated every 2 seconds per camera
- **Dark Industrial Dashboard** — Angular 21 frontend with the SecureSight dark/neon visual theme, camera grid, alerts feed, and report generation
- **Alerts & Reports** — Automatic PostgreSQL-backed alerts for compliance violations; historical reports per camera/shift

---

## Recent Changes — Angular v21 Migration

The frontend was fully converted from **React 18 + Vite** to **Angular v21** (standalone components, signals, new control-flow syntax). All five pages are preserved:

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Live analytics overview with Chart.js compliance trend, camera snapshots, active feeds |
| Cameras | `/cameras` | Grid of all camera nodes with status toggling and add-camera dialog |
| Camera Detail | `/cameras/:id` | Simulated MJPEG feed, live detection stats, PPE compliance per person |
| Alerts | `/alerts` | Incident log table with severity/status filtering, acknowledge/resolve actions |
| Reports | `/reports` | Daily compliance report with hourly bar charts and top-violations breakdown |

### Key Technical Details

- **Framework:** Angular v21.2.x with standalone components (no NgModules)
- **State management:** Angular signals (`signal()`, `computed()`) and `toSignal()` for RxJS bridging
- **Template syntax:** New `@if` / `@for` / `@else` control-flow blocks (no `*ngIf` / `*ngFor` directives)
- **Charts:** Chart.js v4 via `ng2-charts` v10 (`BaseChartDirective`, `provideCharts(withDefaultRegisterables())`)
- **HTTP:** `provideHttpClient()` with RxJS polling using `timer()` + `switchMap()` + `shareReplay({ refCount: true })`
- **Routing:** `provideRouter(routes)` with lazy-loaded page components via `loadComponent`
- **Styling:** Tailwind CSS v4 with PostCSS, preserving the full SecureSight dark/neon theme (CSS custom properties)
- **TypeScript:** v5.9.x (Angular 21 requirement), strict mode with no `any` casts
- **Dev server:** `serve.mjs` reads `PORT` and `BASE_PATH` env vars, passes `--serve-path` and configures `baseHref`

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Angular 21 Frontend  (port via Replit proxy)             │
│  – Camera grid, detail pages, alerts, reports             │
│  – Standalone components, signals, ng2-charts             │
└────────────────────────┬─────────────────────────────────┘
                         │ MJPEG stream + REST API
┌────────────────────────▼─────────────────────────────────┐
│  Express API Server  (port 8080)                          │
│  – REST routes, PostgreSQL via Drizzle ORM                │
│  – Proxies /api/yolo/* → Python service (port 6000)       │
└────────────────────────┬─────────────────────────────────┘
                         │ spawns on startup
┌────────────────────────▼─────────────────────────────────┐
│  Python FastAPI + Uvicorn  (port 6000)                    │
│  – YOLOv4-tiny via OpenCV DNN (no PyTorch required)       │
│  – 6 camera threads: capture → detect → annotate → MJPEG  │
│  – PPE heuristics: vest (HSV color) + hard hat (head ROI)  │
└──────────────────────────────────────────────────────────┘
                         │ reads
┌────────────────────────▼─────────────────────────────────┐
│  PostgreSQL  (Drizzle ORM schema)                         │
│  – cameras, alerts, reports, compliance_events            │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, Tailwind CSS 4, ng2-charts, Chart.js 4 |
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
  api-server/            # Express API (port 8080)
    src/
      app.ts             # Express app + YOLO proxy
      index.ts           # Entry point — spawns Python service
      lib/auto-seed.ts   # DB seeder (cameras, sample alerts)
  ppe-dashboard/         # Angular 21 frontend
    angular.json         # Angular CLI project configuration
    serve.mjs            # Dev server entry (reads PORT, BASE_PATH)
    postcss.config.js    # Tailwind CSS v4 PostCSS plugin
    tsconfig.json        # Root TypeScript config
    tsconfig.app.json    # App-specific TypeScript config
    src/
      index.html         # HTML shell with <base href="/">
      main.ts            # Angular bootstrap (standalone, no NgModule)
      styles.css         # Tailwind + SecureSight theme CSS variables
      app/
        app.component.ts       # Root component with <router-outlet>
        app.routes.ts          # Route definitions (5 pages, lazy-loaded)
        layout/
          app-layout.component.ts  # Main layout shell
          sidebar.component.ts     # Navigation sidebar
        pages/
          dashboard/       # Live analytics overview
          cameras/         # Camera node grid
          camera-detail/   # Single camera feed + detection stats
          alerts/          # Incident log with filtering
          reports/         # Daily compliance reports
        components/
          camera-form-dialog.component.ts  # Add/edit camera dialog
          ppe-icons.component.ts           # PPE equipment icon list
          simulated-feed.component.ts      # MJPEG feed display
          toast-container.component.ts     # Toast notifications
        services/
          analytics.service.ts  # Live analytics + history polling
          camera.service.ts     # Camera CRUD + snapshot polling
          alert.service.ts      # Alert list, acknowledge, resolve
          toast.service.ts      # Toast notification service
        lib/
          models.ts        # TypeScript interfaces & enum-like consts
          utils.ts         # Date formatting, compliance rate helpers
    public/feeds/          # Input video files (cam1–cam6.mp4)
  yolo-service/            # Python inference service
    main.py                # FastAPI + YOLOv4 detection + MJPEG
    .cache/                # Auto-downloaded model weights (gitignored)
lib/
  db/src/schema/           # Drizzle schema (cameras, alerts, reports)
  api-spec/                # OpenAPI spec
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

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `4200` | Port for the Angular dev server |
| `BASE_PATH` | No | `/` | Base path prefix for sub-path hosting |

### Run

```bash
# Start the API server (auto-spawns the Python YOLO service)
pnpm --filter @workspace/api-server run dev

# Start the Angular frontend
pnpm --filter @workspace/ppe-dashboard run dev
```

The YOLO service will auto-download YOLOv4-tiny weights (~24 MB) from GitHub on first run.

### Build for Production

```bash
pnpm --filter @workspace/ppe-dashboard run build
```

Output is written to `artifacts/ppe-dashboard/dist/`.

### Type Checking

```bash
pnpm --filter @workspace/ppe-dashboard run typecheck
```

Runs `tsc --noEmit` against the app TypeScript config.

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

## Angular Migration Notes

### What Changed (React → Angular)

| Aspect | Before (React) | After (Angular 21) |
|---|---|---|
| Framework | React 18 + Vite | Angular 21 (standalone) |
| Routing | wouter | @angular/router with lazy loading |
| State | TanStack Query + React state | Angular signals + RxJS polling |
| HTTP | TanStack Query + fetch | HttpClient + RxJS observables |
| Charts | Chart.js (direct) | ng2-charts v10 (BaseChartDirective) |
| Styling | Tailwind CSS v4 | Tailwind CSS v4 (unchanged) |
| Build tool | Vite | Angular CLI (esbuild/Vite internally) |
| Template | JSX | Angular templates with @if/@for |

### What Was Preserved

- Full SecureSight dark/neon visual theme (CSS custom properties, backdrop blur, neon glows)
- All five pages: Dashboard, Cameras, Camera Detail, Alerts, Reports
- Camera form dialog for adding new camera nodes
- PPE icon display component
- Simulated MJPEG feed component
- Toast notification system
- API integration with polling intervals

---

## License

MIT
