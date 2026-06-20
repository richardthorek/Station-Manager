# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo. Optimised
for fast, token-efficient navigation — **read the indexed file you need instead
of grepping the whole tree.**

## What this is

RFS Station Manager — a real-time digital sign-in system for NSW Rural Fire
Service stations. Members check in/out, track activities, run truck checks, and
view reports. Changes sync live across kiosks/tablets/phones via WebSockets.

- **Monorepo — three apps, one deployment**:
  - `backend/` (Express 5 + Socket.io + TypeScript) — the API + Socket.io server;
    also serves the two frontends in prod.
  - `frontend/` (React 19 + Vite 7 + TypeScript) — the main SPA at `/`.
  - `aar-studio/` — a **no-build vanilla HTML/CSS/ES-module** sub-app served at
    `/aar` (AI-facilitated After Action Reviews; its own `node --test` suite, its
    own docs under `aar-studio/docs/`). Shares no code with the SPA.

  Root `package.json` orchestrates backend + frontend. See "Multi-app structure
  & integration seams" below — most recent production bugs came from the seams
  between these apps (service worker, CSP, CORS).
- **Status**: v1.1 in production — sign-in, truck check, and reports all shipped.
  Features are gated per-organization by SaaS **entitlements** (see "SaaS tenancy
  & entitlements"). AAR Studio is live at `/aar`. Stripe billing is designed
  (`docs/SAAS_COMMERCIALIZATION_DESIGN.md`) but **not yet wired**.
- **DB**: Azure Table Storage in prod; in-memory store for local dev/tests.
  Selected at runtime by `dbFactory` (see below).
- **Deploy**: GitHub Actions → Azure **Linux** App Service (`bungrfs-linux`). The
  backend serves `frontend/dist` (at `/`) and the `aar-studio/` bundle (at
  `/aar`); `ci-cd.yml` packages all three into one deploy zip.

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
backend tests → frontend lint → frontend typecheck → frontend tests → AAR Studio
tests (`node --test`) → build. All must pass. Deploy runs only on `main` (the zip
bundles `backend/dist` + `frontend/dist` + `aar-studio/`). Docs-only changes
(`docs/**`, `*.md`) skip the pipeline. There is no separate AAR Studio workflow —
it was folded into this pipeline.

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

## Multi-app structure & integration seams

The main SPA (`/`) and AAR Studio (`/aar`) share **one origin**, so browser- and
deploy-level concerns must be handled consistently. These are the seams — when
you touch any of them, check **all** of the listed places, because each recent
prod outage came from updating one and forgetting the others:

- **Service worker (PWA)** — `frontend/vite.config.ts` (`VitePWA`/`workbox`). The
  SW is scoped to `/` and uses `navigateFallback` to the SPA shell. It **must**
  keep `navigateFallbackDenylist: [/^\/aar/, /^\/api/]` or it serves the React
  shell for `/aar` (blank screen) and `/api`.
- **SPA fallback (server)** — `backend/src/index.ts` regex
  `/^\/(?!api|assets|aar).*/`. Mirrors the SW denylist; any new sub-app path must
  be excluded here too.
- **CSP** — set in **two** places in `index.ts`: Helmet's global policy (main
  app) and a **scoped override middleware on `/aar`** (looser: jsDelivr scripts,
  Azure OpenAI/Speech `connect-src`, mic/display-capture). Note `connect-src`
  also governs **`fetch()` made by the service worker** (e.g. Google-Fonts
  caching) — a host can be in `font-src` and still be blocked if it's missing
  from `connect-src`. Keep AAR-only hosts in the `/aar` override, not the global
  policy.
- **CORS** — single `allowedOriginsList` from `FRONTEND_URLS` (`index.ts`), reused
  by Express **and** Socket.io. The origin callback must **deny without throwing**
  (`callback(null, false)`); throwing 500s every same-origin asset request.
  `FRONTEND_URLS` must include the prod origin (the Bicep/App-Service setting),
  or it falls back to `localhost` and blocks everything.
- **Static mounts & deploy packaging** — `index.ts` mounts `frontend/dist` at `/`
  and `aar-studio/` at `/aar` (guarded by `fs.existsSync`, path via
  `AAR_STUDIO_PATH`). `ci-cd.yml`'s "Create deployment package" step must copy
  `aar-studio/` into the zip.

**Adding a new sub-app or external resource:** update the SW denylist, the SPA
fallback regex, the relevant CSP directive(s) (scoped, not global), the deploy
package step, and the static mount — together.

## SaaS tenancy & entitlements

Organizations are the billing tenant; features are gated per-org. Default-**off**
(`ENABLE_ENTITLEMENTS` env) for single-tenant/kiosk back-compat.

- **Model** (`backend/src/types/index.ts`, `backend/src/constants/plans.ts`):
  `Organization` (`planCode` `community|basic|ai`, `status`, `entitlements`,
  reserved `stripeCustomerId`/`stripeSubscriptionId`). `Entitlements` =
  `signInEnabled | truckCheckEnabled | reportsEnabled | aiEnabled` + limits
  (`maxStations`, `maxDevices`, `aiIncludedSessions`). `plans.ts` maps plan →
  default entitlements and clamps owner overrides to the plan ceiling.
- **Backend gating** — `requireFeature('<feature>')` middleware
  (`middleware/entitlements.ts`) on the matching `/api/*` mount in `index.ts`.
  No-op when entitlements are disabled or there's no org context (kiosk/demo).
- **Frontend gating** — `<FeatureRoute feature="...">` wraps entitlement-gated
  routes; `<ProtectedRoute>` wraps **auth**-gated (admin) routes. `AuthContext`'s
  `hasFeature()` reads the org's entitlements from `/api/auth/me`.
- **Rule:** a gated feature must be wrapped on **both** sides (FeatureRoute +
  requireFeature) and its flag added to `Entitlements` + `plans.ts`. Use
  `FeatureRoute` for plan features, `ProtectedRoute`/`requireOwner`/`requireAdmin`
  for admin/role — never mix the two.
- **Not yet built:** Stripe checkout/portal/webhooks, usage metering
  (`UsageRecord`), and gating on a few routes (`export`, station/device limits).
  See `docs/SAAS_COMMERCIALIZATION_DESIGN.md` and `docs/CONSOLIDATION_REVIEW.md`.

## Backend file index (`backend/src/`)

- `index.ts` — Express app bootstrap: env load, helmet/CORS/compression,
  rate limiters, route registration, Socket.io server, DB + demo-station seeding.
- **routes/** (REST handlers, mounted under `/api/*`): `members.ts`,
  `activities.ts`, `checkins.ts`, `events.ts`, `stations.ts`, `truckChecks.ts`,
  `reports.ts`, `brigadeAccess.ts`, `export.ts`, `auth.ts` (signup/login/me),
  `organizations.ts` (SaaS tenant + plan management), `achievements.ts`.
- **services/** (business logic + persistence):
  - In-memory: `database.ts`, `truckChecksDatabase.ts`, `adminUserDatabase.ts`,
    `organizationDatabase.ts`.
  - Table Storage: `tableStorageDatabase.ts`, `tableStorageTruckChecksDatabase.ts`,
    `tableStorageAdminUserDatabase.ts`, `tableStorageOrganizationDatabase.ts`,
    `azureStorage.ts` (blob).
  - Factories: `dbFactory.ts`, `dbFactoryHelper.ts`, `truckChecksDbFactory.ts`,
    `adminUserDbFactory.ts`, `organizationDbFactory.ts`.
  - Other: `brigadeAccessService.ts`, `achievementService.ts`,
    `csvExportService.ts`, `rolloverService.ts` (midnight rollover),
    `rfsFacilitiesParser.ts` (station CSV lookup), `demoStationSeeder.ts`,
    `defaultMembers.ts`, `logger.ts` (winston), `appInsights.ts`,
    `errorHandler.ts`, `version.ts`.
- **middleware/**: `auth.ts` + `flexibleAuth.ts` (JWT/admin/brigade-token),
  `entitlements.ts` (`requireFeature`, `attachOrganization`), `rateLimiter.ts`,
  `kioskModeMiddleware.ts`, `stationMiddleware.ts`, `requestId.ts`,
  `requestLogging.ts`, `validationHandler.ts`, and per-resource `*Validation.ts`
  (express-validator chains).
- **types/**: `index.ts` (core domain types incl. `Organization`/`Entitlements`),
  `achievements.ts`, `stations.ts`.
- **constants/stations.ts**, **constants/plans.ts** (plan → entitlements),
  **utils/auditUtils.ts**.
- **scripts/**: one-off ops (seed/purge/upload). See `scripts/README.md`.
- **__tests__/**: Jest integration tests, one per route/service. **__mocks__/**:
  Azure SDK + uuid mocks for tests.

## Frontend file index (`frontend/src/`)

- `App.tsx` — Router. All routes lazy-loaded via `React.lazy` + `<Suspense>`.
- `main.tsx`, `index.css` (CSS vars / RFS theme), `animations.css`.
- **features/** (route-level, self-contained):
  - `landing/` (`/` — public app picker), `signin/` (`/signin` gated,
    `/sign-in` ungated external-link entry), `profile/` (`/profile/:memberId`),
    `auth/` (`/login`, `/signup`).
  - `admin/stations/` (`/admin/stations`), `admin/brigade-access/`
    (`/admin/brigade-access`), `admin/organization/` (`/admin/organization` —
    plan/users) — all auth-gated.
  - `reports/` (`/reports*` — gated), `truckcheck/` (`/truckcheck*` — gated).
  - AAR Studio is **not** here — it's the separate `aar-studio/` bundle, linked
    from the landing page as a plain `<a href="/aar/">`.
- **components/** — shared UI (Header, Toast, MemberList, ActivitySelector,
  EventCard, DataTable, `FeatureRoute` (entitlement gate), `ProtectedRoute`
  (auth gate), charts: `HeatMapChart`/`KPICard`/`InsightCard`, PWA bits:
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
- `docs/CONSOLIDATION_REVIEW.md` — cross-app coherence roadmap (design-system
  unification, server-side AI gateway, AAR identity/persistence, shared types).
- `docs/SAAS_COMMERCIALIZATION_DESIGN.md` — plans/pricing, Stripe billing design,
  usage metering. `docs/AI_MAINTENANCE_AGENT_DESIGN.md` — server-side AI agent.
- `.github/copilot-instructions.md` — full conventions (this file is the short form).
- `docs/archive/` historical; `docs/implementation-notes/` deep dives;
  `docs/current_state/` dated snapshots + UI screenshots.

## Conventions (the ones that bite)

- **TypeScript strict, no `any`.** Define interfaces; `import type` for types.
- **React**: function components + hooks only. Named exports. Route components
  must be lazy-loaded and wrapped in `<Suspense fallback={<LoadingFallback />}>`.
- **CSS**: component-scoped files, BEM-ish names, use vars from `index.css`.
  No inline styles.
- **NSW RFS brand**: red `#e5281B`, lime `#cbdb2a`, Public Sans. Touch targets
  ≥ 60px (kiosk). WCAG 2.1 AA. UI changes need iPad portrait+landscape
  screenshots in the PR. (AAR Studio currently uses its own divergent palette —
  unifying these is `CONSOLIDATION_REVIEW.md` #2.)
- **Gating**: plan features use `FeatureRoute` + backend `requireFeature`; admin
  uses `ProtectedRoute` + `requireOwner`/`requireAdmin`. Gate on both sides.
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
- **The `/aar` seams bite** (see "Multi-app structure"): the service-worker
  `navigateFallbackDenylist`, the SPA-fallback regex, and the scoped `/aar` CSP
  must all stay in sync. A blank `/aar` screen = the SW served the React shell
  (denylist regression); 500s on assets = CORS throwing or `FRONTEND_URLS` wrong;
  blocked font/analytics fetches = host missing from `connect-src` (which governs
  SW `fetch()`, not just `font-src`).
- Entitlement gating is **default-on** (`ENABLE_ENTITLEMENTS !== 'false'`). To
  disable for local dev set `ENABLE_ENTITLEMENTS=false`. **Never disable in
  production** — it removes all plan/billing enforcement. Requests with no org
  context (kiosk/demo/plain JWT) always pass through regardless of this flag.
  New routes that are plan-gated must add `requireFeature(...)` in `index.ts`
  and a matching `<FeatureRoute>` in the frontend; gating `/api/export` behind
  `reportsEnabled` and enforcing `maxStations` on `POST /api/stations` are live
  examples. See `backend/src/middleware/entitlements.ts`.
- Post-deployment smoke tests are disabled in CI (need ts-node, prod has no dev
  deps). Don't rely on them.
- Node 22.x / npm ≥ 10 required.
</content>
