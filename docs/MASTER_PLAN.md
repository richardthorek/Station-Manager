# RFS Station Manager — Master Plan

**Last updated:** 2026-07-17 (**Block L1 (Secure & private by default) fully closed out in one PR**, except Q30 which needs its own follow-up: brigade-access admin routes + manual rollover hardened with `authMiddleware`+`requireAdmin` (Q29 code portion, F6); dedicated `aiRateLimiter` added to `/api/ai/*` without breaking anonymous AAR (Q31); Socket.io `join-station` now credential-gated + broadcast payloads shape-validated (F7); AC-3 shipped — truck-check share/join (reuses the existing brigade/device-token system, no new credential type) + `AccessRoute` on all `/truckcheck*` routes; AC-4 walk-up sweep found and closed a real anonymous member-PII leak on `activities`/`checkins`/`events` (same class as F1 — conditional `flexibleAuth` with no `requireSession` backstop) and closed F1's own test-coverage follow-up (`anonymousAccessGate.test.ts` against the real mount chain, not just the bare router); found and fixed a CORS `allowedHeaders` gap (missing `X-Brigade-Token`/`X-Member-Session`) and a live demo-mode bug (Q34 — demo never resolved a station id outside kiosk mode, so every `requireSession`-gated read 401'd for anonymous demo visitors; root-caused to a second bug, `api.getDemoStation()` hitting a URL that always 404'd) along the way, both fixed and verified end-to-end in a browser. Only Q30 (crash handlers, Block L2) remains before the whole launch-runway L1 goal is met; prod `REQUIRE_AUTH=true` verification still needs operator Azure access. Also found and logged (not fixed — separate, larger scope) **Q33**: entitlement count limits (`maxVehicles`/`maxMembers`/`maxStations`) count globally instead of per-org — likely already blocking Community-tier signups from adding their first vehicle in prod); 2026-07-17 (restructured the queue into a **launch runway** — three launch blocks L1 Secure & private / L2 Rock solid & fast / L3 Run the business, plus a post-launch block — so every remaining launch item is grouped by the launch bar it serves; Q32 platform-owner console confirmed as a launch requirement in L3 with destructive-delete folded into v1 scope; F6/F7 from the security review promoted into L1); 2026-07-17 (pre-launch stability/security review — fixed an anonymous `/api/export` leak that exposed the member roster + QR check-in codes to credential-less callers (had been missed by the 2026-06-22 requireSession sweep); logged F2–F9 as owner-triaged items — new Q29–Q31, Feature #15 → 🟡; see [PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717](wiki/developer/history/reviews/PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717.md)); 2026-07-14 (blind-spot sweep — JWT_SECRET fail-fast in production + centralized, nightly Table Storage backup script, optimistic concurrency on event/member writes, owner-only org data export; found and partially fixed a real bug along the way: Table Storage silently capped event date-range queries — and therefore Reports — at the last 3 months regardless of the requested range; new Q25–Q26; reconciled against #649's graceful staging-slot CI detection, which landed in parallel — D6 updated to reflect it rather than duplicating it); 2026-07-13 (org onboarding — facility-claim signup anchored to the Digital Atlas emergency-services dataset across all service types, first-come-first-served claiming with platform claim-conflict review, multi-use org invite links, multi-org membership with per-org roles and `POST /api/auth/switch-org`; Organizations table now populates so `grant:firebreak` has orgs to act on; new Q21–Q23); 2026-07-12 (#644 — marketing-page live demo showcase; pre-launch perf sweep: /login chunk −372 KB, PWA precache 8.6→1.4 MB, immutable asset caching; truck-check workflow re-skin; AAR live waveform + capture.js smart-quote parse hotfix; new Q18–Q20); 2026-07-12 (#639 — truck check onboarding wizard: post-signup flow collects jurisdiction, agency/organisation, and vehicle types from 20+ standards; creates initial appliances; integrated into signup; completed); 2026-07-11 (#620 — vehicle type templates: 20 pre-provisioned standards across NSW RFS, Fire & Rescue NSW, NSW SES, Marine Rescue NSW, and Generic; seeded idempotently; built-in protection via 403 on edit/delete; completed); 2026-07-10 (#617 — truck-check result-save 400 fixed (blank item description), vehicle roster with cancel/finalise for stuck runs, new `DELETE /api/truck-checks/runs/:id`; partially addresses Q8); 2026-07-06 (AC-2 shipped — ephemeral visitor sign-ins; sign-in book responsive audit — fixed profile-hero mobile stacking + event-tab/New-Event phone collision; AC-1 shipped — personal member link mints a station-scoped read session; AC-5 shipped — first-class Device accounts; sign-in book gated behind a brigade code / account / member-session / demo; Q5 shipped — cross-brigade comparative truck-check reporting)
**Status:** Living document — **the single plan** for all three apps (`backend/`, `frontend/`, `aar-studio/`) and the Bushie Tools suite.

---

## What this document is (and isn't)

- **This is the only plan.** All planning and forward intent lives here. No other planning, roadmap, design-spike, or "future work" document may exist anywhere in the repo. To capture future work or a change of direction, edit this file.
- **This document looks forward.** Shipped work is recorded once — as a dated entry in the [changelog](wiki/developer/changelog.md) — and then only its *consequence* stays here (a status flip on the board below, an item removed from the queue). Do not accumulate per-session shipping narratives in this file.
- **The `docs/` folder holds exactly three things:**
  1. `docs/MASTER_PLAN.md` — this plan.
  2. `docs/registers/` — the machine-readable technical registers describing the backend (`api_register.json`, `function_register.json`, `openapi.yaml`).
  3. `docs/wiki/` — wiki-style documentation: `wiki/developer/` (architecture, guides, changelog, historical reference) and `wiki/user-guide/` (the end-user guide).

  Nothing else goes under `docs/`. See `CLAUDE.md` for the enforcement rules.

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

---

## Feature status board

One row per function/feature of the product. Status: ✅ shipped & stable · 🟡 shipped with known gaps · 🔵 blocked on a decision · ⬜ not started. "Remaining" points into the launch runway below (blocks L1–L3 + post-launch).

| # | Feature / function | Status | Remaining |
|---|---|---|---|
| 1 | **Sign-in & check-in/out** (kiosk, mobile, QR, real-time sync) | ✅ | Access rework complete: AC-1 personal-link credential, AC-2 visitor sign-ins, AC-3 truck-check share/join + `/truckcheck` gating, AC-4 walk-up sweep (found + closed a `checkins`/`events` anonymous-PII gap), AC-5 device accounts all shipped; minor perf polish (Q9) |
| 2 | **Events & activities** (create/end events, participants, audit trail) | ✅ | — |
| 3 | **Member profiles & achievements** (QR codes, stats, 20 achievements) | ✅ | — |
| 4 | **Member management** (search/filter/sort, CSV import, invite/activation) | ✅ | — |
| 5 | **Truck check — manual** (vehicle types, locked standard checklists, zones/equipment, issue lifecycle, member attribution, cross-brigade comparative reporting) | ✅ | Vehicle mgmt surfacing (Q8) |
| 6 | **Truck check — voice agent (A3)** (hold-to-talk PWA → server-side STT → tool loop → TTS; hardened per F1–F16 review) | 🟡 | iPad on-device verification (Q3); pilot rollout (Q4); VAD/continuous listening (Q12); vision + offline = A4 (Q13) |
| 7 | **Reports & analytics** (dashboard, cross-station, CSV/PDF export) | ✅ | Advanced analytics dashboard #123 (Q11); date-range report queries were silently capped at ~3 months on Table Storage — fixed 2026-07-14 for attendance/participation/activity reports; deeper events-list pagination still capped (Q25) |
| 8 | **AAR Studio — THE HERO** (AI-facilitated After Action Reviews, cloud sync, collab notes, dedupe/merge) | 🟡 | Hero-polish batch + insight-quality/session-clarity rework + the whole AAR review remaining batch shipped per [AAR review](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md); remaining: live-validate consolidation quality (Q1), iPad print verify (Q3), CSP shrink (Q7) |
| 9 | **Multi-station** (isolation, station mgmt UI, national RFS dataset lookup, demo station) | ✅ | Migration scripts deferred until a real multi-brigade migration needs one |
| 10 | **SaaS tenancy & entitlements** (Organization, plans, `requireFeature` both-sides gating, limits, org onboarding: facility-claim signup, invite links, multi-org membership, platform claim-conflict review) | ✅ | `maxDevices` unenforced by design (devices dropped from pricing); facility snapshot fetch is a manual ops step (Q21); reconcile facility identity with Fire Santa Run (Q22); owner-only data export (`GET .../export`) shipped 2026-07-14 — event coverage inherits the Q25 cap, truck-check/device data not yet included (Q26) |
| 11 | **Stripe billing** (Checkout, Portal, webhooks, trial, audit trail, AI top-up packs) | 🟡 | Metered overage needs a Stripe meter + D1 pricing decisions (Q5); device accounts shipped (AC-5) but unmetered — `maxDevices` still unenforced per #574 |
| 12 | **AI gateway & metering** (`/api/ai/*`, server-side keys, session allowance) | ✅ | Anthropic adapter is a stub (fine until needed) |
| 13 | **Suite federation — Bushie Tools Phase 1** (SM JWT as suite IdP, `/api/auth/entitlements`, app launcher; `fireBreakEnabled` granted on Basic + AI Pro — Fire Break Calculator cloud saved plans authenticate against SM) | ✅ | Run `npm run facilities:fetch`+`facilities:upload` (seeds the signup facility dataset — from an operator machine, needs internet access to services.ga.gov.au) then `grant:firebreak` backfill after deploy (now meaningful — orgs actually exist); add the FBC origin to `FRONTEND_URLS`; Phases 2–3: shared packages, monorepo (Q14, Q15) |
| 14 | **PWA / offline** (service worker, install prompt, offline queue) | ✅ | Double SW-registration log (Q9); deeper offline is part of A4 |
| 15 | **Auth & security** (JWT + brigade tokens + demo bypass, `requireSession` read gate, rate limiting, CSP/Helmet) | 🟡 | Pre-launch review 2026-07-17 ([PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717](wiki/developer/history/reviews/PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717.md)): anonymous `/api/export` leak **fixed** (F1); brigade-access admin routes hardened + manual rollover authenticated **fixed** (Q29 code fix, F6 — prod `REQUIRE_AUTH=true` still needs owner verification); `/api/ai/*` gated with a dedicated tight rate limiter **fixed** (Q31); Socket.io `join-station` credential-gated + broadcast payload validation **fixed** (F7); CORS `allowedHeaders` was missing `X-Brigade-Token`/`X-Member-Session` (breaks cross-origin kiosk/member-session callers) **fixed**; `activities`/`checkins`/`events` anonymous member-PII gap found + closed, F1 test-coverage follow-up closed (AC-4). **Block L1 (Secure & private) is now fully done** except Q30 (process-level crash handlers — F3) |
| 16 | **Infra & deploy** (Bicep IaC, GitHub Actions → Linux App Service, run-from-package, post-deploy smoke tests) | ✅ | OIDC bootstrap documented; watch item only. Nightly Table Storage backup shipped 2026-07-14 (`backup:prod` + `nightly-backup.yml` — needs the `AZURE_STORAGE_CONNECTION_STRING` repo secret set once). Staging-slot deploys: CI-side graceful detection shipped 2026-07-13 (#649, [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) — deploys to `staging` and swaps if a slot exists, falls back to Production (today's behaviour) if not, at zero cost either way. Actually creating the slot still needs an App Service tier upgrade (D6) |
| 17 | **Notifications (email/SMS)** #120 | ⬜ | Not started (Q10) |
| 18 | **Documentation** (this restructure: plan + registers + wiki) | 🟡 | User-guide screenshots; content refresh of migrated dev pages (Q6) |
| 19 | **Platform-owner console** (SaaS operator super-admin: cross-org visibility + management, tenant-data privacy wall) | ⬜ | **Launch requirement** — not started (Q32). Extends existing platform-admin plumbing. Owner sees users/orgs/subscriptions + aggregate usage and can manage account structure (org membership, plan/status, roles) but never reads tenant content |

---

## The launch runway

The single ordered plan to launch. **All remaining launch work is grouped into three blocks (L1–L3); everything beyond launch is the post-launch block.** Work the launch blocks top-down. Each item keeps its historical `Q…`/`F…`/`AC…` id so cross-references from the changelog and reviews still resolve.

> **The launch bar (owner, 2026-07-17):** by launch this is a **rock-solid, secure, performant and reliable** platform. Blocks L1 and L2 exist to meet that bar; L3 makes it a business we can actually run and charge for. Nothing in "post-launch" may be pulled forward at the expense of L1–L3.

> **Product note — the hero still sells it.** AAR Studio remains the headline feature (hero directive 2026-07-03; AAR-1…AAR-24 in the [AAR review](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md)). It is shipped and working; the remaining AAR *tuning* (Q1, Q7) is polish, not a launch blocker.

> **Access & membership model (owner, 2026-07-04).** The walk-up apps (sign-in, truck check) are reachable only with a legitimate credential — a brigade device code, a member's personal link, or the public demo — never a bare URL. *Managing* a brigade (members, links/QR, reports) always needs a signed-in account (free within the Community ≤10-member limit, or paid). Visitors can always sign in but get no history and never count toward `maxMembers`. **Fully shipped 2026-07-17:** `AccessRoute` on `/signin` and `/truckcheck`, **AC-1** personal-link session, **AC-2** visitor sign-ins, **AC-3** truck-check share/join + gating, **AC-4** walk-up consistency sweep, **AC-5** first-class device accounts (see changelog).

---

### Block L1 — Secure & private by default

*Goal: nothing is reachable without a credential, every actor has least privilege, and tenant data is walled off — including from the platform operator. This block is the security gate on launch.*

- ~~**Q29 — Verify `REQUIRE_AUTH=true` in prod + harden the brigade-access admin routes (review F5).**~~ **Code fix done 2026-07-17:** `POST /api/brigade-access/generate`, `DELETE /:token`, `GET /all-tokens`, `/stats`, `/brigade/:brigadeId`, `/station/:stationId` now require `authMiddleware`+`requireAdmin` unconditionally — no longer dependent on `REQUIRE_AUTH`. **Still open:** confirming `REQUIRE_AUTH=true` in the prod App Service settings — needs owner/operator Azure access this session didn't have. Now lower-stakes for brigade-access specifically (the routes are hardened either way), but other `optionalAuth` routes (e.g. `stations.ts`) still depend on that flag being correct.
- ~~**Q31 — Gate/limit `/api/ai/*` (review F4).**~~ **Done 2026-07-17:** added a dedicated `aiRateLimiter` (30 req / 5 min per IP, vs. the general `apiRateLimiter`'s 84) on the whole `/api/ai` mount, replacing the generic limiter there. Deliberately did **not** require a session — AAR Studio is intentionally local-first/usable signed-out (A2), so requiring auth here would break that product feature rather than just close a gap; the review offered the tighter-limiter option as an alternative for exactly this reason. The full anonymous-AAR identity story stays a separate, larger decision (A2 already closed the sync/roster increments; nothing further queued there today).
- ~~**F6 — Authenticate the manual rollover endpoint (review F6).**~~ **Done 2026-07-17:** `POST /api/events/admin/rollover` now requires `authMiddleware`+`requireAdmin`.
- ~~**F7 — Authenticate + validate Socket.io events (review F7).**~~ **Done 2026-07-17:** `join-station` now requires the same credential model `requireSession`/`flexibleAuth` enforce on REST reads (admin JWT any role → any station; brigade/kiosk or member-session token → only its own station; public demo station stays open). The six broadcast events (`checkin`, `activity-change`, `member-added`, `event-created/ended`, `participant-change`) now validate the payload is a plain object under a 32KB cap before rebroadcasting. Extracted into `services/stationSocketHandlers.ts` (mirroring the existing `aarCollab.ts` pattern) for testability; `frontend/src/hooks/useSocket.ts` now sends whichever credential the device holds on `join-station`.
- ~~**AC-3 — Truck-check join model, then gate `/truckcheck`.**~~ **Done 2026-07-17:** the "start a check" half already existed (`POST /runs` auto-joins an active run for the same appliance — the multi-contributor model was already built). Added the missing "share" half: a **Share this check** action on the active check workflow reuses the existing brigade/device-token system exactly as a kiosk sign-in link does (`generateKioskUrl()` if already in kiosk mode, else mints a fresh short-lived station-scoped token via `POST /api/brigade-access/generate`) to build a `/truckcheck/check/:applianceId?brigade=<token>` QR/link — no new backend credential type needed. All 9 `/truckcheck*` routes now wrapped in `AccessRoute` (same discipline as `/signin`). Verified end-to-end in a browser: bare `/truckcheck` redirects home; a generated share link opens correctly on a fresh, fully logged-out browser context and lands on the right vehicle's check page.
- ~~**AC-4 — Walk-up consistency sweep.**~~ **Done 2026-07-17:** audited every `/api/*` mount in `index.ts` against its actual internal auth (not just its `requireFeature`), following F1's lesson that `requireFeature` alone never blocks anonymous callers. Found `activities`/`checkins`/`events` relied solely on `flexibleAuth`, which — like `REQUIRE_AUTH` (Q29) — only enforces auth when the `ENABLE_DATA_PROTECTION` env var is explicitly `true`; unlike `members`/`truck-checks`/`reports`/`export`, they had no unconditional `requireSession` backstop. `checkins`/`events` return real member names, ranks, check-in timestamps and location (`EventParticipant`/`CheckIn`) — the same class of anonymous PII leak F1 closed elsewhere, just not caught by that sweep. **Fixed:** added `requireSession({readsOnly:true})` to all three mounts, matching the established pattern (writes keep their kiosk pass-through). `organizations`/`billing`/`platform`/`agent-sessions` were already unconditionally gated; `stations`/`facilities`/`org-invites` are intentionally public (signup/kiosk-selection flows, low-sensitivity data). Closed the still-open F1 follow-up along the way: added `anonymousAccessGate.test.ts`, replicating the real mount chain (not just the bare router, which is why F1 sat undetected) for all 7 `requireSession`-gated mounts.
- *Done (PR #664, 2026-07-17):* **F1 — anonymous `/api/export` leak closed** with `requireSession({ readsOnly:true })`; it had exposed the full member roster incl. QR check-in codes. Follow-up in this block: add an integration test asserting `401` for an anonymous non-demo request against the fully-wired app (the router-only export tests never covered the gate — which is why F1 sat silent). Applies to reports/members too.

### Block L2 — Rock solid & fast

*Goal: no single failure takes the platform down, deploys cause no downtime, and the app loads quickly with clean production output. This block is the reliability/performance gate on launch.*

- **Q30 — Process-level crash handlers + run ≥2 instances (review F3).** No `process.on('unhandledRejection'|'uncaughtException')` exists; a single un-awaited rejection in an async socket/route handler can crash the one App Service instance = full outage. Add handlers that log via `logger.error` + flush App Insights (exit cleanly on `uncaughtException` so the platform restarts a known-good process), and scale to **≥2 instances** so a restart is never a total outage. Pairs with D6.
- **Q33 — `enforceMemberLimit`/`enforceVehicleLimit`/`enforceStationLimit` count *globally*, not per-org (found 2026-07-17 while verifying AC-3).** `middleware/entitlements.ts` calls `db.getAllMembers()`/`db.getAllAppliances()` with no arguments and `db.getAllStations()` filtered only to exclude the demo/default station ids — none of the three scope the count to the calling organisation, even though `getAllMembers`/`getAllAppliances` already accept an optional `stationId` filter that just isn't passed. **Practical impact, reproduced locally:** a brand-new Community-plan org (`maxVehicles: 1`) got `403 Vehicle limit reached… current: 5` on its *first* appliance — the demo station's own seeded fleet alone exceeds the limit, so every Community org's vehicle quota is effectively shared platform-wide, not per-tenant. The same shape of bug applies to `maxMembers` and `maxStations`. **Fix:** scope each count to the org's own station(s) (or org id once available on the row) before comparing to the limit. High priority — likely already blocking real Community-tier signups from adding their first vehicle/member in production.
- ~~**Q34 — Demo mode never sets a station id outside kiosk mode, so `requireSession`-gated reads 401 for anonymous demo visitors (found 2026-07-17 while verifying AC-3).**~~ **Done 2026-07-17:** `StationContext.tsx`'s "normal mode" branch now explicitly resolves to `DEMO_STATION_ID` (fetching the real `Station` via `api.getDemoStation()`) when `isDemoActive()` and not signed in, instead of always nulling out the station. Also found and fixed a second bug this depended on: `api.getDemoStation()` called `GET /stations/demo`, which `GET /stations/:id` treats as a literal (non-existent) id — always 404'd, so the method had never actually worked; fixed to `GET /stations/demo-station`. Verified end-to-end in a browser: `/signin` and `/truckcheck` both now correctly show an empty state for the (empty) demo station instead of 401ing.
- **D6 / F2 — Zero-downtime deploys: create the staging slot and swap (owner decision + spend).** Today every deploy pushes onto the live app and `az webapp restart`s it — a 2–3 min outage that drops all Socket.io connections, with smoke tests running *after* bad code is already live. CI-side slot detection already ships (#649): it deploys to `staging` and swaps **if a slot exists**. The only remaining action is the **App Service tier upgrade** (B1 → Premium P1v2+, ~cost per [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) to create the slot, plus wiring `/health` as the Azure health-check path so the swap is gated on readiness. **This is the single biggest lever on the "no downtime" requirement — decide the spend.**
- **Q25 — Table Storage: fix the hardcoded 3-month event window (found 2026-07-14).** `getEvents()`/`getEventsWithParticipants()` hardcode a "last 3 calendar months" scan regardless of `limit`/`offset`, so the events-list UI's deep pagination and the org data export (Q26) silently return nothing for older history in prod. Fix: paginate backward through month partitions until `limit` is satisfied, or maintain an "oldest event month" index to bound the scan. (`getEventsByDateRange`, used by Reports, was already fixed.)
- **Q18 — Strip debug `console.log` from production bundles.** ~31 `console.log` sites ship in the frontend (kiosk consoles fill with socket-join chatter). Vite 8 is Rolldown-based, so the old `esbuild.pure` route doesn't apply — configure the oxc minifier's drop options (verify against Vite 8 docs) or move the sites onto a debug-gated logger. Keep `console.warn`/`console.error`.
- **Q20 — Split the 1.5 MB `vendor-export` chunk per format.** `exceljs` + `jspdf` + `html2canvas` + `papaparse` travel as one chunk, so a CSV export downloads the PDF/Excel engines too. Already lazy behind `exportUtils.lazy` and out of the SW precache (#644), so impact is first-export only — split per-format when next touching export code.
- **Q9 — Frontend polish batch.** Known minor UAT leftovers: double service-worker registration log; `/profile/:memberId` settles in 3.5–5s vs near-instant elsewhere.
- **F8 — Clear the moderate npm advisories (review F8).** 30 moderate, all transitive via Application Insights (`@opentelemetry/*`, `protobufjs` GHSA-f38q-mgvj-vph7); frontend clean. Run the non-breaking `npm audit fix`; let Dependabot (R9) carry the OpenTelemetry bumps.
- **F9 — Hygiene (review F9).** Remove the dead `web.config` (IIS/Windows config shipped into a Linux App Service — ignored, and its `webSocket enabled="false"` would break Socket.io if ever run on Windows) and correct the stale "Windows/IIS" framing in `ci-cd.yml`'s header comments.

### Block L3 — Run the business

*Goal: the operator can see and manage every account (without ever seeing tenant content), billing and plans are correct, and onboarding data is seeded. This block turns the platform into a business we can charge for.*

- **Q32 — Platform-owner console (LAUNCH REQUIREMENT, owner 2026-07-17).** The SaaS operator's super-admin surface: one platform-owner account (mine), granted solely via the `PLATFORM_ADMIN_USERNAMES` allowlist (never an assignable org role). Extends the existing platform-admin plumbing — `requirePlatformAdmin` (`middleware/platformAdmin.ts`), the `/api/platform` router (today only claim-conflict review), the `isPlatformAdmin` flag on `/api/auth/me`, and the `/admin/platform` page.
  - **Visibility:** across all organisations — who the users are, which orgs each user owns/belongs to and in what role, each org's subscription plan + status + billing email, and **aggregate** usage stats (active orgs, member/vehicle/station counts per org, AI sessions used vs allowance, sign-in volume, last-active).
  - **Management (write) — v1 scope confirmed by owner 2026-07-17:** (1) add/remove a user's membership of an organisation and set their role; (2) change an org's plan/entitlements and status (activate/suspend/cancel); (3) reassign or clear a facility claim; (4) **destructive delete of organisations and user accounts is in scope** — implement it with a confirmation step + audit trail, and prefer soft-deactivate as the default action with hard-delete as an explicit, separately-confirmed operation. Every mutation goes through dedicated `/api/platform` endpoints gated by `requirePlatformAdmin`, operates on the org-access/admin-user/organization stores (**both DB twins**), emits an audit row, and reuses the existing membership/entitlement services so tenancy invariants hold.
  - **Hard privacy wall (non-negotiable, the defining requirement):** the platform owner must **never** read a tenant's operational data — member PII (names, ranks, member numbers, QR codes), sign-in/check-in records, truck-check results, event/AAR content, exports. The console exposes **only** account metadata + derived aggregate counts (the Stripe-dashboard model). Enforce structurally: dedicated read-only aggregate endpoints that compute rollups server-side and cannot return row-level tenant records; do **not** reuse or widen the tenant data routes for the platform view. Management writes touch account/structure records only, never operational rows.
  - **Design notes:** (a) aggregate stats on tiny orgs are re-identifying — keep to counts and plan/usage shape, no per-member breakdowns. (b) Audit every platform-owner action (who viewed/changed/deleted which account, when) — writes and deletes especially. (c) A visible "even we can't see your brigade's data" trust boundary is a selling point.
- **Q2 / D1 — Pricing decisions (owner).** Confirm trial length (14 vs 30 days, AI included?), AI metering unit (session vs audio-minute; AAR-11 explains why per-vend is wrong), top-up pack size/price, per-org vs per-station billing for district orgs, grant/PO invoicing, AAR-in-Basic?. *Decision, not code — blocks Q5.*
- **Q5 — Metered AI overage end-to-end.** `meteredUsageReporter.ts` is a safe no-op until a Stripe meter exists. After Q2: create the meter, map `UsageRecord` → meter events, verify an overage invoice in test mode. Include the AAR-11 session-vs-vend fix.
- **Q21 — Ops: fetch + upload the emergency-facilities dataset.** Signup's facility-claim step degrades gracefully (503 → "my unit isn't listed") until `npm run facilities:fetch` (needs internet to `services.ga.gov.au` — run from an operator machine, not CI) + `facilities:upload` have run once against prod. One-time ops step.
- **Q26 — Org data export completeness.** `GET /api/organizations/current/export` currently bundles org/stations/members/events only. Extend to truck-check history and device records **once Q25 is resolved** (event coverage inherits the Q25 cap, documented in the response's `limitations` field).
- **Suite ops (feature #13).** Run `npm run grant:firebreak` against prod (stored entitlement snapshots predate the #638 grant — why the Fire Break launcher shows locked) and add the FBC origin to the App Service `FRONTEND_URLS`. One-time ops, unblocks the already-built suite wiring.

---

### Post-launch — iterate & expand

*Everything that improves the platform but isn't required to launch safely. Do not pull forward ahead of L1–L3.*

- **Q1 — AAR insight-quality validation on a live debrief.** Confirm the topic-vs-segment consolidation lands in the 3–8-findings sweet spot; tune the prompt if not. Needs a real debrief; batch with Q3's on-device session.
- **Q3 / Q4 — Voice agent: iPad on-device verification, then pilot rollout.** Run a full voice check on a physical iPad (portrait + landscape, screenshots), log device breakage; then enable for 1–2 pilot AI-plan brigades for feedback. Hardening (F1–F16) is done.
- **Q6 / Q6a — Wiki content refresh; finish the emoji → Lucide sweep (#618).** Refresh stale dev pages (deployment/ci-pipeline pre-Linux framing) + add user-guide screenshots; decide per-spot whether remaining emoji (achievement badges, activity tags, several admin modals) map to Lucide or stay.
- **Q7 — Shrink the `/aar` CSP.** Blocked until AAR moves live transcription to a backend speech proxy (`agentSpeech.ts` pattern); today it needs the Azure Speech browser-direct hosts.
- **Q8 — Surface vehicle management in the truck-check roster.** Fold add/edit/delete vehicle CRUD into the `/truckcheck` roster so it isn't admin-only; reduce duplication between roster, VehicleManagement, and VehicleTypes/Template screens.
- **Q10 — Notifications (email/SMS) #120; Q23 — org invite emails.** Design the provider choice (ACS vs SendGrid vs Twilio) first; the truck-check issue lifecycle (`assignedTo`) and copy-paste-only invite links are the first consumers, sharing one provider.
- **Q11 — Advanced analytics dashboard #123.** Value unproven — validate demand with pilot brigades first.
- **Q12 — Voice agent continuous listening (VAD); Q13 — A4 vision + offline agent.** Swap push-to-talk for VAD; camera-frame visual diff against `referencePhotoUrl` + on-device speech for offline sheds. Both wait on voice-agent pilot mileage.
- **Q14 / Q15 / Q16 — Suite consolidation.** Shared packages (`@rfs/ui`/`@rfs/types`/`@rfs/auth-sdk`, #557), monorepo/Turborepo with FBC embedded (#558), and shared truck-check domain types. Depends on a commercial reason.
- **Q17 — aar-studio responsive-breakpoint convention.** Add shared breakpoint vars to `rfs-tokens.css` next time aar-studio gets sustained work (per RESPONSIVE_UI_REVIEW_20260704 UI-3).
- **Q22 — Reconcile facility identity with Fire Santa Run; Q24 — converge `facilitiesParser.ts` with `rfsFacilitiesParser.ts`.** Both apps claim against the same Digital Atlas dataset but nothing links `Organization.facilityObjectId` to Santa Run's `Brigade.rfsStationId`; and the two national parsers load in parallel. Merge when there's one concrete need for a canonical facility table.
- **Q28 — Voice check 404s in demo mode (found 2026-07-16).** The `/ws/agent-check` stack always uses the production truck-check tables while a demo-mode client lists appliances from the Test-suffix tables, so demo voice-check 404s. Scope decision: support demo (thread a demo indicator through the WS, use the demo DB in `AgentToolExecutor`) or hide the voice entry point when there's no station context and document the 404.

---

## Open decisions

| ID | Decision | State |
|---|---|---|
| **D1** | Pricing details: trial length, AI metering unit, top-up sizes, org- vs station-level billing, grant/PO invoicing, AAR-in-Basic?, Santa Run seasonal billing. *Fire Break tier placement provisionally settled 2026-07-12: included in Basic + AI Pro (`fireBreakEnabled`); revisit if a dedicated Bushie Suite tier lands (Q14/Q15)* | 🔵 **Open — owner.** Blocks Q5; see Q2 |
| **D2** | Suite auth standard: SM JWT vs Entra External ID | ✅ Resolved — keep SM JWT (kiosk brigade-token model needs it). Revisit only if cross-origin SSO becomes real (Q14) |
| **D3** | Streaming-voice architecture | ✅ Resolved 2026-06-29 — backend proxies audio; Azure OpenAI function calling; same App Service, 30-s WS pings |
| **D4** | Real-time transport at scale: Socket.io vs Azure Web PubSub | 🔵 Open, not urgent — current lean: adopt *Web PubSub for Socket.IO* (keeps code) when multi-brigade scale needs a backplane |
| **D5** | Deploy size/time | ✅ Resolved 2026-06-22 — run-from-package cut the deploy step from ~8 min to <1 min |
| **D6** | Staging-slot pre-swap deploys — every deploy currently cuts over live onto users mid-shift, dropping open Socket.io connections and running post-deploy smoke tests only *after* the bad code is already live. Whether to actually create the slot (requires an App Service Plan tier upgrade) | 🔵 **Open — owner.** CI-side graceful slot detection shipped 2026-07-13 (#649) at zero cost — it deploys to `staging` and swaps if a slot exists, otherwise falls back to today's direct-to-Production behaviour. Creating the slot itself still needs a tier upgrade (B1 ~$13/mo → Premium P1v2+, per [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) — owner has not yet decided to spend that. Revisit if a bad deploy causes a real production incident, or the cost becomes easier to justify at higher revenue. **Now a launch item (Block L2) per the launch bar — the tier-upgrade spend is the last thing between the current pipeline and the "no downtime" requirement.** |

---

## Pricing & plans (reference)

The live catalog is code (`backend/src/constants/plans.ts`); this is the intended commercial shape. Full rationale: [SAAS_COMMERCIALIZATION_DESIGN](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md) §7.

| Tier | Price (AUD) | Members | Vehicles | Includes |
|---|---|---|---|---|
| **Community** (free) | $0 | up to 10 | 1 | Manual sign-in + 1 vehicle check, single station |
| **Basic** | $10/mo · $100/yr | unlimited | unlimited | Full manual suite + reports & CSV export, multiple stations, Fire Break Calculator (cloud saved plans) |
| **AI Pro** | $19/mo · $190/yr | unlimited | unlimited | Basic + AAR Studio (~25 AI sessions/mo) + voice agent |
| **Bushie Suite** *(planned)* | $29/mo · $290/yr | unlimited | unlimited | AI Pro + all Bushie Tools apps (after Q14/Q15) |

Stripe AU ≈ 1.75% + $0.30; AI ≈ $0.60/AAR session; annual = 2 months free. `maxDevices` remains in the model but is deliberately unenforced (devices dropped from pricing in #574).

---

## Risk register

| ID | Risk | P | I | Mitigation |
|---|---|---|---|---|
| R1 | Database outage affects all stations | Low | High | Azure SLA, nightly table backup (2026-07-14, `backup:prod`), no formal DR plan yet |
| R2 | Scaling issues as adoption grows | Med | Med | Table Storage auto-scales; D4 backplane decision ready when needed |
| R3 | Data loss / corruption | Low | High | Nightly full-table export to blob storage (2026-07-14) — restore is a manual replay from the NDJSON backup; Table Storage itself has no native point-in-time restore. Audit logs (`EventAuditLogs`) |
| R4 | Security breach / data leak | Low | High | `requireSession` read gate, entitlement gating both sides, rate limits, periodic reviews (last: pre-launch stability/security review 2026-07-17 — closed an anonymous `/api/export` roster/QR-code leak; open items Q29–Q31). Prior: A3 F1–F16, 2026-07 |
| R5 | Key-person dependency | Med | Med | This plan + wiki + registers kept current (see CLAUDE.md rules) |
| R6 | Azure cost overrun | Low | Med | Cost monitoring; Table Storage chosen for cost; AI metered per session |
| R7 | Low user adoption | Med | High | "Average bushie" ethos, pilot feedback loops (Q4), station champions |
| R8 | Regressions during refactors | Med | Med | CI gates (typecheck, tests, lint, coverage), post-deploy smoke tests |
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

**Maintaining this plan:** at the end of every working session, (1) add a dated entry to the wiki changelog describing what shipped, (2) update the status board and queue here — flip statuses, delete finished queue items, insert new ones in priority order. Keep this file about the future.
