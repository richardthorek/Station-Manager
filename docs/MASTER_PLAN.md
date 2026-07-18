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
| 4 | Member management (search/filter/sort, CSV import, invite/activation) | 🟡 | Q43 |
| 5 | Truck check — manual (vehicle types, locked checklists, zones/equipment, issue lifecycle, cross-brigade reporting) | ✅ | — |
| 6 | Truck check — voice agent (hold-to-talk → STT → tool loop → TTS) | 🟡 | Q3, Q4, Q12, Q13 |
| 7 | Reports & analytics (dashboard, cross-station, CSV/PDF export) | ✅ | Q11 |
| 8 | AAR Studio — THE HERO (AI-facilitated After Action Reviews) | 🟡 | Q1, Q7 |
| 9 | Multi-station (isolation, station mgmt UI, national dataset lookup, demo station) | ✅ | — |
| 10 | SaaS tenancy & entitlements (plans, gating, org onboarding) | ✅ | Q22 |
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
- **Q5 — Metered AI overage end-to-end.** **2026-07-18:** connected the Stripe MCP to investigate — found the account is **live-mode only** (no test-mode credentials available here) and its Billing Meters API isn't exposed by the MCP tool at all (create/read/write all rejected as unavailable), so the meter still can't be created from this environment either way; that half stays an **owner action** (Stripe dashboard → Product catalog → Billing → Meters → New, event name matching `STRIPE_AI_METER_EVENT`, e.g. `ai_session`). While investigating found and fixed a real code bug that would have silently broken this regardless: `meteredUsageReporter.ts` sent our **internal `organizationId`** as the meter event's `stripe_customer_id`, not the org's actual Stripe customer id (`cus_...`) — Stripe would reject every event, the whole batch's try/catch would swallow the error, and rows would stay unreported forever, retried hourly with no visible failure. Fixed to resolve each org's real `stripeCustomerId` via `organizationDbFactory` and skip (without erroring) orgs that don't have one yet (never checked out). 1 new regression test in `ai.test.ts` covering both the correct-customer-id path and the skip-when-unset path. *Backend: tsc clean; 1108 tests green (1107 passing + 1 pre-existing skip), full suite verified against the in-memory DB.* Still blocked on the owner creating the live meter + a real overage invoice check — code side is now correct and ready to verify against it. See also the new **Q46** finding below (unrelated scalability bug found while testing this).
- ~~**Q21 — Ops: fetch + upload the emergency-facilities dataset.**~~ **Done 2026-07-18:** `services.ga.gov.au` turned out to be reachable from this sandbox (contrary to the fetch script's own comment) once the owner supplied a production `AZURE_STORAGE_CONNECTION_STRING`. Fetch found `fetchEmergencyFacilitiesSnapshot.ts`'s layer→serviceType map had gone stale — GA reordered their `MapServer` layers at some point (layer 1 is now `OTHER_EMERGENCY_MANAGEMENT_FACILITY`, 2 is `POLICING_FACILITY`, 3 is `METRO_FIRE_FACILITY`, shifted by one from the old hardcoded map, so every fetch would have mislabeled metro-fire facilities as "other," police as "metro-fire," and "other" facilities as "police") — fixed by resolving `serviceType` from the layer's **name** instead of a hardcoded id→type table, with an unrecognized layer name now a hard error instead of a silent mislabel. Upload then failed with `PublicAccessNotPermitted` (409): `uploadFacilitiesToBlobStorage.ts` requested `{ access: 'blob' }` (anonymous public read) when creating the container, but the production storage account has public blob access disabled (correct security posture) — and neither parser needs it, since both authenticate with the connection string already. Fixed by dropping the `access` option (private container). Verified the full round trip end-to-end: fetched 8,888 facilities with correct labels, uploaded to prod blob storage, then — via an isolated script, deliberately *not* the full app, to avoid booting against the production Table Storage DB — confirmed the app downloads the blob fresh and serves correctly-labeled search results. Signup's facility-claim step is now live against the real multi-agency dataset in production.
- **Suite ops (feature #13).** Run `npm run grant:firebreak` against prod (stored entitlement snapshots predate the #638 grant) and add the FBC origin to `FRONTEND_URLS`. One-time ops, unblocks already-built wiring.

### Newly found — 2026-07-17 live UAT pass (triage before next launch review)

A full live UAT pass against `bushietools.com` (admin login + kiosk device token, real create/modify/delete against a live test org) — see [UAT_REVIEW_2026-07-17](wiki/developer/history/reviews/UAT_REVIEW_2026-07-17.md) for full evidence and screenshots. The June 22 blockers (anonymous data exposure, truck-check 400s, AI gateway 503, Stripe not wired) are all confirmed **fixed**. These are new findings from this pass, ordered by severity:

- ~~**Q37 — Check-in silently fails to persist when two members share a display name.**~~ **Retracted 2026-07-17, same session:** the original repro clicked the same "check them in" selector twice in one script (a deliberate second click intended as "check them back out") — since `POST /api/events/:id/participants` is a toggle endpoint, that second click correctly reversed the first, netting to zero participants by design, not a persistence failure. Re-verified clean with a single click and no follow-up toggle: a duplicate-named member checks in and persists correctly, confirmed live via `GET /api/events` while still checked in. No code issue here — a UAT test-methodology error, corrected before any fix was attempted.
- ~~**Q38 — Truck check still fake-passes on an unlinked appliance (0/0 NaN%).**~~ **Done 2026-07-18:** starting a check on any appliance with no linked Vehicle Type (and no legacy per-appliance template) instantly showed "All Items Completed! 0 of 0 items (NaN%)" and saved as a legitimate "0/0 OK" pass — the same defect the June 22 review flagged as a blocker. Root cause: `CheckWorkflowPage.tsx`'s completion condition was `results.size === template.items.length`, true at `0 === 0` with no items at all — a 0-item checklist read as "everything done." Investigating found the underlying asymmetry: the in-memory dev DB's `createAppliance` auto-seeds a generic 8-item legacy template whenever an appliance has no vehicle type, but the production Table Storage implementation does not — so this state is only reachable in production, which is exactly why it surfaced on the live UAT pass and not in local testing. **What shipped:** `CheckWorkflowPage.tsx` now checks the resolved checklist's item count in `loadData()` and, when it's zero, shows a dedicated "No checklist to run yet" screen (explaining why, with a "Link a Vehicle Type" action to `/truckcheck/vehicle-types`) instead of entering the workflow at all — refusing to start rather than letting it fake-pass, per the review's own recommendation. The linked path was already fully fixed (confirmed in the June 22/July 17 passes). Deliberately did **not** change the Table Storage backend to auto-seed a template like the in-memory DB does — that's a separate UX/product decision (silently giving every new production appliance a generic checklist) beyond this fix's scope. Verified live against a local dev server: forced a genuine 0-item state via the checklist-overlay API (the in-memory dev DB can't reach it through normal appliance creation, unlike production), confirmed the guidance screen renders instead of the fake completion card, and confirmed a normally-templated appliance is unaffected. *Frontend: tsc + lint clean; 609/609 tests green (no regressions; no new test file — `CheckWorkflowPage.tsx` has no existing test harness, verified live instead, same as Q44).* Distinct from **Q8** (done — roster-accessible vehicle CRUD): that shipped how a vehicle gets *added*, not what happens when a check runs against one with no linked type.
- ~~**Q39 — Vehicle Type link dropdown has duplicate, indistinguishable entries.**~~ **Done 2026-07-18:** linking a vehicle to a standard type showed two options both labelled "Cat 1 Tanker (standard)" — one a custom-authored type (3 checks), one the built-in NSW RFS type (24 checks) — with nothing in the UI to tell them apart before picking one. Root cause: the option label was just `{name}{isStandard ? ' (standard)' : ''}`, and `VehicleType.isStandard` doesn't mean "the official built-in one" — a brigade can "publish" its own type as a standard too (`isStandard: true` with `organizationId` still set), and a same-named collision renders identically to the real thing. **What shipped:** `VehicleFormModal.tsx`'s dropdown now labels each entry by actual provenance + item count — `"{name} — {agency} standard (N items)"` for a genuinely global/seeded type (no `organizationId`), `"{name} — published by your brigade (N items)"` for an org's own published-standard type, `"{name} — custom (N items)"` for a private unpublished type. Verified live against a local dev server: reproduced the exact original collision (a brigade-authored "Cat 1 Tanker" published as standard, same name as the seeded NSW RFS "Cat 1 Tanker") and confirmed the dropdown now shows `"Cat 1 Tanker — NSW RFS standard (24 items)"` and `"Cat 1 Tanker — published by your brigade (3 items)"` as clearly distinct options. *Frontend: tsc + lint clean; 610/610 tests green (1 new, covering built-in/org-published/private-custom labeling).*
- ~~**Q40 — "Cannot Delete Station" dialog reports the wrong station's data.**~~ **Done 2026-07-18:** deleting a brand-new, empty station was blocked with "This station has existing data: 6 members, 2 events" — figures that exactly matched the *Default Station's* data, not the station being deleted. Root cause: `api.getStationStatistics()` took no `stationId` argument and always read counts for whichever station happened to be the *globally selected* current station (via the `X-Station-Id` header) — not the specific station the dialog was asking about. When no station was explicitly selected (the common case for an admin managing 2+ stations — see Q41's "ambiguous" case), no header was sent at all and the backend's own `stationMiddleware` fallback silently defaulted to the literal Default Station, regardless of which station's delete button was clicked. **What shipped:** `getStationStatistics(stationId?)` now accepts an explicit station id and overrides the header for just that call; `DeleteConfirmationDialog.tsx` passes `station.id` (the station actually being deleted). Found and fixed the identical bug in a sibling component while here — `StationDetailsView.tsx`'s "View Details" statistics had the exact same unscoped call, silently showing the globally-selected station's counts in the details modal for a different station; fixed the same way. Verified live against a local dev server with two real stations under one org (one with a member, one empty): opening delete on the empty station now correctly allows the delete instead of being falsely blocked by the *other* station's data, and opening delete on the station with data correctly blocks with *its own* count (not the Default Station's dev-seeded count). *Frontend: tsc + lint clean; full suite green (no regressions). No new automated test — `admin/stations` has no existing test harness for any component in the folder, so this was verified live end-to-end instead, matching Q38/Q44's approach.*
- ~~**Q41 — Admin-authenticated `/signin` sessions don't join the real-time socket room.**~~ **Done 2026-07-17:** two admin-JWT browser sessions both watching `/signin` never exchanged a `join-station` frame and never received each other's live check-ins/events without a manual refresh (confirmed via raw WebSocket frame capture over 10+ seconds). Kiosk/brigade-token sessions were unaffected — the same test with two `?brigade=` device sessions synced correctly and instantly. Root cause: `StationContext.tsx`'s "normal mode" (authenticated, not kiosk/demo) deliberately left `selectedStation` as `null` forever ("no persisted selection needed"), and `useSocket.ts`'s join-station effect requires a resolved `selectedStation` to have a `stationId` to join — REST calls didn't need this (the server infers the org's station from the JWT when no `X-Station-Id` header is sent), but the socket layer has no equivalent inference. **What shipped:** `StationContext.tsx` now auto-resolves `selectedStation` for an authenticated normal-mode admin: if the org owns exactly one station, select it; if it owns none (the common case — relies entirely on the shared `default-station` fallback), select that; two or more is left ambiguous (unchanged behaviour, needs an explicit pick). **Found while fixing it — Q45, fixed alongside:** `GET /api/stations` had no `organizationId` filtering at all — any caller (even anonymous, since it's `optionalAuth`) could enumerate every station across every organization on the platform, and the admin `/admin/stations` page itself used this same unscoped endpoint. Scoped it to (the caller's own org's stations) ∪ (not-yet-backfilled orphans, Q35) when an org context is present; left fully open with no org context (kiosk/demo back-compat, matching the pattern in `entitlements.ts`). Verified live end-to-end against a local dev server (not just unit tests): two real admin browser sessions, raw WebSocket frame capture confirmed both now send `join-station`/receive `joined-station`, and a check-in on one session updated the other's live count with no refresh. *Frontend: tsc + lint clean; 608 → 611 tests green (3 new in `StationContext.test.tsx` covering own-station/fallback-to-default/ambiguous-multi-station). Backend: tsc clean; 1104 → 1106 tests green (2 new in `stations.test.ts` covering own-org-scoped and no-org-context-unscoped).*
- ~~**Q42 — Polish sweep.**~~ **Done 2026-07-18**, all three items:
  1. **Native dialogs (Delete Member, Cancel Check, Revoke Token)** — converted to the existing `ConfirmationDialog` component (the pattern already used for truck-check issue Acknowledge/Resolve): `UserProfilePage.tsx`, `TruckCheckPage.tsx`, `BrigadeAccessPage.tsx`. Each flow's `alert()` success/error also moved to the existing toast system (`useToast`). Verified live end-to-end for Delete Member (dialog rendered, no native browser dialog fired, member actually deleted, confirmed via re-fetch). **Scope note:** the codebase has ~45 more `confirm()`/`alert()` call sites across truck-check admin flows (zones, equipment, vehicle types, templates) not touched here — Q42 only ever named these 3 specific flows; a full sweep is a distinct, larger follow-up (not filed as a new Q-item since it's cosmetic/low-value — revisit only if it becomes a live complaint).
  2. **CSP blocking Clarity/Cloudflare Insights** — two real gaps found reading the config (not reproducible live in this sandbox's own network-proxied dev environment, so fixed from documented-correct vendor CSP requirements): Clarity's `connect-src` listed 2 enumerated collection subdomains, but Clarity shards across many single/double-letter subdomains chosen at runtime — replaced with the wildcard `https://*.clarity.ms` Microsoft's own CSP guidance specifies. Cloudflare Insights' actual beacon domain (`cloudflareinsights.com`) isn't a subdomain of `cloudflare.com`, so `https://*.cloudflare.com` never matched it — added the bare domain explicitly; also added Cloudflare Insights entirely to the separate `/aar` CSP override, which had zero Cloudflare hosts (it replaces the global policy wholesale, so the main app's allowance never applied there). `securityHeaders.test.ts` (a hand-duplicated mirror of `index.ts`'s CSP, not an import — pre-existing drift, already missing Cloudflare entirely before this fix) updated to match and gained 2 new assertions.
  3. **Stray anonymous `/api/billing/status` call** — `TrialBanner.tsx` is mounted globally in `App.tsx` above the route tree, so it fired the authed-only billing-status call (a guaranteed, silently-caught 401) on every page including the logged-out public marketing page. Gated the effect on `isAuthenticated` (and `!authLoading`, to avoid firing during the initial auth-resolution window). 4 new tests in `TrialBanner.test.tsx`.
  *Frontend: tsc + lint clean; 610 → 614 tests green (4 new). Backend: tsc clean; `securityHeaders.test.ts` 33 → 35 tests, all green.*
- **Q43 — Occasional duplicate member from a single "Add" click.** Observed once this session (two identical "UAT Test Member" records from what should have been one Add action, confirmed via API) but did not reproduce across 3 immediate follow-up attempts with clean network traces (1 POST each). Likely a rare client-side race rather than a systemic double-submit — worth a quick look at the Add-member handler, but low confidence/low priority until it reproduces again.
- **Q46 — `listUnreported()`/`markReported()` in `tableStorageUsageDatabase.ts` are unbounded, found while verifying Q5's fix.** `listUnreported()` scans the *entire* usage table for `reportedToStripe eq false` with no `top`/paging, loading every row into memory in one call; `markReported()` then does one extra table query per row id to look up its partition key before updating it. Reproduced the failure mode directly: this session's shared dev Azure Storage account has accumulated a large backlog of never-reported usage rows from historical test runs (metered billing has been off in most runs, so nothing ever calls `markReported`), and the very first `listUnreported()` call against it OOM-crashed Node with an 8GB heap. Low risk today (metered billing isn't live yet, so the real "Usage" table is still small), but it'll hit the same wall in production once Q5 ships and usage accumulates over months. Fix is a bounded page size + a `markReported` that batches by partition instead of one lookup per id — not done here (out of scope for this session, filed for whoever picks up Q5's Stripe-side follow-through).
- ~~**Q44 — Sign-in board defaults to the touch-optimized grid on every screen size, the instant an event goes active.**~~ **Done 2026-07-18:** `SignInPage.tsx`'s `hasActiveEvents` effect force-set `isGridExpanded = true` whenever any event was active — true on every load, on every viewport, with no persistence for a user's "Collapse to three-column view" choice (confirmed: collapsing, then reloading the same page, snapped straight back to the grid). Found via direct user feedback comparing screenshots from this UAT pass. **What shipped:** the grid/three-column choice now persists to `localStorage` (`signin-grid-expanded`) the moment a user explicitly collapses or re-expands, and that explicit choice always wins on future loads. Until a user makes that first explicit choice, the *default* is viewport-width-based (matching the `.content-grid` CSS breakpoint at 1024px): kiosk/tablet widths still default to the touch grid, desktop widths default to three-column — and the "auto-expand when an event starts" convenience now only fires on kiosk-width viewports with no stored preference, instead of forcing every screen size. Verified live against a local dev server (not just unit tests): desktop-with-no-pref stays three-column when an event is active, kiosk-width-with-no-pref auto-shows the grid, an explicit collapse persists across a full page reload, and an explicit kiosk-width "stay collapsed" choice is respected even with an active event. *Frontend: tsc + lint clean; 609 tests green (no regressions). `SignInPage.tsx` has no existing component-test harness to extend cheaply (heavy `api`/`useSocket`/`useStation` dependencies), so this was verified live end-to-end against a local dev server instead of with a new unit test — a gap worth closing if the file gets a test harness for other reasons.*

### Post-launch — iterate & expand

Improves the platform but isn't required to launch. Do not pull forward ahead of L1–L3.

- **Q1 — AAR insight-quality validation on a live debrief.** Confirm topic-vs-segment consolidation lands in the 3–8-findings sweet spot; batch with Q3.
- **Q3 / Q4 — Voice agent: iPad on-device verification, then pilot rollout.** Physical iPad run (portrait + landscape); then enable for 1–2 pilot AI-plan brigades.
- **Q6 / Q6a — Wiki content refresh; finish the emoji → Lucide sweep.** Remaining emoji still outstanding. **Partial 2026-07-17:** the one concretely-stale dev page found — `deployment-optimization.md` (a v2.0 "pre-install node_modules" strategy write-up that still described prod as Windows/IIS, actively misleading despite the OS having migrated to Linux months ago) — archived to `history/archive/` (its outage post-mortem is still valuable, just not current guidance); fixed `docs/wiki/developer/README.md`'s stale/misattributed staleness caveats and several broken relative links in `history/archive/README.md` left over from the pre-restructure doc renames. **User-guide screenshots done 2026-07-18:** all 10 walkthrough pages (`getting-started.md` through `voice-check.md`, plus the guide `README.md`) now have real screenshots at their relevant steps — 25 images in a new `docs/wiki/user-guide/images/`, mostly reused from the July 17 UAT pass's evidence set plus 2 newly captured for gaps that pass didn't cover (the Q38 "No checklist to run yet" guidance screen, and the voice check page). See changelog. Still open: the emoji → Lucide sweep.
- **Q7 — Shrink the `/aar` CSP.** Blocked until AAR moves live transcription to a backend speech proxy.
- ~~**Q8 — Surface vehicle management in the truck-check roster.**~~ **Done 2026-07-17:** add/edit a vehicle directly from `/truckcheck` (an "Add Vehicle" action + a per-card edit pencil) — no more forced hop to `/truckcheck/admin` for basic CRUD. Delete/template/zones editing deliberately stay on the Admin Dashboard (more specialized, higher-risk actions). See changelog.
- **Q10 / Q23 — Notifications (email/SMS); org invite emails.** Design the provider choice (ACS vs SendGrid vs Twilio) first — shared by both consumers.
- **Q11 — Advanced analytics dashboard.** Value unproven — validate demand with pilot brigades first.
- **Q12 / Q13 — Voice agent VAD (continuous listening); A4 vision + offline agent.** Both wait on voice-agent pilot mileage.
- **Q14 / Q15 / Q16 — Suite consolidation.** Shared packages, monorepo/Turborepo, shared truck-check domain types. Depends on a commercial reason.
- **Q17 — aar-studio responsive-breakpoint convention.** Add shared breakpoint vars to `rfs-tokens.css` next time aar-studio gets sustained work.
- **Q22 / Q24 — Reconcile facility identity with Fire Santa Run; converge the two national facility parsers.** Merge when there's one concrete need for a canonical facility table.
- ~~**Q28 — Voice check 404s in demo mode.**~~ **Done 2026-07-17:** took the "hide the entry point" branch of the scope decision (not "support demo") — touching the WS handler's DB resolution felt too close to its existing cross-tenant/entitlement checks to change speculatively. The roster's Voice button and the `/truckcheck/voice/:id` route itself now both check `useStation().isDefaultStation()` and stay hidden / show a redirect message when there's no real station context, instead of opening a socket that's guaranteed to 404. See changelog.

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
