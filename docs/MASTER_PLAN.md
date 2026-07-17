# RFS Station Manager — Master Plan

**Last updated:** 2026-07-17 · **Status:** Living document — the single plan for all three apps (`backend/`, `frontend/`, `aar-studio/`) and the Bushie Tools suite.

---

## What this document is (and isn't)

- **This is the only plan.** All forward intent lives here. No other planning, roadmap, design-spike, or "future work" document may exist anywhere in the repo.
- **This document looks forward only.** Shipped work is recorded once, as a dated entry in the [changelog](wiki/developer/changelog.md), with full detail (what broke, what shipped, how it was verified). This file holds only *current status* and *what's left* — a status flip on the board below, an item in the queue. If you're looking for the story behind a ✅/done item, it's in the changelog, not here.
- **`docs/` holds exactly three things:** this plan, `docs/registers/` (machine-readable API/function registers + OpenAPI), and `docs/wiki/` (developer docs + user guide). Nothing else goes under `docs/`. See `CLAUDE.md` for the enforcement rules.

---

## Product snapshot (July 2026)

**RFS Station Manager** is a real-time digital sign-in and station-management system for NSW Rural Fire Service brigades, in production at `bungrfs-linux.azurewebsites.net` as one Azure App Service deployment containing three apps:

| App | Serves | Stack |
|---|---|---|
| `backend/` | `/api/*`, Socket.io, `/ws/agent-check` | Express 5 + TypeScript, Azure Table Storage (in-memory twin for dev/tests) |
| `frontend/` | `/` (SPA, PWA) | React 19 + Vite 7 + TypeScript |
| `aar-studio/` | `/aar` | No-build vanilla ES modules |

**Version:** v1.1 in production. Sign-in, events, member profiles, truck checks (manual + voice agent), reports/export, multi-station, AAR Studio, SaaS tenancy + Stripe billing are all live. Features are gated per-organization by plan entitlements (Community / Basic / AI Pro).

**Guiding ethos — "for the average bushie."** Design for the older, less tech-savvy firefighter as much as the young guns: plain language, minimum friction, big touch targets, "just talk / just tap" flows. If a bushie can't use it cold, it's not done.

**The launch bar (owner):** by launch this is a **rock-solid, secure, performant and reliable** platform. AAR Studio is the headline feature that sells it (shipped and working — remaining AAR tuning is polish, not a blocker). Nothing in "post-launch" may be pulled forward at the expense of getting there.

---

## Feature status board

One row per function/feature. Status: ✅ shipped & stable · 🟡 shipped with known gaps · 🔵 blocked on a decision · ⬜ not started. "Remaining" points to queue item ids below (see Next steps).

| # | Feature / function | Status | Remaining |
|---|---|---|---|
| 1 | Sign-in & check-in/out (kiosk, mobile, QR, real-time sync) | ✅ | — |
| 2 | Events & activities (create/end, participants, audit trail) | ✅ | — |
| 3 | Member profiles & achievements (QR codes, stats, 20 achievements) | ✅ | — |
| 4 | Member management (search/filter/sort, CSV import, invite/activation) | ✅ | — |
| 5 | Truck check — manual (vehicle types, locked checklists, zones/equipment, issue lifecycle, cross-brigade reporting) | ✅ | — |
| 6 | Truck check — voice agent (hold-to-talk → STT → tool loop → TTS) | 🟡 | Q3, Q4, Q12, Q13 |
| 7 | Reports & analytics (dashboard, cross-station, CSV/PDF export) | ✅ | Q11 |
| 8 | AAR Studio — THE HERO (AI-facilitated After Action Reviews) | 🟡 | Q1, Q7 |
| 9 | Multi-station (isolation, station mgmt UI, national dataset lookup, demo station) | ✅ | — |
| 10 | SaaS tenancy & entitlements (plans, gating, org onboarding) | ✅ | Q21, Q22 |
| 11 | Stripe billing (Checkout, Portal, webhooks, trial, audit trail) | 🟡 | Q5 (blocked on Stripe test-mode credentials) |
| 12 | AI gateway & metering | ✅ | — |
| 13 | Suite federation — Bushie Tools Phase 1 (SM as suite IdP, Fire Break Calculator) | ✅ | Suite ops (below), Q14/Q15 |
| 14 | PWA / offline (service worker, install prompt, offline queue) | ✅ | — |
| 15 | Auth & security (JWT + brigade tokens, `requireSession`, rate limiting, CSP/Helmet) | 🟡 | Q29 (prod verification) |
| 16 | Infra & deploy (Bicep IaC, GitHub Actions, run-from-package, smoke tests) | ✅ | D6 |
| 17 | Notifications (email/SMS) | ⬜ | Q10 |
| 18 | Documentation | 🟡 | Q6 |
| 19 | Platform-owner console (SaaS operator super-admin) | ✅ | — |

---

## Next steps

The prioritised queue. Each item keeps its historical `Q…`/`F…`/`AC…` id so cross-references from the changelog and reviews still resolve. Launch-critical work is grouped into three blocks (L1–L3); everything else is post-launch. Work top-down.

### Block L1 — Secure & private by default — ✅ done in code

Nothing reachable without a credential, least privilege everywhere, tenant data walled off from the platform operator. Closed out 2026-07-17: Q31, F1, F6, F7, AC-3, AC-4, Q29 (code portion) all shipped — see changelog for what each fixed.

- **Q29 (residual) — confirm `REQUIRE_AUTH=true` in the prod App Service settings.** Needs owner/operator Azure access this session doesn't have; the brigade-access routes are hardened either way, but other `optionalAuth` routes (e.g. `stations.ts`) still depend on this flag being correct in prod.
- ~~**Q36 — gate `GET /api/achievements/:memberId*`.**~~ **Done 2026-07-17:** added `requireSession({readsOnly:true})` to the `/api/achievements` mount in `index.ts`, matching members/checkins/events. Verified live: anonymous now 401s, a valid session still resolves normally.

### Block L2 — Rock solid & fast — ✅ done in code

No single failure takes the platform down, deploys cause no downtime, the app loads quickly with clean production output. Closed out 2026-07-17: Q30 (crash handlers), Q33, Q34, Q25, Q18, Q20, Q9 all shipped — see changelog.

- **Q30 (residual) / D6 — the two remaining items are owner spend decisions, not code.** Scaling to ≥2 App Service instances (Q30) and creating the staging slot for zero-downtime swaps (D6) — see **Open decisions** below for both.

### Block L3 — Run the business — ✅ done in code

The operator can see and manage every account without ever seeing tenant content; billing and plans are correct; onboarding data is seeded. This is what turns the platform into a business we can charge for. Closed out in code 2026-07-17: Q32, Q26, Q35 all shipped — see changelog. The four items left are owner pricing decisions or one-time production ops, not code.

- ~~**Q32 — Platform-owner console.**~~ **Done 2026-07-17:** cross-org visibility (aggregate counts only — stations/members/vehicles/AI sessions, plan/status/billing email) and management (plan/entitlements/status, membership/role, facility-claim clearing, soft-deactivate + confirm-gated hard-delete of orgs and accounts) shipped at `/api/platform` + `/admin/platform`, with every mutation audited. See changelog.
- ~~**Q26 — Org data export completeness.**~~ **Done 2026-07-17:** `GET /api/organizations/current/export` now also bundles `vehicles`, `truckCheckRuns` (capped at 5,000, newest-first), and `devices`. See changelog.
- ~~**Q35 — Backfill `organizationId` onto pre-existing stations (Q33 follow-up).**~~ **Done 2026-07-17:** manual, operator-reviewed backfill tool shipped — `GET/PATCH /api/platform/stations/orphaned|:id/organization` + an "Orphaned stations" tab in `/admin/platform`. See changelog.
- ~~**Q2 / D1 (partial) — Trial length, AI metering unit, top-up pack, AAR-in-Basic.**~~ **Decided 2026-07-17 (owner):** 14-day trial, metering unit = session (matches the existing `speech`-row counting, no new tracking needed), top-up pack stays 25 sessions / A$15, AAR Studio stays AI Pro-only (no plan change). Wired into code — see changelog. Still open: per-org vs per-station billing, grant/PO invoicing, Santa Run seasonal billing (none of these gate Q5).
- **Q5 — Metered AI overage end-to-end.** `meteredUsageReporter.ts` already maps `UsageRecord` → Stripe meter events correctly for the decided session-based unit (was built pre-Q32; just needed the unit decision confirming it). What's left is infrastructure, not code: create the actual Stripe Billing Meter (dashboard/API) matching `STRIPE_AI_METER_EVENT`, then verify an overage invoice in Stripe test mode. Needs live Stripe test-mode credentials this environment doesn't have — owner/operator action.
- **Q21 — Ops: fetch + upload the emergency-facilities dataset.** `npm run facilities:fetch` (needs internet to `services.ga.gov.au` — run from an operator machine, not CI) + `facilities:upload`, once, against prod. Until then signup's facility-claim step degrades gracefully to "my unit isn't listed."
- **Suite ops (feature #13).** Run `npm run grant:firebreak` against prod (stored entitlement snapshots predate the #638 grant) and add the FBC origin to `FRONTEND_URLS`. One-time ops, unblocks already-built wiring.

### Post-launch — iterate & expand

Improves the platform but isn't required to launch. Do not pull forward ahead of L1–L3.

- **Q1 — AAR insight-quality validation on a live debrief.** Confirm topic-vs-segment consolidation lands in the 3–8-findings sweet spot; batch with Q3.
- **Q3 / Q4 — Voice agent: iPad on-device verification, then pilot rollout.** Physical iPad run (portrait + landscape); then enable for 1–2 pilot AI-plan brigades.
- **Q6 / Q6a — Wiki content refresh; finish the emoji → Lucide sweep.** Stale dev pages + user-guide screenshots; decide per-spot on remaining emoji.
- **Q7 — Shrink the `/aar` CSP.** Blocked until AAR moves live transcription to a backend speech proxy.
- ~~**Q8 — Surface vehicle management in the truck-check roster.**~~ **Done 2026-07-17:** add/edit a vehicle directly from `/truckcheck` (an "Add Vehicle" action + a per-card edit pencil) — no more forced hop to `/truckcheck/admin` for basic CRUD. Delete/template/zones editing deliberately stay on the Admin Dashboard (more specialized, higher-risk actions). See changelog.
- **Q10 / Q23 — Notifications (email/SMS); org invite emails.** Design the provider choice (ACS vs SendGrid vs Twilio) first — shared by both consumers.
- **Q11 — Advanced analytics dashboard.** Value unproven — validate demand with pilot brigades first.
- **Q12 / Q13 — Voice agent VAD (continuous listening); A4 vision + offline agent.** Both wait on voice-agent pilot mileage.
- **Q14 / Q15 / Q16 — Suite consolidation.** Shared packages, monorepo/Turborepo, shared truck-check domain types. Depends on a commercial reason.
- **Q17 — aar-studio responsive-breakpoint convention.** Add shared breakpoint vars to `rfs-tokens.css` next time aar-studio gets sustained work.
- **Q22 / Q24 — Reconcile facility identity with Fire Santa Run; converge the two national facility parsers.** Merge when there's one concrete need for a canonical facility table.
- **Q28 — Voice check 404s in demo mode.** `/ws/agent-check` always uses production truck-check tables while demo-mode lists from Test-suffix tables. Scope decision: support demo, or hide the voice entry point when there's no station context.

---

## Open decisions

| ID | Decision | State |
|---|---|---|
| **D1** | Pricing details: trial length, AI metering unit, top-up sizes, org- vs station-level billing, grant/PO invoicing, AAR-in-Basic, Santa Run seasonal billing. *Fire Break tier provisionally settled: included in Basic + AI Pro* | 🟡 Partially resolved 2026-07-17 — trial length (14 days), metering unit (session), top-up pack (25/A$15), AAR-in-Basic (no) decided and wired into code. Still open: org- vs station-level billing, grant/PO invoicing, Santa Run seasonal billing — none block Q5 |
| **D2** | Suite auth standard: SM JWT vs Entra External ID | ✅ Resolved — keep SM JWT (kiosk brigade-token model needs it) |
| **D3** | Streaming-voice architecture | ✅ Resolved — backend proxies audio; Azure OpenAI function calling |
| **D4** | Real-time transport at scale: Socket.io vs Azure Web PubSub | 🔵 Open, not urgent — lean: *Web PubSub for Socket.IO* when multi-brigade scale needs a backplane |
| **D5** | Deploy size/time | ✅ Resolved — run-from-package cut deploy to <1 min |
| **D6** | Staging-slot pre-swap deploys — every deploy currently cuts over live onto users mid-shift. CI-side graceful slot detection already ships (#649) at zero cost; creating the actual slot needs an App Service tier upgrade (B1 → Premium P1v2+, ~cost per [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) | 🔵 Open — owner spend decision. The single biggest remaining lever on "no downtime" |
| **Q30** | Scale to ≥2 App Service instances so a crash-restart is never a total outage. B1 supports manual scale-out to 3 instances without a tier upgrade, but it's a real compute-cost increase (`infra/modules/appservice-linux.bicep`'s `sku.capacity`) | 🔵 Open — owner spend decision |

---

## Pricing & plans (reference)

The live catalog is code (`backend/src/constants/plans.ts`); this is the intended commercial shape. Full rationale: [SAAS_COMMERCIALIZATION_DESIGN](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md) §7.

| Tier | Price (AUD) | Members | Vehicles | Includes |
|---|---|---|---|---|
| **Community** (free) | $0 | up to 10 | 1 | Manual sign-in + 1 vehicle check, single station |
| **Basic** | $10/mo · $100/yr | unlimited | unlimited | Full manual suite + reports & CSV export, multiple stations, Fire Break Calculator |
| **AI Pro** | $19/mo · $190/yr | unlimited | unlimited | Basic + AAR Studio (~25 AI sessions/mo) + voice agent |
| **Bushie Suite** *(planned)* | $29/mo · $290/yr | unlimited | unlimited | AI Pro + all Bushie Tools apps (after Q14/Q15) |

Stripe AU ≈ 1.75% + $0.30; AI ≈ $0.60/AAR session; annual = 2 months free. `maxDevices` remains in the model but is deliberately unenforced (devices dropped from pricing).

---

## Risk register

| ID | Risk | P | I | Mitigation |
|---|---|---|---|---|
| R1 | Database outage affects all stations | Low | High | Azure SLA, nightly table backup (`backup:prod`), no formal DR plan yet |
| R2 | Scaling issues as adoption grows | Med | Med | Table Storage auto-scales; D4 backplane decision ready when needed |
| R3 | Data loss / corruption | Low | High | Nightly full-table export to blob storage — restore is a manual NDJSON replay; audit logs (`EventAuditLogs`) |
| R4 | Security breach / data leak | Low | High | `requireSession` read gate, entitlement gating both sides, rate limits, periodic security reviews |
| R5 | Key-person dependency | Med | Med | This plan + wiki + registers kept current (see `CLAUDE.md`) |
| R6 | Azure cost overrun | Low | Med | Cost monitoring; Table Storage chosen for cost; AI metered per session |
| R7 | Low user adoption | Med | High | "Average bushie" ethos, pilot feedback loops (Q4), station champions |
| R8 | Regressions during refactors | Med | Med | CI gates (typecheck, tests, lint), post-deploy smoke tests |
| R9 | Dependency vulnerabilities | Med | Med | Dependabot grouped PRs, security scanning |
| R10 | Rural connectivity | High | Med | PWA offline queue; A4 offline agent phase (Q13) |

---

## Where everything else lives

| Content | Location |
|---|---|
| Shipped-work history (dated entries, version log) | [`docs/wiki/developer/changelog.md`](wiki/developer/changelog.md) |
| Architecture of record | [`docs/wiki/developer/architecture.md`](wiki/developer/architecture.md) |
| Machine-readable API/function registers + OpenAPI | [`docs/registers/`](registers/) |
| Human API reference, dev guides, deployment, CI, security, testing | [`docs/wiki/developer/`](wiki/developer/README.md) |
| End-user guide | [`docs/wiki/user-guide/`](wiki/user-guide/README.md) |
| Historical design spikes, reviews, implementation notes | [`docs/wiki/developer/history/`](wiki/developer/history/) |
| AAR Studio internals | `aar-studio/docs/ARCHITECTURE.md` |
| Repo conventions for AI agents | `CLAUDE.md` |

**Maintaining this plan:** at the end of every working session — (1) add a dated entry to the wiki changelog describing what shipped, (2) update the status board and queue here: flip statuses, delete finished queue items, insert new ones in priority order. Keep this file about the future, not the past.
