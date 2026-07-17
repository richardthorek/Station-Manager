# RFS Station Manager — Master Plan

**Last updated:** 2026-07-17 (pre-launch stability/security review — fixed an anonymous `/api/export` leak that exposed the member roster + QR check-in codes to credential-less callers (had been missed by the 2026-06-22 requireSession sweep); logged F2–F9 as owner-triaged items — new Q29–Q31, Feature #15 → 🟡; see [PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717](wiki/developer/history/reviews/PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717.md)); 2026-07-14 (blind-spot sweep — JWT_SECRET fail-fast in production + centralized, nightly Table Storage backup script, optimistic concurrency on event/member writes, owner-only org data export; found and partially fixed a real bug along the way: Table Storage silently capped event date-range queries — and therefore Reports — at the last 3 months regardless of the requested range; new Q25–Q26; reconciled against #649's graceful staging-slot CI detection, which landed in parallel — D6 updated to reflect it rather than duplicating it); 2026-07-13 (org onboarding — facility-claim signup anchored to the Digital Atlas emergency-services dataset across all service types, first-come-first-served claiming with platform claim-conflict review, multi-use org invite links, multi-org membership with per-org roles and `POST /api/auth/switch-org`; Organizations table now populates so `grant:firebreak` has orgs to act on; new Q21–Q23); 2026-07-12 (#644 — marketing-page live demo showcase; pre-launch perf sweep: /login chunk −372 KB, PWA precache 8.6→1.4 MB, immutable asset caching; truck-check workflow re-skin; AAR live waveform + capture.js smart-quote parse hotfix; new Q18–Q20); 2026-07-12 (#639 — truck check onboarding wizard: post-signup flow collects jurisdiction, agency/organisation, and vehicle types from 20+ standards; creates initial appliances; integrated into signup; completed); 2026-07-11 (#620 — vehicle type templates: 20 pre-provisioned standards across NSW RFS, Fire & Rescue NSW, NSW SES, Marine Rescue NSW, and Generic; seeded idempotently; built-in protection via 403 on edit/delete; completed); 2026-07-10 (#617 — truck-check result-save 400 fixed (blank item description), vehicle roster with cancel/finalise for stuck runs, new `DELETE /api/truck-checks/runs/:id`; partially addresses Q8); 2026-07-06 (AC-2 shipped — ephemeral visitor sign-ins; sign-in book responsive audit — fixed profile-hero mobile stacking + event-tab/New-Event phone collision; AC-1 shipped — personal member link mints a station-scoped read session; AC-5 shipped — first-class Device accounts; sign-in book gated behind a brigade code / account / member-session / demo; Q5 shipped — cross-brigade comparative truck-check reporting)
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

One row per function/feature of the product. Status: ✅ shipped & stable · 🟡 shipped with known gaps · 🔵 blocked on a decision · ⬜ not started. "Remaining" points into the queue below.

| # | Feature / function | Status | Remaining |
|---|---|---|---|
| 1 | **Sign-in & check-in/out** (kiosk, mobile, QR, real-time sync) | ✅ | Access rework in progress (AC-3, AC-4 below; AC-1 personal-link credential + AC-2 visitor sign-ins + AC-5 device accounts shipped); minor perf polish (Q9) |
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
| 15 | **Auth & security** (JWT + brigade tokens + demo bypass, `requireSession` read gate, rate limiting, CSP/Helmet) | 🟡 | Pre-launch review 2026-07-17 ([PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717](wiki/developer/history/reviews/PRE_LAUNCH_STABILITY_SECURITY_REVIEW_20260717.md)): anonymous `/api/export` leak **fixed** (F1); remaining Q29 (verify `REQUIRE_AUTH=true` in prod / harden brigade-access admin routes — F5), Q30 (process-level crash handlers — F3), Q31 (gate/limit `/api/ai/*` — F4); plus lower-priority F6/F7 (rollover auth, socket payload validation) |
| 16 | **Infra & deploy** (Bicep IaC, GitHub Actions → Linux App Service, run-from-package, post-deploy smoke tests) | ✅ | OIDC bootstrap documented; watch item only. Nightly Table Storage backup shipped 2026-07-14 (`backup:prod` + `nightly-backup.yml` — needs the `AZURE_STORAGE_CONNECTION_STRING` repo secret set once). Staging-slot deploys: CI-side graceful detection shipped 2026-07-13 (#649, [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) — deploys to `staging` and swaps if a slot exists, falls back to Production (today's behaviour) if not, at zero cost either way. Actually creating the slot still needs an App Service tier upgrade (D6) |
| 17 | **Notifications (email/SMS)** #120 | ⬜ | Not started (Q10) |
| 18 | **Documentation** (this restructure: plan + registers + wiki) | 🟡 | User-guide screenshots; content refresh of migrated dev pages (Q6) |

---

## Prioritised next steps (the queue)

The single ordered work queue across every track. Work top-down; re-order here when priorities change. Each item says why it's ranked where it is.

> **Hero directive (owner, 2026-07-03):** AAR Studio is the headline feature —
> it is what sells the app. The AAR hero-review findings
> ([AAR_STUDIO_REVIEW_20260703](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md),
> AAR-1…AAR-24 with a full implementation ranking) therefore lead this queue.

### Access & membership rework (owner, 2026-07-04) — in progress

The agreed model for how anonymous access, membership, and subscriptions fit together — a themed initiative tracked here rather than as scattered Q-items. **The principle:** the walk-up apps (sign-in, truck check) are only reachable with a legitimate access credential — a brigade device code, a member's personal link, or the public demo — never by typing the bare URL. *Managing* a brigade (adding members, minting links/QR, reports) always needs a signed-in account; that account can be free within limits (the Community plan, ≤10 members) or paid. A paid brigade's owner can already add helpers as `owner`/`admin`/`viewer` users. Visitors can always sign in at a kiosk/brigade URL but get no history and must retype their name each time — they are not a workaround for the member cap.

- **Shipped (2026-07-04):** `AccessRoute` gate on `/signin` — a bare visit with no brigade code / account / demo now redirects to the front door instead of opening the book on the demo/default station. Explicit "Try the demo" button + session-sticky demo mode. See changelog.
- **AC-1 — Personal member link as a real credential. ✅ Shipped 2026-07-04.** `POST /api/checkins/url-checkin` now mints a short-lived (8h), station-scoped member-session JWT on check-in; `flexibleAuth`/`requireSession` recognise it via `X-Member-Session` (station-wide read, never more); `SignInLinkPage` stores it and now opens `/signin` instead of dead-ending at "Done". See changelog.
- **AC-2 — Visitor sign-ins. ✅ Shipped 2026-07-06.** New ephemeral check-in path: `POST /api/events/:eventId/visitors` records a typed name as an `EventParticipant` (`isVisitor: true`, synthetic `visitor-<uuid>` id) but never persists a `Member` — no history, never counts toward `maxMembers`, no toggle (every submit is a fresh row). `MemberNameGrid` gets a "+ Visitor" affordance that reveals a name input; visitors show a "Visitor" badge in the roster and can be removed like any participant. The member grid still only ever renders real `Member`s as tappable tiles. See changelog.
- **AC-3 — Truck-check join model, then gate `/truckcheck`.** Owner's shape: a brigade device / signed-in user *starts* a check session (per vehicle); a QR/link then lets anyone pick an existing vehicle/session to check or join (like the AAR collab join). Build that start-and-share flow first, then apply the same `AccessRoute` discipline to `/truckcheck` so it can't be opened bare either.
- **AC-4 — Consistency sweep.** Reports and admin are already auth-gated (`ProtectedRoute` + `requireSession`); confirm nothing else exposes a walk-up surface without a credential once AC-1…AC-3 land.
- **AC-5 — Device accounts. ✅ Shipped 2026-07-04.** Formalised the anonymous `BrigadeAccessToken` UUID into a first-class `Device` (in-memory + Table Storage twins, `/api/devices` CRUD, org-scoped, owner/admin gated) per the archived design ([SAAS_COMMERCIALIZATION_DESIGN §4](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md)). `kioskAccessResolver.ts` wires Device tokens into every existing kiosk-gating call site (`kioskModeMiddleware`, `flexibleAuth`'s brigade-token path, `/api/brigade-access/validate`) alongside the legacy store, so a new Device-issued kiosk URL actually works end-to-end (sign in, check in members, run activities) — not just a parallel unused API. Admin UI: a "Devices" section per station (enroll/rename/revoke/reactivate/remove, copy/QR the kiosk URL) alongside the untouched legacy token UI. See changelog. `maxDevices` enforcement remains intentionally off per #574.

### Now

- **Q1 — AAR Studio: validate the insight-quality rework on a live debrief (owner, 2026-07-04; consolidation re-tuned 2026-07-06).** The structural rework shipped 2026-07-04 (see changelog): settle-based trigger (quiet-gap, not fixed timer), chunk range 450 → 1400 words, tap-to-edit finding cards, active-review chip. A live debrief since then showed the prompt had over-corrected the other way — distinct topics (comms, size-up, staging location) raised in one exchange were merged into a single finding. 2026-07-06 reworded the prompt to consolidate **by topic, not by segment** (same-topic restatements still merge; distinct topics stay separate) — see changelog. Also added while touching this area: a Present-mode live status strip (recording + transcript-processing indicators, since the projector view previously gave no sign the pipeline was still running) and density-scaled card typography so a growing findings board still fits one screen. **Remaining — needs another real debrief:** confirm the topic-vs-segment rebalance actually lands in the 3–8-findings sweet spot rather than over- or under-shooting again; tune further if not. Batch with the Q3 on-device session.
- **Q29 — Verify `REQUIRE_AUTH=true` in prod + harden brigade-access admin routes (pre-launch review F5, 2026-07-17).** `POST /api/brigade-access/generate`, `GET /api/brigade-access/all-tokens`, and `/stats` use `optionalAuth`, which only enforces auth when `REQUIRE_AUTH=true`. If that App Service setting is unset in prod, anyone can mint a kiosk credential for any station and `all-tokens` dumps every station's kiosk tokens (each a station-scoped read credential) in one request. **First action: confirm the prod env var (verify, don't assume — default is off).** Better fix: gate these admin-only routes with `authMiddleware`+`requireAdmin` unconditionally instead of env-dependent `optionalAuth`. Small, high-value.
- **Q30 — Add process-level crash handlers + run ≥2 instances (pre-launch review F3, 2026-07-17).** No `process.on('unhandledRejection'|'uncaughtException')` anywhere; a single un-awaited rejection in an async socket/route handler can crash the one App Service instance = full outage. Add handlers that log via `logger.error` + flush App Insights (exit cleanly on `uncaughtException` so the platform restarts a known-good process), and scale to ≥2 instances so a restart is never a total outage. Pairs with F2/D6 (a health-check-gated slot swap).
- **Q31 — Gate/limit `/api/ai/*` (pre-launch review F4, 2026-07-17).** `POST /api/ai/chat` and `/report` have no auth and pass the AI gate when there's no org context, so anonymous callers can drive the server-side Azure OpenAI gateway unmetered, bounded only by the generous per-IP `apiRateLimiter`. Require a session or apply a dedicated tight limiter to `/api/ai/*`; decide the anonymous-AAR story explicitly (ties to A2).
- **Q2 — D1 pricing decisions (owner).** Confirm: trial length (14 vs 30 days, AI included?), AI metering unit (session vs audio-minute; see AAR-11 for why per-vend is wrong), top-up pack size/price, per-org vs per-station billing for district orgs, grant/PO invoicing. *Blocks Q5. Decision, not code.*

### Next

- **Q3 — Voice agent: iPad on-device verification.** The F8 audio fixes were built against documented iOS Safari behaviour but have never run on a physical iPad. Run a full voice check on iPad (portrait + landscape), capture the screenshots the PR convention requires, log device-specific breakage. *Blocks Q4; batch with an on-device check of the AAR live-listen reconnect logic (AAR-6/8) and that the AAR-20 print path prints cleanly from its new print window on iPad.*
- **Q4 — Voice agent: pilot rollout.** After Q3, enable for 1–2 pilot AI-plan brigades and gather feedback (noise handling, phrasing, turn caps). Hardening (F1–F16) is done; this is product feedback, not engineering.
- **Q5 — Billing: metered AI overage end-to-end.** `meteredUsageReporter.ts` is a safe no-op until a Stripe meter is configured. After Q2: create the meter, map `UsageRecord` → meter events, verify an overage invoice in test mode. Include the AAR-11 session-vs-vend fix.
- **Q6 — Wiki content refresh.** Sweep migrated developer pages for staleness (known: deployment-optimization + ci-pipeline pre-Linux framing), and add screenshots to the user guide (combine with Q3's iPad session).
- **Q25 — Table Storage: fix the hardcoded 3-month window on `getEvents`/`getEventsWithParticipants` (found 2026-07-14).** `getEventsByDateRange` (used by Reports) was fixed to scan the actually-requested month partitions instead of delegating to `getEvents()`, which hardcodes a "last 3 calendar months" scan regardless of its `limit`/`offset` args. `getEvents()`/`getEventsWithParticipants()` themselves are unchanged — meaning the events-list UI's pagination (`offset` beyond ~3 months of events) and the new org data export (Q26) still silently return nothing for older history in production. Needs a proper fix: either paginate backward through month partitions until `limit` is satisfied, or maintain an "oldest event month" index to bound the scan. Medium priority — affects real, user-visible history depth in production, not just a report edge case.
- **Q26 — Org data export completeness.** `GET /api/organizations/current/export` (shipped 2026-07-14) currently bundles org/stations/members/events only. Extend to include truck-check history and device records once Q25 is resolved (event coverage is the current known gap, documented in the response's `limitations` field).
- **Q6a — Design system v2.0: finish the emoji → Lucide sweep (#618).** The design system v2.0 rollout (2026-07-10) replaced emoji with `lucide-react` icons on the landing page, sign-in header, vehicle-check flow, auth/marketing/reports pages, and the station/crew-access admin consoles. Still emoji: achievement badges (`AchievementBadge.css`, `AchievementCelebration.tsx`, `types/achievements.ts` — likely intentional, expressive reward icons), `ActivityTag.tsx`'s activity-type map, and several admin modals/pages (`UserManagement.tsx`, `BulkImportModal.tsx`, `StationTokenCard.tsx`, `VehicleManagement.tsx`, `EventCard.tsx`, `ActiveCheckIns.tsx`, `NewEventModal.tsx`, `ConfirmationDialog.tsx`, `OnboardingWizard.tsx`, `DemoModeWarning.tsx`, sibling-app icons in `config/suiteApps.ts` and the marketing page's "coming soon" cards). Decide per-spot whether to map to a Lucide icon or keep the emoji (achievements/sibling-app branding may be a deliberate exception).

### Later

- **Q7 — AAR Studio: shrink the `/aar` CSP.** Blocked: live transcription still uses the Azure Speech SDK browser-direct (`wss://*.stt.speech.microsoft.com`), so the CSP must keep provider hosts. Unblocks if AAR moves to a backend speech proxy like the voice agent's (`agentSpeech.ts` pattern) — the CSP hosts are unrelated to AAR-6's now-shipped token-refresh/reconnect fix, so this stays blocked on the proxy move itself.
- **Q8 — Truck check: surface vehicle management.** Vehicle CRUD is buried inside the admin dashboard (old TC-6). Small UX task. *Partially addressed 2026-07-10 (#617): the `/truckcheck` landing page is now a **vehicle roster** — per-vehicle identity, last-check result (`10/12 OK`), when/who, outstanding issues, and Resume/Finalise/**Cancel** for in-progress runs (backed by the new `DELETE /api/truck-checks/runs/:id`). Remaining: fold add/edit/delete vehicle CRUD into the roster so it isn't admin-only, and reduce duplication between the roster, VehicleManagement, and VehicleTypes/Template screens (single "Templates & Vehicle Types" entry).*
- **Q9 — Frontend polish batch.** Known minor UAT leftovers: double service-worker registration log; `/profile/:memberId` settles in 3.5–5s vs near-instant elsewhere. *(The `/login` slow settle was fixed 2026-07-12 (#644) — the QR scanner's ~370 KB html5-qrcode library was in the LoginPage chunk and is now lazy-loaded.)*
- **Q18 — Strip debug console logging from production bundles.** ~31 `console.log` call sites ship in the frontend (kiosk consoles fill with socket-join chatter). Vite 8 is Rolldown-based, so the old `esbuild.pure` route doesn't apply — either configure the oxc minifier's drop options (verify against the Vite 8 docs) or sweep the call sites onto a debug-gated logger. Keep `console.warn`/`console.error`.
- **Q19 — Launch-domain canonical/OG URLs (owner decision).** *(Resolved 2026-07-12 — domain decided: `bushels.com`. Updated canonical/og:url/twitter:url in `frontend/index.html`. `og-image.png` branding already canonical.)*
- **Q20 — Split the 1.5 MB `vendor-export` chunk per format.** `exceljs` + `jspdf` + `html2canvas` + `papaparse` travel as one chunk, so a CSV export downloads the PDF/Excel engines too. Already lazy behind `exportUtils.lazy` and excluded from the SW precache (#644), so impact is limited to first export — split per-format when touching export code next.
- **Q10 — Notifications (email/SMS) #120.** Event reminders and issue-assignment notifications. Design the provider choice (ACS vs SendGrid vs Twilio) first; the truck-check issue lifecycle (`assignedTo`) is the obvious first consumer.
- **Q11 — Advanced analytics dashboard #123.** Value unproven — validate demand with pilot brigades before building.
- **Q12 — Voice agent: continuous listening (VAD).** Swap push-to-talk for voice-activity detection behind the same WS frames. Gather pilot feedback first.
- **Q13 — A4: vision + offline agent phase.** Camera frames + visual diff against `referencePhotoUrl`; on-device speech for offline sheds. Do not start until the voice agent has pilot mileage.
- **Q14 — T6: suite shared packages.** npm/pnpm workspace, `@rfs/ui` / `@rfs/types` / `@rfs/auth-sdk`; sibling repos consume `/api/auth/entitlements`; SSO redirect for cross-origin apps. (#557)
- **Q15 — T7: suite monorepo consolidation.** Turborepo; Fire Break Calculator embedded; Fire Santa Run seasonal peer; converge backends onto Express; one pipeline. Depends on Q14 and a commercial reason. (#558)
- **Q16 — T1 remainder: shared truck-check types.** Fold `Appliance`/`VehicleType`/`ChecklistItem`/`CheckRun`/`CheckResult` into `shared/domain-types.d.ts` like the sign-in types.
- **Q17 — aar-studio: adopt a shared responsive-breakpoint convention.** Per [RESPONSIVE_UI_REVIEW_20260704](wiki/developer/history/reviews/RESPONSIVE_UI_REVIEW_20260704.md) (UI-3): aar-studio's stylesheet has only 3 `@media` rules total (vs. 65 responsive CSS files in `frontend/`) and currently passes an automated phone/tablet/desktop overflow + touch-target scan mostly by luck (auto-fit grids happening to degrade gracefully), not by design. Not urgent — nothing else is broken today — but the next time aar-studio gets sustained feature work, add shared breakpoint vars to `rfs-tokens.css` and check new screens against them explicitly rather than relying on incidental wrapping.
- **Q21 — Ops: fetch + upload the emergency-facilities dataset.** Signup's facility-claim step degrades gracefully (503 → "my unit isn't listed" custom path) until `npm run facilities:fetch` (needs internet access to `services.ga.gov.au` — run from an operator machine, not CI/sandbox) + `npm run facilities:upload` have been run once against prod. One-time ops step, not code.
- **Q22 — Reconcile facility identity with Fire Santa Run.** Both apps now claim against the same Digital Atlas dataset — SM's `Organization.facilityObjectId` (rural-fire layer) and Santa Run's `Brigade.rfsStationId` are the same underlying objectid, but nothing links them yet. Design a reconciliation (shared lookup table? cross-app claim check at signup?) once there's a concrete need to keep a brigade's identity consistent across both apps.
- **Q23 — Org invite emails.** Invite links are copy-paste only (no email delivery) by design for this initial cut. Revisit once Q10 (notifications) lands — could share the same ACS/SendGrid provider choice.
- **Q28 — Voice check 404s in demo mode (found 2026-07-16 during live WS verification).** The truck-check REST routes honour `req.isDemoMode` (`ensureTruckChecksDatabase(req.isDemoMode)`; demo = no `X-Station-Id` header/param, per `stationMiddleware`), so a browser with no station context lists appliances from the **Test-suffix** tables — but the `/ws/agent-check` upgrade handler and the whole voice stack (`agentCheck.ts`, `agentTools.ts`) always call `ensureTruckChecksDatabase()` with no argument, i.e. the **production** tables. A demo-mode client therefore taps Voice Check on an appliance whose id only exists in the Test DB and the upgrade 404s → bare "Connection error". Verified live: the same kiosk token lists different appliance ids with vs. without `X-Station-Id`, and the WS rejects the demo ids with 404. Kiosk/station clients (which always have station context) are unaffected. Fix needs a scope decision first: either voice check is supported in demo mode (thread a demo indicator through the WS query — carefully, since old cached clients won't send it — and make `AgentToolExecutor` use the demo DB so check runs don't write into prod tables), or it isn't (frontend hides the voice entry point when `getCurrentStationId()` is null, and the WS 404 becomes a deliberate, documented response).
- **Q24 — Converge `facilitiesParser.ts` with `rfsFacilitiesParser.ts`.** Two national facility datasets now load in parallel: the pre-existing rural-fire-only `rfsFacilitiesParser.ts` (backs `/api/stations/lookup`) and the new all-service-types `facilitiesParser.ts` (backs `/api/facilities/lookup` for signup). Left separate deliberately to avoid regressing the existing station lookup — merge once there's a concrete reason to (e.g. Q22 needs one canonical facility table anyway).

---

## Open decisions

| ID | Decision | State |
|---|---|---|
| **D1** | Pricing details: trial length, AI metering unit, top-up sizes, org- vs station-level billing, grant/PO invoicing, AAR-in-Basic?, Santa Run seasonal billing. *Fire Break tier placement provisionally settled 2026-07-12: included in Basic + AI Pro (`fireBreakEnabled`); revisit if a dedicated Bushie Suite tier lands (Q14/Q15)* | 🔵 **Open — owner.** Blocks Q5; see Q2 |
| **D2** | Suite auth standard: SM JWT vs Entra External ID | ✅ Resolved — keep SM JWT (kiosk brigade-token model needs it). Revisit only if cross-origin SSO becomes real (Q14) |
| **D3** | Streaming-voice architecture | ✅ Resolved 2026-06-29 — backend proxies audio; Azure OpenAI function calling; same App Service, 30-s WS pings |
| **D4** | Real-time transport at scale: Socket.io vs Azure Web PubSub | 🔵 Open, not urgent — current lean: adopt *Web PubSub for Socket.IO* (keeps code) when multi-brigade scale needs a backplane |
| **D5** | Deploy size/time | ✅ Resolved 2026-06-22 — run-from-package cut the deploy step from ~8 min to <1 min |
| **D6** | Staging-slot pre-swap deploys — every deploy currently cuts over live onto users mid-shift, dropping open Socket.io connections and running post-deploy smoke tests only *after* the bad code is already live. Whether to actually create the slot (requires an App Service Plan tier upgrade) | 🔵 **Open — owner.** CI-side graceful slot detection shipped 2026-07-13 (#649) at zero cost — it deploys to `staging` and swaps if a slot exists, otherwise falls back to today's direct-to-Production behaviour. Creating the slot itself still needs a tier upgrade (B1 ~$13/mo → Premium P1v2+, per [staging-slots-deployment.md](wiki/developer/staging-slots-deployment.md)) — owner has not yet decided to spend that. Revisit if a bad deploy causes a real production incident, or the cost becomes easier to justify at higher revenue |

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
