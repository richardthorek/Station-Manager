# CLAUDE.md

Guidance for AI agents in this repo. **Read the indexed file you need — don't
grep the whole tree.** This file holds only what's true *every* session; deeper,
situational detail lives in nested `CLAUDE.md` files (they load on demand when
you touch that app) and in `docs/`. Keep this file lean — see "Where detail
lives" below before adding to it.

<!-- Maintainers: this root file is loaded into every session's context. Keep it
under ~150 lines. Per-app detail belongs in backend/frontend/aar-studio
CLAUDE.md; procedures belong in .claude/skills or .claude/commands. -->

## ⛔ Two non-negotiable rules

**1. `docs/` holds exactly three things — never a fourth.**
`docs/MASTER_PLAN.md` (the one plan), `docs/registers/` (machine-readable
API/function registers + `openapi.yaml`), `docs/wiki/` (developer + user-guide
markdown). **Never** create a new plan / roadmap / design-spike / `*_PLAN.md` /
`*_DESIGN.md` anywhere, and never drop a loose file at `docs/` top level. To
capture future work or a decision → **edit `docs/MASTER_PLAN.md`**. New dev docs
→ `docs/wiki/developer/`; user docs → `docs/wiki/user-guide/`. A stray planning
doc is a defect: fold it into `MASTER_PLAN.md` and delete it.

**2. Record progress before the final commit — run `/ship`.** Every session
ends with a dated `docs/wiki/developer/changelog.md` entry and a
`docs/MASTER_PLAN.md` sync. The `/ship` skill has the full checklist (incl. when
to touch registers/architecture). This is part of "done," not optional.

## What this is

**RFS Station Manager (StationKit)** — a real-time digital sign-in system for NSW
Rural Fire Service stations (check in/out, activities, truck checks, reports),
syncing live across kiosks/tablets/phones via WebSockets. Monorepo, **three apps,
one Azure Linux App Service deployment**:

| App | Serves | Stack | Detail |
|---|---|---|---|
| `backend/` | `/api/*`, Socket.io | Express 5 + TS, Azure Table Storage (in-memory twin for dev/test) | `backend/CLAUDE.md` |
| `frontend/` | `/` (SPA, PWA) | React 19 + Vite 7 + TS | `frontend/CLAUDE.md` |
| `aar-studio/` | `/aar` | No-build vanilla ES modules | `aar-studio/CLAUDE.md` |

Backend serves both frontends in prod; `ci-cd.yml` packages all three into one
deploy zip. Features are gated per-organization by SaaS **entitlements**.
**Current status is in `docs/MASTER_PLAN.md` — not here.**

## The work loop: plan → build → test → ship

1. **Plan** — Read `docs/MASTER_PLAN.md` (status board + prioritised queue); work
   top-down. For non-trivial changes, think through the approach first. Capture
   any forward intent in `MASTER_PLAN.md` only — never a new doc.
2. **Build** — Small, focused commits. Follow the conventions below **and** the
   nested `CLAUDE.md` for the app you're in. Plan-gated features must be gated on
   **both** sides (see Cross-app seams).
3. **Test** — Run **`npm run check`** before every push: it mirrors the CI gate
   order locally and fails fast. Add tests for new routes/services/components.
   Never push red. (`/verify` drives the real app for behaviour changes.)
4. **Ship** — Run **`/ship`**: changelog + `MASTER_PLAN` update (+ registers /
   architecture if APIs or signatures changed), then commit, push, open a draft PR.

## Commands

```bash
npm run setup          # install backend + frontend deps (idempotent; auto-run on session start)
npm run dev            # backend + frontend concurrently
npm run build          # build backend then frontend
npm run check          # ⭐ full local CI gate (typecheck → test → lint), CI order, fail-fast
npm run typecheck      # backend + frontend typecheck only
npm run test:all       # backend + frontend + aar-studio tests only
npm run lint           # frontend ESLint (zero-warning gate)
```

Per-app scripts (`npm test`, `npm run dev`, seeds, etc.) live in each app's
`package.json` and its `CLAUDE.md`. **CI gate order** (`.github/workflows/ci-cd.yml`):
design-token check → backend typecheck → backend tests → frontend lint → frontend
typecheck → frontend tests → AAR Studio tests → build. Deploy runs only on `main`.
Docs-only changes (`docs/**`, `*.md`) skip the pipeline. **Node 22.x / npm ≥ 10
required.**

## Architecture (how data flows)

React UI → `frontend/src/services/api.ts` → backend REST route → DB service (via
a **`dbFactory`**, never construct a DB directly) → persists → backend emits a
Socket.io event → all clients update via the `useSocket` hook. No polling.
Socket events: `checkin`, `activity-change`, `member-added`, `event-created`,
`event-ended`, `participant-change`.

## ⚠️ Cross-app seams (the #1 source of prod outages)

The SPA (`/`) and AAR Studio (`/aar`) share **one origin**. When you touch any
seam, check **all** the listed places together — each recent outage came from
updating one and forgetting the rest:

- **Service worker** (`frontend/vite.config.ts`) must keep
  `navigateFallbackDenylist: [/^\/aar/, /^\/api/]` — else it serves the React
  shell for `/aar` (blank screen) and `/api`.
- **SPA fallback** (`backend/src/index.ts` regex `/^\/(?!api|assets|aar).*/`)
  mirrors that denylist. Any new sub-app path must be excluded here too.
- **CSP** lives in **two** places in `index.ts`: Helmet's global policy + a
  scoped `/aar` override (looser). `connect-src` also governs the service
  worker's `fetch()` — a host can be in `font-src` and still be blocked if it's
  missing from `connect-src`. Keep AAR-only hosts in the `/aar` override.
- **CORS** — one `allowedOriginsList` from `FRONTEND_URLS`, reused by Express +
  Socket.io. Deny **without throwing** (`callback(null, false)`); throwing 500s
  every same-origin asset. `FRONTEND_URLS` must list the prod origin.
- **Static mounts + deploy packaging** — `index.ts` mounts `frontend/dist` at `/`
  and `aar-studio/` at `/aar`; `ci-cd.yml`'s package step must copy `aar-studio/`.

Symptoms: blank `/aar` = SW served the React shell (denylist regression); 500s on
assets = CORS threw or `FRONTEND_URLS` wrong; blocked font/analytics fetch = host
missing from `connect-src`.

## Conventions that bite

- **TypeScript strict, no `any`.** Define interfaces; `import type` for types.
- **Gate plan features on both sides**: `<FeatureRoute>` (frontend) +
  `requireFeature(...)` (backend `index.ts`), plus the flag in `Entitlements` +
  `plans.ts`. Admin/role gating uses `<ProtectedRoute>` + `requireOwner`/
  `requireAdmin` — never mix the two. Entitlements are **default-on**; requests
  with no org context (kiosk/demo) always pass through. Detail: each app's
  `CLAUDE.md`.
- **API calls** go through `frontend/src/services/api.ts`; **DB access** through
  a factory. Two DB implementations (in-memory + Table Storage) — a schema change
  usually needs **both** twins plus the shared type.
- **NSW RFS brand**: Signal Red `--rfs-core-red` (#D8232A), Hi-Vis Amber
  `--accent-amber` (#F6A609), Public Sans body / Archivo headings. **One**
  canonical token file: `aar-studio/css/rfs-tokens.css` — `frontend/src/index.css`
  `@import`s it directly (not a hand-copy), so both apps always render the same
  values. **Never hardcode a brand hex** outside that file — use the `var()`;
  `scripts/check-brand-colors.sh` (a CI gate) blocks it. Shared nav/header chrome
  lives in `frontend/src/components/PageHeader.tsx` (sub-pages) and `AdminNav.tsx`
  (admin console) — reuse them rather than hand-rolling a back link. Touch targets
  ≥ 60px (kiosk; 44px inline/desktop). WCAG 2.1 AA. **UI changes need iPad
  portrait + landscape screenshots in the PR.**

## Where detail lives (consult, don't re-derive)

- **App-specific detail** (file index, conventions, gotchas): `backend/CLAUDE.md`,
  `frontend/CLAUDE.md`, `aar-studio/CLAUDE.md` — auto-loaded when you work there.
- `docs/MASTER_PLAN.md` — the single plan (status board, queue, open decisions).
- `docs/wiki/developer/changelog.md` — dated history of everything shipped.
- `docs/wiki/developer/architecture.md` — architecture of record.
- `docs/wiki/developer/README.md` — index of all developer pages.
- `docs/registers/` — machine-readable API/function registers + OpenAPI; validate
  with `scripts/validate-registries.sh`.
- `.claude/` — agent tooling: `commands/` (`/check`), `skills/` (`/ship`),
  `settings.json` (session-start setup hook, safe-command allowlist).
