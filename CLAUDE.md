# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo. Optimised
for fast, token-efficient navigation — **read the indexed file you need instead
of grepping the whole tree.**

## ⛔ THE DOCS STRUCTURE RULE (non-negotiable)

**`docs/` contains exactly three things. Never add a fourth.**

1. **`docs/MASTER_PLAN.md`** — the one plan. All planning and forward intent
   happens here and only here.
2. **`docs/registers/`** — the machine-readable technical registers describing
   the backend: `api_register.json`, `function_register.json`, `openapi.yaml`.
3. **`docs/wiki/`** — wiki-style markdown: `wiki/developer/` (architecture,
   guides, the changelog, and `history/` for archived reference material) and
   `wiki/user-guide/` (the end-user guide).

Rules that follow from this:

- **NEVER** create a new planning, roadmap, design-spike, "future work",
  proposal, strategy, or `*_PLAN.md` / `*_DESIGN.md` / `*_ROADMAP.md` document —
  not in `docs/`, not in an app folder, not anywhere. To capture future work, a
  design decision, or a change of direction: **edit `docs/MASTER_PLAN.md`**
  (status board + prioritised queue + open decisions).
- **NEVER** drop a new loose file at `docs/` top level. New developer docs go in
  `docs/wiki/developer/`; new user-facing docs go in `docs/wiki/user-guide/`
  (and get linked from that section's `README.md` index). Point-in-time
  reviews/audits go in `docs/wiki/developer/history/reviews/`.
- The old design spikes live in `docs/wiki/developer/history/archive/` — they
  are historical **reference only, not live plans**; never resurrect one as the
  place to plan. If a planning doc reappears anywhere, treat it as a defect:
  fold its content into `MASTER_PLAN.md` and delete/archive it.
- **The master plan looks forward only.** It holds the status board, the
  prioritised queue, open decisions, and reference tables — not shipping
  narratives. Dated "what shipped" entries belong in
  `docs/wiki/developer/changelog.md`.

## 📝 PROGRESS TRACKING RULE (mandatory at end of every session)

**Before pushing the final commit of a session, record what happened.** This is
not optional — it is part of "done".

1. **Add a dated entry to `docs/wiki/developer/changelog.md`** (top of the
   matching month section) summarising what shipped: what problem was solved,
   the concrete changes, the PR number, and any caveats. Format:

   ```
   - 2026-MM-DD: **Short title (#PR).** One-sentence summary of the problem solved.
     **What shipped:** concrete changes. *N tests; suites green.*
   ```

2. **Update `docs/MASTER_PLAN.md`** to match reality: flip statuses on the
   feature board, remove finished queue items, insert newly discovered work in
   priority order, and record/resolve open decisions. Do **not** add the dated
   narrative there — that's the changelog's job.

### When to also update other docs

- API endpoint added/changed → `docs/registers/api_register.json` (+
  `docs/registers/openapi.yaml`) and `docs/wiki/developer/api-reference.md`.
- Backend function/service signature changed → `docs/registers/function_register.json`.
- Architecture changed → `docs/wiki/developer/architecture.md`.
- CI pipeline changed → `docs/wiki/developer/ci-pipeline.md`.
- User-visible behaviour changed → the matching `docs/wiki/user-guide/` page.

The plan captures *what's next and why*; the changelog captures *what shipped*;
the registers and architecture page capture *how it works now*. Keep them in sync.

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
- **Current status lives elsewhere** — feature state and priorities in
  `docs/MASTER_PLAN.md` (status board + queue); what shipped when in
  `docs/wiki/developer/changelog.md`. Don't rely on this file for either.
  Features are gated per-organization by SaaS **entitlements** (see "SaaS
  tenancy & entitlements").
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

Organizations are the billing tenant; features are gated per-org. Default-**on**
(`ENABLE_ENTITLEMENTS !== 'false'`); requests with no org context (kiosk/demo)
always pass through, preserving single-tenant/kiosk back-compat.

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
- **Billing:** Stripe (Checkout/Portal/signature-verified webhooks) syncs the
  org's plan/status/entitlements; billing code lives in `routes/billing.ts` +
  `services/stripeClient.ts` and no-ops cleanly when Stripe env vars are unset.
  For what's built vs outstanding, check the status board + queue in
  `docs/MASTER_PLAN.md`; design history in
  `docs/wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md`.

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

The `docs/` layout is fixed (see THE DOCS STRUCTURE RULE above): the plan, the
registers, and the wiki.

- `docs/MASTER_PLAN.md` — **the single plan.** Feature status board,
  prioritised queue (Q-items), open decisions. **There is no other plan.**
- `docs/wiki/developer/changelog.md` — dated history of everything shipped.
- `docs/wiki/developer/architecture.md` — architecture/implementation of record.
- `docs/registers/api_register.json` + `docs/registers/function_register.json` —
  machine-readable endpoint/function registers (Draft-7). Update when
  APIs/signatures change; validated in CI via `scripts/validate-registries.sh`.
  `docs/registers/openapi.yaml` — OpenAPI spec.
- `docs/wiki/developer/README.md` — index of all developer pages: api-reference,
  getting-started, feature-development, testing, deployment, ci-pipeline,
  security, authentication, logging, suite-token-validation, registers-guide.
- `docs/wiki/user-guide/README.md` — index of the end-user guide (update the
  matching page when user-visible behaviour changes).
- `docs/wiki/developer/history/` — archived design spikes (`archive/` —
  historical detail only, *not* live plans: CONSOLIDATION_REVIEW,
  SAAS_COMMERCIALIZATION_DESIGN, AI_MAINTENANCE_AGENT_DESIGN,
  SUITE_INTEGRATION_PLAN, AAR_STUDIO_PLAN), dated reviews + screenshots
  (`reviews/`), and implementation-note deep dives (`implementation-notes/`).

## Conventions (the ones that bite)

- **TypeScript strict, no `any`.** Define interfaces; `import type` for types.
- **React**: function components + hooks only. Named exports. Route components
  must be lazy-loaded and wrapped in `<Suspense fallback={<LoadingFallback />}>`.
- **CSS**: component-scoped files, BEM-ish names, use vars from `index.css`.
  No inline styles.
- **NSW RFS brand**: red `#e5281B`, lime `#cbdb2a`, Public Sans — canonical
  tokens in `aar-studio/css/rfs-tokens.css`, mirrored by the SPA's `index.css`.
  Touch targets ≥ 60px (kiosk; 44px minimum for inline/desktop controls).
  WCAG 2.1 AA. UI changes need iPad portrait+landscape screenshots in the PR.
- **Gating**: plan features use `FeatureRoute` + backend `requireFeature`; admin
  uses `ProtectedRoute` + `requireOwner`/`requireAdmin`. Gate on both sides.
- **API calls** go through `services/api.ts`; **DB access** through a factory.
- **Tests** encouraged for new routes/services/components (coverage thresholds
  currently not enforced). Backend tests use the in-memory DB.
- **Per the PR template**, update the changelog +
  `MASTER_PLAN.md`, `wiki/developer/architecture.md`, and the
  `docs/registers/` JSON registers when a change affects roadmap, API, or
  function signatures (see THE PROGRESS TRACKING RULE above).

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
- Post-deployment smoke tests **do run on `main` deploys** (`npm run test:post-deploy`
  → compiled `backend/dist/scripts/postDeploymentTests.js`, hitting the live
  `bungrfs-linux` app); they are skipped on PRs. They assert live-endpoint behaviour, so
  a deliberate API/auth change (e.g. the `requireSession` data-protection gate makes
  `GET /api/members` return 401 to anonymous callers) must be reflected in
  `postDeploymentTests.ts` or the `main` run fails *after* the PR merged green.
- Node 22.x / npm ≥ 10 required.
</content>
