# Workspace

## Overview

PPE (Personal Protective Equipment) Compliance System — pnpm workspace monorepo using TypeScript + Python. Streams real video feeds with live YOLOv4-based person detection and PPE compliance analysis.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: FastAPI + Uvicorn (unified Python backend)
- **Database**: PostgreSQL + psycopg2-binary (Python) / Drizzle ORM (schema definitions)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS launcher bundle)
- **AI/Vision**: Python 3.11, OpenCV DNN (YOLOv4-tiny), FastAPI + Uvicorn

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Thin Node.js launcher that spawns the unified Python FastAPI service (`artifacts/yolo-service/main.py`). All API logic lives in Python. This launcher exists because the Replit artifact system requires a registered artifact with an `artifact.toml` — the api-server artifact registration is retained for this purpose. The launcher can be removed if the artifact system gains support for directly registering Python services.

- Entry: `src/index.ts` — finds Python, installs pip dependencies, spawns `main.py` on `PORT`
- `pnpm --filter @workspace/api-server run dev` — run the dev server (launches Python)
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)

### `artifacts/yolo-service`

Unified FastAPI backend serving all REST API routes and YOLO detection:

- `main.py` — FastAPI app with YOLO detection routes, MJPEG streaming, **auth middleware**
- `db.py` — PostgreSQL connection helper using psycopg2
- `auth_utils.py` — JWT (HS256/python-jose), bcrypt password hashing, FastAPI deps (`get_current_user`, `require_admin`, `site_filter_from_request`)
- `simulation.py` — simulated PPE detection snapshot logic
- `seed.py` — database seeder (runs on startup); includes `_ensure_users()` for 5 default accounts
- `routes/cameras.py` — camera CRUD endpoints (returns `siteId`)
- `routes/alerts.py` — alert list/acknowledge/resolve endpoints (returns `screenshotUrl`)
- `routes/analytics.py` — live analytics, history, compliance summary
- `routes/reports.py` — daily compliance reports
- `routes/health.py` — health check endpoint
- `routes/sites.py` — site CRUD + cameras-per-site endpoints
- `routes/auth.py` — `POST /api/auth/login`, `GET /api/auth/me`
- `routes/users.py` — admin-only user CRUD (`GET/POST/PUT/DELETE /api/users`)
- `screenshots/` — violation JPEG snapshots served at `/api/screenshots/{filename}`
- All routes prefixed with `/api/` (e.g., `/api/cameras`, `/api/yolo/stream/{id}`, `/api/yolo/stream-raw/{id}`)
- YOLO loop auto-captures violation screenshots (1 per 30s per camera) and inserts alerts with `screenshot_url`
- DB schema: `sites`, `cameras`, `alerts`, `analytics`, `red_zones`, `users` tables

**Auth middleware** (in `main.py`): all `/api/*` routes require `Authorization: Bearer <token>` except:
- `/api/auth/*` (login endpoint)
- `/api/yolo/stream*` / `/api/yolo/stream-raw*` (MJPEG — browsers can't send headers on `<img>` src)
- `/api/screenshots/*` (static violation images)
- `/api/health*` (health checks)

**Roles**: `admin` (full access + user management), `support` (view all, manage alerts), `site_viewer` (own site only)

**Default accounts**: admin/admin123, support/support123, site1/site123 → site2/site123 → site3/site123

### `artifacts/ppe-dashboard` (Angular 21)

Angular standalone-component dashboard with dark industrial design:

- `src/app/services/auth.service.ts` — Auth state using Angular signals; login/logout/me; token stored in localStorage
- `src/app/interceptors/auth.interceptor.ts` — Functional HTTP interceptor; adds Bearer token; auto-logout on 401
- `src/app/guards/auth.guard.ts` — `canActivate`: checks `isAuthenticated()`, redirects to `/login`
- `src/app/guards/admin.guard.ts` — `canActivate`: checks `isAdmin()`, redirects to `/`
- `src/app/pages/login/login.component.ts` — Dark industrial login page with demo account quick-fill
- `src/app/pages/admin/user-management.component.ts` — Admin panel: user table + create/edit/delete modals
- `src/app/layout/sidebar.component.ts` — Shows username/role badge, logout button, admin-only "Users" nav item

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
