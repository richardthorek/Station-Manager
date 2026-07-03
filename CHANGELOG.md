# Changelog

All notable changes to the RFS Station Manager project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_The detailed, dated change log lives in
[`docs/wiki/developer/changelog.md`](docs/wiki/developer/changelog.md).
Highlights below are grouped by theme; see the wiki changelog for the full
per-PR record._

### Bushie Tools suite (federation — Phase 1)
- **Shared identity & subscription** (#556): Station Manager's entitlements are
  now the canonical licensing layer for the suite. Added per-app entitlement
  flags `aarStudioEnabled`, `santaRunEnabled`, `fireBreakEnabled` alongside the
  per-feature flags; `GET /api/auth/entitlements` lets sibling apps validate the
  same JWT and read entitlements. The logged-in landing page is now the suite
  **app launcher** (apps lock/unlock by entitlement). New
  `docs/wiki/developer/suite-token-validation.md` documents the contract. SM JWT is retained as
  the suite IdP (kiosk/device iPads use brigade access tokens).
- **Bushie Tools rebrand + design-system unification** (#549, #550): canonical
  RFS design tokens (`aar-studio/css/rfs-tokens.css`) shared by the SPA and AAR
  Studio; topbar/font/touch-target alignment; suite identity across titles, PWA
  manifest, and READMEs.

### AI & AAR Studio
- **Server-side AI gateway** (#555): new `/api/ai/*` (chat, report, speech token,
  usage). AI provider credentials live server-side; AAR Studio no longer calls
  Azure browser-direct. `UsageRecord` metering (in-memory + Table Storage twins);
  session-based monthly allowance enforced at the speech-token endpoint (402 when
  exhausted); optional hourly Stripe metered reporting.
- **AAR Studio collaborative session notes** (#551): the whole room can
  contribute to a live After Action Review via deterministic join codes and
  ephemeral Socket.io rooms (`aar:host`/`aar:join`/`aar:note`); notes feed the AI
  findings extraction.

### Commercialization
- **Stripe billing** (#553): checkout sessions, customer portal, and
  signature-verified webhooks driving entitlement sync; upgrade UI.
- **SaaS foundation** (#552 and earlier): `Organization` billing tenant, plan
  catalog (`Community`/`Basic`/`AI Pro`), `Entitlements` with `requireFeature`
  backend gating and `<FeatureRoute>` frontend gating (`ENABLE_ENTITLEMENTS`,
  default on; passes through for kiosk/demo). Self-service signup; `/auth/me`
  returns org + entitlements.
- **Marketing & pricing landing page** (#554): logged-out Bushie Tools front door
  with plan tiers, monthly/annual toggle, and signup deep-links into Stripe
  Checkout.

### Database (BREAKING, completed)
- Migrated from Azure Cosmos DB (MongoDB API) to **Azure Table Storage** for the
  production database. 70–95% cost savings (~$6–34/year per station). All
  MongoDB/Cosmos code, dependencies, and `MONGODB_URI` removed. Database selected
  via `USE_TABLE_STORAGE=true` + `AZURE_STORAGE_CONNECTION_STRING`; in-memory for
  dev/tests.

### Documentation
- Full README rewrite to reflect the three-app monorepo, SaaS/entitlements,
  Stripe billing, AI gateway, AAR Studio, and the Bushie Tools suite.
- API/function references updated for the auth, organizations, AI gateway, and
  billing endpoint groups; deployment/security/auth docs refreshed with current
  env vars and Table Storage.
- Archived completed point-in-time fix/audit summaries to `docs/wiki/developer/history/archive/`.

## [1.0.0] - 2026-01-01

### Added
- Initial production release
- Member check-in/check-out system
- Activity tracking
- Event management
- Truck checks feature
- Achievement system
- Real-time synchronization via WebSockets
- QR code support
- Azure deployment configuration
- Comprehensive API testing (45 tests)

### Technical
- React 19 + TypeScript frontend
- Node.js 22 + Express 5 backend
- Socket.io for real-time updates
- Azure Table Storage database (production)
- Azure Blob Storage for images
- In-memory database (development)
