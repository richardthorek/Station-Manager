# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo. Optimised
for fast, token-efficient navigation — **read the indexed file you need instead
of grepping the whole tree.**

## What this is

RFS Station Manager — a real-time digital sign-in system for NSW Rural Fire
Service stations. Members check in/out, track activities, run truck checks, and
view reports. Changes sync live across kiosks/tablets/phones via WebSockets.

- **Monorepo**: `backend/` (Express 5 + Socket.io + TypeScript) and
  `frontend/` (React 19 + Vite 7 + TypeScript). Root `package.json` orchestrates both.
- **Status**: v1.0 MVP in production (sign-in only). Truck Check + Reports built
  but gated behind "Coming in v1.1" on the landing page.
- **DB**: Azure Table Storage in prod; in-memory store for local dev/tests.
  Selected at runtime by `dbFactory` (see below).
- **Deploy**: GitHub Actions → Azure App Service (`bungrfsstation`). Frontend
  `dist/` is served by the backend in prod.

## Commands

Run from the relevant package dir unless noted.

```bash
# Root
npm run dev            # backend + frontend concurrently
npm run build          # build backend then frontend
npm start              # run prod build (node backend/dist/index.js)

# Backend (cd backend)
npm run dev            # in-memory DB, NODE_ENV=development, port 3000
npm run dev:prod       # production DB (needs AZURE_STORAGE_CONNECTION_STRING)
npm run build          # tsc → dist/
npm test               # Jest + Supertest (in-memory DB)
npx tsc --noEmit       # typecheck (CI gate)

# Frontend (cd frontend)
npm run dev            # Vite dev server, port 5173
npm run build          # tsc -b && vite build
npm run lint           # ESLint (CI gate — zero warnings)
npm test               # Vitest + React Testing Library
npx tsc -b --noEmit    # typecheck (CI gate)
```

**CI gates (`.github/workflows/ci-cd.yml`)**, in order: backend typecheck →
backend tests → frontend lint → frontend typecheck → frontend tests → build.
All must pass. Deploy runs only on `main`. Docs-only changes (`docs/**`, `*.md`)
skip the pipeline.

## Architecture (how data flows)

1. React UI → `frontend/src/services/api.ts` → backend REST route.
2. Route handler → DB service (via a `dbFactory`) → persists.
3. Backend emits a Socket.io event; all clients receive it via the `useSocket` hook.
4. Clients update local state and re-render. No polling.

Socket events: `checkin`, `activity-change`, `member-added`, `event-created`,
`event-ended`, `participant-change`.

**Database factories** — always get the DB through these, never construct directly:
- `backend/src/services/dbFactory.ts` → `ensureDatabase()` (members, activities,
  check-ins, events, stations).
- `backend/src/services/truckChecksDbFactory.ts` → `ensureTruckChecksDatabase()`.
- `backend/src/services/adminUserDbFactory.ts` → admin users.
- Selection priority: Table Storage if `USE_TABLE_STORAGE=true` (or dev +
  `AZURE_STORAGE_CONNECTION_STRING` present), else in-memory.

## Backend file index (`backend/src/`)

- `index.ts` — Express app bootstrap: env load, helmet/CORS/compression,
  rate limiters, route registration, Socket.io server, DB + demo-station seeding.
- **routes/** (REST handlers, mounted under `/api/*`): `members.ts`,
  `activities.ts`, `checkins.ts`, `events.ts`, `stations.ts`, `truckChecks.ts`,
  `reports.ts`, `brigadeAccess.ts`, `export.ts`, `auth.ts`, `achievements.ts`.
- **services/** (business logic + persistence):
  - In-memory: `database.ts`, `truckChecksDatabase.ts`, `adminUserDatabase.ts`.
  - Table Storage: `tableStorageDatabase.ts`, `tableStorageTruckChecksDatabase.ts`,
    `tableStorageAdminUserDatabase.ts`, `azureStorage.ts` (blob).
  - Factories: `dbFactory.ts`, `dbFactoryHelper.ts`, `truckChecksDbFactory.ts`,
    `adminUserDbFactory.ts`.
  - Other: `brigadeAccessService.ts`, `achievementService.ts`,
    `csvExportService.ts`, `rolloverService.ts` (midnight rollover),
    `rfsFacilitiesParser.ts` (station CSV lookup), `demoStationSeeder.ts`,
    `defaultMembers.ts`, `logger.ts` (winston), `appInsights.ts`,
    `errorHandler.ts`, `version.ts`.
- **middleware/**: `auth.ts` + `flexibleAuth.ts` (JWT/admin), `rateLimiter.ts`,
  `kioskModeMiddleware.ts`, `stationMiddleware.ts`, `requestId.ts`,
  `requestLogging.ts`, `validationHandler.ts`, and per-resource `*Validation.ts`
  (express-validator chains).
- **types/**: `index.ts` (core domain types), `achievements.ts`, `stations.ts`.
- **constants/stations.ts**, **utils/auditUtils.ts**.
- **scripts/**: one-off ops (seed/purge/upload). See `scripts/README.md`.
- **__tests__/**: Jest integration tests, one per route/service. **__mocks__/**:
  Azure SDK + uuid mocks for tests.

## Frontend file index (`frontend/src/`)

- `App.tsx` — Router. All routes lazy-loaded via `React.lazy` + `<Suspense>`.
- `main.tsx`, `index.css` (CSS vars / RFS theme), `animations.css`.
- **features/** (route-level, self-contained):
  - `landing/` (`/`), `signin/` (`/signin`, `/signin/:linkId`),
    `profile/` (`/profile/:memberId`), `auth/` (`/login`).
  - `admin/stations/` (`/admin/stations`), `admin/brigade-access/`
    (`/admin/brigade-access`).
  - `reports/` (`/reports*` — gated), `truckcheck/` (`/truckcheck*` — gated).
- **components/** — shared UI (Header, Toast, MemberList, ActivitySelector,
  EventCard, DataTable, charts: `HeatMapChart`/`KPICard`/`InsightCard`, PWA bits:
  `InstallPrompt`/`OfflineIndicator`, etc.). Most have a colocated `.css` and
  many a `.test.tsx`.
- **contexts/**: `AuthContext`, `StationContext`, `ToastContext`.
- **hooks/**: `useSocket` (real-time), `useTheme`, `useToast`, `useDebounce`,
  `useFocusTrap`, `useSwipeGesture`, `usePullToRefresh`.
- **services/**: `api.ts` (all REST calls), `offlineQueue.ts`,
  `offlineStorage.ts`, `offlineSupport.ts`.
- **utils/**: `exportUtils.ts` (+ `.lazy`), `csvUtils.ts`, `analyticsHelpers.ts`,
  `errorHandler.ts`, `kioskMode.ts`, `haptic.ts`, `announcer.ts`, `animations.ts`.
- **types/**: `index.ts`, `achievements.ts`. **test/**: setup, mocks, render utils.

## Docs you should consult (don't re-derive)

- `docs/MASTER_PLAN.md` — **single source of truth** for roadmap, priorities,
  technical debt. Update it when changing project direction.
- `docs/AS_BUILT.md` — current architecture/implementation of record.
- `docs/api_register.json` + `docs/function_register.json` — machine-readable
  endpoint/function registries (Draft-7). Update when APIs/signatures change;
  validated in CI via `scripts/validate-registries.sh`.
- `docs/API_DOCUMENTATION.md`, `docs/openapi.yaml` — REST/WS reference.
- `docs/GETTING_STARTED.md`, `docs/FEATURE_DEVELOPMENT_GUIDE.md` — dev guides.
- `docs/AZURE_DEPLOYMENT.md`, `docs/ci_pipeline.md` — deploy/CI.
- `.github/copilot-instructions.md` — full conventions (this file is the short form).
- `docs/archive/` historical; `docs/implementation-notes/` deep dives;
  `docs/current_state/` dated snapshots + UI screenshots.

## Conventions (the ones that bite)

- **TypeScript strict, no `any`.** Define interfaces; `import type` for types.
- **React**: function components + hooks only. Named exports. Route components
  must be lazy-loaded and wrapped in `<Suspense fallback={<LoadingFallback />}>`.
- **CSS**: component-scoped files, BEM-ish names, use vars from `index.css`.
  No inline styles.
- **NSW RFS brand**: red `#e5281B`, lime `#cbdb2a`. Touch targets ≥ 60px
  (kiosk). WCAG 2.1 AA. UI changes need iPad portrait+landscape screenshots in the PR.
- **API calls** go through `services/api.ts`; **DB access** through a factory.
- **Tests** encouraged for new routes/services/components (coverage thresholds
  currently not enforced). Backend tests use the in-memory DB.
- **Per the PR template / copilot-instructions**, update `MASTER_PLAN.md`,
  `AS_BUILT.md`, and the JSON registers when a change affects roadmap, API, or
  function signatures.

## Gotchas

- Two parallel DB implementations (in-memory + Table Storage) — a schema/method
  change usually needs editing **both** the in-memory service and its Table
  Storage twin, plus the shared type.
- Demo station auth is intentionally bypassed (see `demoStationAuth` handling) —
  don't "fix" it as a vulnerability.
- Post-deployment smoke tests are disabled in CI (need ts-node, prod has no dev
  deps). Don't rely on them.
- Node 22.x / npm ≥ 10 required.
</content>
