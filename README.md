# Station Manager — part of Bushie Tools

A real-time digital sign-in and brigade-operations platform for NSW Rural Fire
Service stations. Members check in and out, track activities, run truck checks,
review reports, and facilitate AI-assisted After Action Reviews — all syncing
live across kiosks, tablets, and phones via WebSockets.

> **Brand:** Station Manager ships as part of **Bushie Tools** — the
> customer-facing suite of approachable tools built *for the average bushie*
> (Station Manager, AAR Studio, and more to come). The logged-out marketing site
> and the post-login app launcher carry the Bushie Tools identity; "Station
> Manager" is the name of this app within the suite.

![Version](https://img.shields.io/badge/version-1.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What's in the box

Station Manager is a **monorepo of three apps, deployed as one**:

| App | Stack | Served at | Purpose |
|-----|-------|-----------|---------|
| **backend/** | Express 5 + Socket.io + TypeScript | API + WS server | REST API, real-time events; also serves the two frontends in prod |
| **frontend/** | React 19 + Vite 7 + TypeScript | `/` | The main SPA (sign-in, truck checks, reports, admin, billing) |
| **aar-studio/** | Vanilla HTML/CSS/ES-modules (no build) | `/aar` | AI-facilitated After Action Reviews (its own `node --test` suite) |

The backend serves `frontend/dist` at `/` and the `aar-studio/` bundle at `/aar`;
CI packages all three into a single Azure App Service deploy.

## Features

### Brigade operations
- 🔥 **Station Sign-In** — one-tap member check-in/out with activity tracking and
  real-time sync across every connected device. QR codes and personal sign-in
  links per member. Self-registration.
- 🚛 **Truck Check** — vehicle inspection checklists with reference/result photos.
- 📊 **Reports & Analytics** — historical reporting, heat maps, KPIs, CSV export.
- 🎙️ **AAR Studio** — capture an After Action Review discussion live (speech-to-text),
  collaborate with the whole room via join codes, build a findings board, and
  export the report. AI features run through a server-side gateway (no
  browser-held API keys).
- ⚙️ **Admin** — station management, brigade access tokens (kiosk locking),
  organization & plan management.

### SaaS platform (Bushie Tools)
- 🏢 **Organizations & plans** — the billing tenant. Plans (`Community` / `Basic` /
  `AI Pro`) map to **entitlements** that gate features per organization.
- 🎛️ **Per-feature & per-app gating** — `signInEnabled`, `truckCheckEnabled`,
  `reportsEnabled`, `aiEnabled`, plus per-app suite flags `aarStudioEnabled`,
  `santaRunEnabled`, `fireBreakEnabled`. Gated on both the backend
  (`requireFeature`) and frontend (`<FeatureRoute>`).
- 💳 **Stripe billing** — self-service checkout, customer portal, and webhook-driven
  entitlement sync (test-mode wired; see config below).
- 🔐 **Suite federation** — Station Manager's JWT is the suite identity provider;
  sibling apps validate the same token and read entitlements via
  `GET /api/auth/entitlements`. See [docs/SUITE_TOKEN_VALIDATION.md](docs/SUITE_TOKEN_VALIDATION.md).

### Platform
- ⚡ Real-time WebSocket sync (no polling)
- 📱 PWA: installable, offline-capable, kiosk-friendly (60px+ touch targets)
- ♿ WCAG 2.1 AA; NSW RFS brand (red `#e5281B`, lime `#cbdb2a`, Public Sans)

## Quick start

### Prerequisites
- Node.js 22.x and npm ≥ 10
- Git

### Install & run (in-memory DB, no Azure needed)

```bash
git clone https://github.com/richardthorek/Station-Manager.git
cd Station-Manager

# Install everything (root orchestrates backend + frontend)
npm install

# Run backend + frontend together
npm run dev
```

- Frontend (Vite dev server): http://localhost:5173
- Backend (API + Socket.io): http://localhost:3000
- AAR Studio (served by the backend in prod): http://localhost:3000/aar

Local development uses an **in-memory database** by default — no Azure connection
string required. Entitlement gating is on by default; set
`ENABLE_ENTITLEMENTS=false` to disable it for single-tenant/kiosk dev.

**📖 Full setup:** [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

## Commands

```bash
# Root
npm run dev      # backend + frontend concurrently
npm run build    # build backend then frontend
npm start        # run prod build (node backend/dist/index.js)

# Backend (cd backend)
npm run dev          # in-memory DB, development, port 3000
npm run dev:prod     # production DB (needs AZURE_STORAGE_CONNECTION_STRING)
npm run build        # tsc → dist/
npm test             # Jest + Supertest (in-memory DB)
npx tsc --noEmit     # typecheck (CI gate)

# Frontend (cd frontend)
npm run dev          # Vite dev server, port 5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint (CI gate — zero warnings)
npm test             # Vitest + React Testing Library
npx tsc -b --noEmit  # typecheck (CI gate)

# AAR Studio (cd aar-studio)
node --test          # its own test suite (no build step)
```

## Application routes (SPA)

| Route | Feature | Gating |
|-------|---------|--------|
| `/` | Marketing page (logged-out) / app launcher (logged-in) | — |
| `/signin` | Station member sign-in | `signInEnabled` |
| `/profile/:memberId` | Member profile + QR code | — |
| `/truckcheck` | Vehicle maintenance tracking | `truckCheckEnabled` |
| `/reports` | Reports and analytics | `reportsEnabled` |
| `/aar/` | AAR Studio (separate sub-app) | `aarStudioEnabled` |
| `/login`, `/signup` | Auth | — |
| `/admin/stations` | Station management | admin |
| `/admin/brigade-access` | Brigade access tokens | admin |
| `/admin/organization` | Plan, users, billing | owner/admin |

## Architecture

```
┌──────────────────────┐        ┌─────────────────────┐
│  React SPA (/)        │        │  AAR Studio (/aar)  │
│  React 19 + Vite      │        │  vanilla ES modules │
└──────────┬───────────┘        └──────────┬──────────┘
           │  HTTP + WebSocket              │  HTTP (AI gateway)
           └───────────────┬────────────────┘
                  ┌─────────▼──────────┐
                  │  Express 5 backend │  REST + Socket.io + AI gateway
                  │  + entitlements    │  serves both frontends in prod
                  └─────────┬──────────┘
                  ┌─────────▼──────────┐
                  │  Azure Table       │  in-memory store for dev/tests
                  │  Storage (+ Blob)  │  selected at runtime by dbFactory
                  └────────────────────┘
```

**Data flow:** React UI → `services/api.ts` → backend REST route → DB service
(via a `dbFactory`) → persists → backend emits a Socket.io event → all clients
update via the `useSocket` hook. No polling.

**Tech stack:** React 19, TypeScript, Vite 7, Socket.io, Framer Motion (frontend);
Node 22, Express 5, Socket.io, TypeScript (backend); Azure Table Storage + Blob
(production), in-memory (dev); Stripe (billing); Azure OpenAI + Azure Speech
(AI gateway).

## Configuration

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` →
`frontend/.env`. Key environment variables:

| Group | Vars |
|-------|------|
| **Core** | `PORT`, `NODE_ENV`, `FRONTEND_URLS` (CORS allow-list) |
| **Auth** | `REQUIRE_AUTH`, `JWT_SECRET`, `JWT_EXPIRY`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` |
| **Database** | `USE_TABLE_STORAGE`, `AZURE_STORAGE_CONNECTION_STRING` |
| **Entitlements** | `ENABLE_ENTITLEMENTS` (default on; never disable in prod) |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `APP_URL` |
| **AI gateway** | `AZURE_OPENAI_*`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| **Frontend** | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_SANTA_RUN_URL`, `VITE_FIREBREAK_URL` |

Full reference: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md) and
[docs/AUTHENTICATION_CONFIGURATION.md](docs/AUTHENTICATION_CONFIGURATION.md).

## Testing

```bash
cd backend && npm test     # Jest + Supertest (in-memory DB)
cd frontend && npm test    # Vitest + React Testing Library
cd aar-studio && node --test
```

**CI gates** (`.github/workflows/ci-cd.yml`), in order: backend typecheck →
backend tests → frontend lint → frontend typecheck → frontend tests → AAR Studio
tests → build. Deploy runs only on `main`. Docs-only changes (`docs/**`, `*.md`)
skip the pipeline.

## Deployment

GitHub Actions → Azure **Linux** App Service (`bungrfs-linux`). The backend serves
`frontend/dist` at `/` and the `aar-studio/` bundle at `/aar`; the CI "Create
deployment package" step bundles `backend/dist` + `frontend/dist` + `aar-studio/`
into one deploy zip.

- **Database:** Azure Table Storage (production) — selected via
  `USE_TABLE_STORAGE=true` + `AZURE_STORAGE_CONNECTION_STRING`. ~$6–34/year per
  station. (The project migrated off Cosmos DB / MongoDB; see CHANGELOG.)
- **Images:** Azure Blob Storage (truck-check photos).
- **Real-time:** Socket.io over native WebSocket (WSS in prod).

See [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md) for step-by-step
instructions.

## Documentation

Start here:
- **[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)** — single source of truth for
  roadmap, priorities, and the change log
- **[docs/AS_BUILT.md](docs/AS_BUILT.md)** — current architecture of record
- **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** — local dev setup
- **[docs/FEATURE_DEVELOPMENT_GUIDE.md](docs/FEATURE_DEVELOPMENT_GUIDE.md)** — how to add a feature
- **[CLAUDE.md](CLAUDE.md)** — fast, token-efficient repo guide for AI agents

Reference:
- **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** + [docs/openapi.yaml](docs/openapi.yaml) — REST/WS reference
- **[docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)** — production deployment
- **[docs/AUTHENTICATION_CONFIGURATION.md](docs/AUTHENTICATION_CONFIGURATION.md)** — auth & entitlements config

SaaS & suite:
- **[docs/SAAS_COMMERCIALIZATION_DESIGN.md](docs/SAAS_COMMERCIALIZATION_DESIGN.md)** — plans, pricing, billing model
- **[docs/SUITE_INTEGRATION_PLAN.md](docs/SUITE_INTEGRATION_PLAN.md)** — multi-app suite strategy
- **[docs/SUITE_TOKEN_VALIDATION.md](docs/SUITE_TOKEN_VALIDATION.md)** — sibling-app token/entitlement contract

Historical material lives in [docs/archive/](docs/archive/); dated snapshots and
UI screenshots in [docs/current_state/](docs/current_state/); deep dives in
[docs/implementation-notes/](docs/implementation-notes/).

## Security

Multiple layers: Helmet security headers (CSP — global plus a scoped `/aar`
override, X-Frame-Options, HSTS, etc.), HTTPS/WSS, a single CORS allow-list
(`FRONTEND_URLS`) shared by Express and Socket.io, express-validator input
validation, rate limiting (~1,000 req/hr/IP on the API; 5/15min on auth), JWT +
bcrypt auth, and organization-scoped entitlement gating. Secrets are configured
via environment variables / Azure Key Vault, never committed.

See [docs/SECURITY_DEPLOYMENT_GUIDE.md](docs/SECURITY_DEPLOYMENT_GUIDE.md) and the
security section of [docs/AS_BUILT.md](docs/AS_BUILT.md).

## Project status

**v1.1 in production.** Sign-in, truck check, and reports are shipped. SaaS
foundation (organizations, plans, entitlements) and Stripe billing are wired in
test mode. AAR Studio is live at `/aar`. The Bushie Tools suite is at Phase 1
(shared identity + subscription + app launcher); shared packages (Phase 2) and
monorepo consolidation (Phase 3) are planned — see
[docs/SUITE_INTEGRATION_PLAN.md](docs/SUITE_INTEGRATION_PLAN.md).

## Contributing

1. Branch from `main`
2. Make your changes (TypeScript strict, no `any`; lazy-loaded route components;
   component-scoped CSS using vars from `index.css`)
3. Keep the CI gates green; UI changes need iPad portrait + landscape screenshots
4. Update `MASTER_PLAN.md`, `AS_BUILT.md`, and the JSON registers when a change
   affects roadmap, API, or function signatures
5. Open a PR

## License

MIT.

## Acknowledgments

- NSW Rural Fire Service for design guidelines
- The volunteer RFS community

---

**Built with ❤️ for the RFS volunteer community**
