# backend/ — Express 5 + Socket.io + TypeScript

The API + Socket.io server; also serves both frontends in prod. See root
`CLAUDE.md` for the work loop, cross-app seams, and shared conventions. This file
loads when you work in `backend/`.

## Commands (from `backend/`)

```bash
npm run dev            # in-memory DB, NODE_ENV=development, port 3000
npm run dev:prod       # production DB (needs AZURE_STORAGE_CONNECTION_STRING)
npm test               # Jest + Supertest (in-memory DB)
npx tsc --noEmit       # typecheck (CI gate)
npm run build          # tsc → dist/ (+ copies data CSVs)
```

Seed/purge/ops one-offs: `npm run seed:*`, `purge:*`, `facilities:*`,
`backup:prod` — see `scripts/README.md`. Never run `purge:*` without intent.

## File index (`backend/src/`)

- `index.ts` — app bootstrap: env, helmet/CORS/compression, rate limiters, route
  registration, Socket.io, DB + demo-station seeding. **The seams live here** (see
  root `CLAUDE.md`): SPA-fallback regex, dual CSP, CORS `allowedOriginsList`,
  static mounts, and every `requireFeature(...)` mount.
- **routes/** (`/api/*`): `members`, `activities`, `checkins`, `events`,
  `stations`, `truckChecks`, `reports`, `brigadeAccess`, `export`, `auth`
  (signup/login/me), `organizations` (SaaS tenant + plans), `achievements`,
  `billing`, `webauthn`, `platform` (owner console), `ai`.
- **services/** — business logic + persistence. Every domain has an **in-memory
  twin and a Table Storage twin** (`database.ts` ↔ `tableStorageDatabase.ts`,
  and same for `truckChecks`, `adminUser`, `organization`, `usage`). Plus
  `azureStorage.ts` (blob), `brigadeAccessService`, `achievementService`,
  `csvExportService`, `rolloverService` (midnight rollover), `rfsFacilitiesParser`,
  `demoStationSeeder`, `stripeClient`, `santaAddonService`, `logger` (winston),
  `appInsights`, `errorHandler`, `version`.
- **Factories** (always get the DB through these, never construct directly):
  `dbFactory.ts` → `ensureDatabase()`, `truckChecksDbFactory`, `adminUserDbFactory`,
  `organizationDbFactory`. Selection: Table Storage if `USE_TABLE_STORAGE=true`
  (or dev + `AZURE_STORAGE_CONNECTION_STRING` present), else in-memory.
- **middleware/**: `auth` + `flexibleAuth` (JWT/admin/brigade-token),
  `entitlements` (`requireFeature`, `attachOrganization`), `rateLimiter`,
  `kioskModeMiddleware`, `stationMiddleware`, `requestId`, `requestLogging`,
  `validationHandler`, per-resource `*Validation.ts` (express-validator).
- **types/** (`index.ts` = core domain incl. `Organization`/`Entitlements`),
  **constants/** (`stations.ts`, `plans.ts` = plan → entitlements),
  **utils/auditUtils.ts**, **scripts/** (ops), **__tests__/** + **__mocks__/**.

## Backend conventions & gotchas

- **Two DB implementations.** A schema/method change usually needs editing the
  in-memory service **and** its Table Storage twin, **and** the shared type in
  `types/index.ts`. Tests run against the in-memory DB.
- **Entitlements** (`middleware/entitlements.ts`): `requireFeature('<feature>')`
  on the matching `/api/*` mount in `index.ts`. No-op when entitlements are
  disabled (`ENABLE_ENTITLEMENTS=false`, local dev only — **never in prod**) or
  there's no org context (kiosk/demo/plain JWT always pass through). New plan-gated
  routes need `requireFeature` here **and** a `<FeatureRoute>` in the frontend.
  `plans.ts` clamps owner overrides to the plan ceiling. Live examples:
  `/api/export` behind `reportsEnabled`, `maxStations` on `POST /api/stations`.
- **Demo-station auth is intentionally bypassed** (`demoStationAuth`) — don't
  "fix" it as a vulnerability.
- **Post-deployment smoke tests run on `main` deploys** (`npm run test:post-deploy`
  → compiled `dist/scripts/postDeploymentTests.js`, hitting live `bungrfs-linux`);
  skipped on PRs. They assert live behaviour, so a deliberate API/auth change must
  be reflected in `postDeploymentTests.ts` or the `main` run fails **after** merge.
- **Billing** (`routes/billing.ts` + `services/stripeClient.ts`) no-ops cleanly
  when Stripe env vars are unset (signature-verified webhooks).
- Update `docs/registers/api_register.json` (+ `openapi.yaml`) on endpoint
  changes and `function_register.json` on service/route signature changes;
  `scripts/validate-registries.sh` gates them.
