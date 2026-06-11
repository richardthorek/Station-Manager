# Design: RFS Tools Suite — Integrating Station Manager, Fire Break Calculator & Fire Santa Run

**Status:** Draft / strategic design (assessment + options — not implemented)
**Author:** Design spike, June 2026
**Related:** `docs/SAAS_COMMERCIALIZATION_DESIGN.md` (Organization/Stripe/entitlements
billing model this builds on), `docs/MULTI_DOMAIN_HOSTING_ANALYSIS.md` (multi-domain
readiness), `docs/AS_BUILT.md` (multi-station + auth), `docs/MASTER_PLAN.md`.
**Sibling repos analysed:** `richardthorek/fireBreakCalculator`,
`richardthorek/fire-santa-run`.

---

## 1. Purpose & goal

Richard owns three RFS/NSW firefighting web apps in three separate repos and
deployments. The goal is to deliver them as **one product suite** that achieves
**all four** of:

1. **Lower cost & maintenance** — fewer deployments and less duplicated upkeep.
2. **Sellable product suite** — a commercial, multi-tenant SaaS with per-app plans.
3. **Consistent brand/UX** — one RFS look-and-feel and shared component library.
4. **One subscription / login** — customers sign in once and are billed once.

This document assesses the three apps, lays out the integration **options** (a
spectrum from loose federation to full consolidation), and recommends a **phased
roadmap** plus the **open decisions** to make first.

**Key existing asset:** Station Manager already has the spine for a sellable suite
— `organizations`, `plans` (`community`/`basic`/`ai`), and an `Entitlements`
interface (`backend/src/middleware/entitlements.ts`, `constants/plans.ts`,
`services/organizationDatabase.ts`, `routes/auth.ts`) with `requireFeature()`
gating on the backend and `<FeatureRoute>`/`hasFeature()` on the frontend
(`frontend/src/contexts/AuthContext.tsx`, `components/FeatureRoute.tsx`). The
deeper billing/tenancy design already exists in `SAAS_COMMERCIALIZATION_DESIGN.md`.
**This plan extends that model to span all three apps rather than reinventing it.**

---

## 2. The three apps at a glance

| | **Station Manager** (this repo) | **Fire Santa Run** | **Fire Break Calculator** |
|---|---|---|---|
| Domain | Station sign-in, truck checks, reports | Santa-run route planning + live public GPS tracking | Fire-break planning: draw routes → time/cost/resource estimates |
| Frontend | React 19 + Vite, `frontend/` | React 19 + Vite + React Router 7, `src/` | React 19 + Vite, `webapp/` |
| Backend | **Express 5 + Socket.io**, `backend/` | **Hono** `server/` + **Azure Functions** `api/` | **Azure Functions** `api/` |
| Real-time | Socket.io | **Azure Web PubSub** (+ `socket.io-client` dep) | none (stateless) |
| Auth | **Custom JWT + bcrypt**, full org/plan/entitlements | **Microsoft Entra External ID** (MSAL) | **None** (public tool) |
| Tenancy | **Organizations + plans + entitlements** | Brigade-based, role-based members | Single-deployment, public |
| Data | Azure Table Storage / in-memory | Azure Table Storage / localStorage | Azure Table Storage |
| Hosting | 1 Azure App Service (`bungrfsstation`), backend serves `dist/` | Azure App Service (Linux) + Bicep IaC | Azure (Functions + static) |
| Maps | — | Mapbox GL | Mapbox GL Draw / Leaflet |

### Common (cheap to unify)
React 19 + TypeScript + Vite frontends; Azure Table Storage everywhere; Azure
hosting; identical RFS/NSW domain & brand; `recharts` 3.8.1 shared by SM and Santa
Run; PWA-capable; Mapbox in both map apps.

### Divergent (the real integration cost)
1. **Auth** — three models: JWT (SM) / Entra External ID (Santa) / none (Calc).
2. **Backend runtime** — Express+Socket.io vs Hono+Functions vs Functions.
3. **Real-time** — Socket.io vs Azure Web PubSub vs none.
4. **Tenancy/billing** — full in SM, partial in Santa Run, absent in Calculator.

---

## 3. Strategic options (the spectrum)

### Option A — "Federation": common subscription + SSO only
Keep three repos & deployments. Extract a shared **Identity + Subscription**
service (built from SM's org/entitlements + the Stripe design in
`SAAS_COMMERCIALIZATION_DESIGN.md`). All apps validate the same token and read the
same entitlements; add a portal/app-launcher landing page. Single login, single
bill.
- **Pros:** fastest; apps evolve independently; low risk.
- **Cons:** still 3 deployments (no cost saving); UX/brand drift; must reconcile
  auth models. Achieves the *subscription* + *SSO* goals but **not** cost or full UX.

### Option B — "Suite": Option A + shared packages
Add private shared packages (GitHub Packages or a workspace `packages/`):
design-system/theme, shared domain types, API/auth SDK, Azure Table Storage
helpers. Apps stay separate deployments but look unified and share plumbing.
- **Pros:** consistent brand/UX + single subscription; moderate effort; keeps
  independent release cadence.
- **Cons:** still N deployments (limited cost saving); package-versioning
  discipline required. Achieves 3 of 4 goals; partial on cost.

### Option C — "Unified monorepo + single deployment" (achieves all four goals)
Consolidate into one workspace (npm/pnpm + Turborepo):

```
apps/        station-manager   santa-run   (firebreak → embedded feature)
packages/    ui (design system)   auth   data (table-storage)   types   config
services/    api (single Express+Socket.io backend absorbing the Functions/Hono APIs)
```

One React shell with an **app launcher**, one backend, one Azure App Service, one
auth, one subscription. Fire Break Calculator (stateless, no auth) collapses into a
**route/feature** inside the shell; Fire Santa Run becomes a **peer app**.
- **Pros:** lowest long-term cost & maintenance; one brand/UX; single subscription
  by construction; cleanest product-suite story.
- **Cons:** highest upfront effort & risk — port Functions/Hono → Express routes,
  reconcile real-time (Socket.io vs Web PubSub) and auth.

---

## 4. Recommendation: phase toward Option C, bank value at each step

Because all four goals are in scope, the **target is Option C**, reached in phases
so each phase ships standalone value and de-risks the next.

**Phase 0 — Decisions & canonical model (this doc + a spike)**
- Adopt the **decoupled identity-vs-entitlement** model (§5).
- Extend `Entitlements` with per-app flags, e.g. `santaRunEnabled`,
  `fireBreakEnabled`, alongside today's
  `signInEnabled`/`truckCheckEnabled`/`reportsEnabled`/`aiEnabled`.

**Phase 1 — Shared identity + subscription** *(Option A value: SSO + one bill)*
- Stand up SM's org/entitlements (+ the Stripe billing from
  `SAAS_COMMERCIALIZATION_DESIGN.md`) as the canonical **Subscription/Licensing
  service**; expose an `/api/auth/me`-style entitlements endpoint the other apps consume.
- Add a **suite portal / app-launcher** page; SSO across apps.

**Phase 2 — Shared packages** *(Option B value: consistent brand/UX)*
- Extract `@rfs/ui`, `@rfs/types`, `@rfs/auth-sdk`, `@rfs/data` (§6) and adopt in
  all three apps. Calculator gains the RFS shell/header.

**Phase 3 — Monorepo consolidation** *(Option C value: cost + single deploy)*
- Merge repos into the workspace. Fire Break Calculator → embedded feature route;
  Fire Santa Run → peer app under the shared shell on a single App Service.
- Converge the backend onto Express+Socket.io (port the Functions/Hono endpoints),
  **or** standardise real-time on Azure Web PubSub everywhere — see Risks (§7).

---

## 5. Authentication recommendation

**Decouple authentication (who you are) from entitlement (what you can use), and
standardise authentication on Microsoft Entra External ID (CIAM); keep Station
Manager's org + entitlements as the authorization/billing layer.**

- **Why Entra for authN:** standards-based OIDC; social/email login + MFA out of
  the box; removes custom password-handling liability (SM's bcrypt/JWT); already
  proven in Fire Santa Run. SM migrates login to Entra and links existing users by
  Entra object ID. Public Santa-run *viewers* still need no login.
- **Why keep SM entitlements for authZ/billing:** it already models organizations,
  plans and per-feature entitlements — the exact spine for selling a suite, and the
  `SAAS_COMMERCIALIZATION_DESIGN.md` Stripe layer plugs straight in. Extend it with
  per-app flags rather than rebuild. Tokens carry identity (Entra); the Subscription
  service resolves org + entitlements.
- **Alternative (documented):** keep SM's JWT as the IdP and migrate Santa Run off
  Entra. Lower SM rework, but more long-term custom-auth maintenance and a weaker
  enterprise story. Note this conflicts slightly with the JWT-retaining assumption
  in `SAAS_COMMERCIALIZATION_DESIGN.md` §2 — that doc would need a small revision
  if we adopt Entra.

---

## 6. Where each app lands & shared packages

**App roles**
- **Station Manager** → the hub: identity, subscription/entitlements, the suite
  portal, and the shared shell.
- **Fire Santa Run** → peer app (own feature area), shares shell/auth/billing;
  guarded by a **seasonal** entitlement flag.
- **Fire Break Calculator** → embedded **feature/route** (stateless, no own auth);
  its small Functions API folds into the shared backend or stays a thin function.

**Shared packages to extract (Phase 2)**
- `@rfs/ui` — RFS theme tokens + components (from `frontend/src/index.css`,
  `frontend/src/components/`); single source of brand truth.
- `@rfs/types` — domain types (org, member, station, brigade, entitlements).
- `@rfs/auth-sdk` — Entra login + entitlement fetch/guard (generalised
  `hasFeature`/`<FeatureRoute>`).
- `@rfs/data` — Azure Table Storage helpers + the dual in-memory/Table factory
  pattern (generalise `backend/src/services/dbFactory*.ts`).

---

## 7. Key risks / decisions to flag

1. **Real-time convergence:** Socket.io (SM) vs Azure Web PubSub (Santa). Web PubSub
   scales without sticky sessions but is Azure-coupled; Socket.io needs sticky
   sessions / a Redis adapter at scale. Pick one for the unified backend.
2. **Backend runtime convergence:** porting the Azure Functions/Hono endpoints into
   Express is the bulk of Phase 3 effort — budget it explicitly.
3. **Entra migration of existing SM users:** object-ID linking + password-reset
   comms are sensitive; needs a migration runbook, and a revision to
   `SAAS_COMMERCIALIZATION_DESIGN.md` §2 (which currently assumes JWT).
4. **Seasonality:** Santa Run is seasonal — the entitlement flag + portal must
   show/hide it gracefully.
5. **CI/CD:** three pipelines → one Turborepo/matrix pipeline; preserve SM's ordered
   CI gates (backend typecheck → tests → frontend lint → typecheck → tests → build).
6. **Domains/CORS:** see `MULTI_DOMAIN_HOSTING_ANALYSIS.md` — SM is already
   multi-domain-ready; a suite portal under one domain with per-app paths is the
   simplest hosting shape.

---

## 8. Open decisions for the user

- **Depth:** stop at Option A/B, or fund the full Option C consolidation?
- **Auth:** accept **Entra-for-authN + SM-entitlements-for-authZ**, or keep SM JWT
  as the IdP?
- **Real-time standard** for a unified backend: Socket.io vs Azure Web PubSub?
- **Plan/SKU shape:** per-app flags vs bundled suite tiers (ties into
  `SAAS_COMMERCIALIZATION_DESIGN.md` pricing).
