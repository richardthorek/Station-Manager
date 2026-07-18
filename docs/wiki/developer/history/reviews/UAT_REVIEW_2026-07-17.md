# UAT Review — July 17, 2026

## Overview

A full user-acceptance pass against the live production deployment (`bushietools.com`), driven by browser automation (Playwright/Chromium), against the master checklist in [`uat-checklist.md`](../uat-checklist.md). Covered the public marketing site, admin login, the app picker, sign-in board, member profiles, truck checks (manual, linked and unlinked), reports, admin (stations, brigade access, organization, platform), AAR Studio end-to-end (transcript → AI findings → AI report), real-time multi-device sync, and a set of negative/security checks. Every write action ran against a real test organization — members, events, truck checks, a station, a brigade token, and an AAR review were all genuinely created (and, in the case of disposable test fixtures, deleted) on the live system, not a mock.

## Review methodology

- **Method:** Live browser automation (Playwright/Chromium) against the production URL — no staging environment used.
- **Accounts used:** Admin login `Richard BT` (org "Test Brigade 1", plan **AI Pro**, station "Default Station"), plus the kiosk/device brigade token for the same default station (used specifically for the multi-device real-time sync test, since it's the primary real-world deployment pattern).
- **Review date:** July 17, 2026 (session ran into the early hours of July 18).
- **Scope:** Every route in `frontend/src/App.tsx`, `/aar` end-to-end, and cross-cutting concerns (real-time sync, responsive layout, console errors). See the checklist for the full target list.
- **Screenshots:** 86 screenshots captured live during the session, committed to [`images/`](images/) as `<page>-20260717-<desktop|ipad|mobile>.png`. Full-page capture was used throughout except where noted (AAR Studio's mobile findings-board screenshot uses a viewport-only capture — `fullPage` screenshots of routes with a `position: sticky` header stitch the header into a visual artifact partway down the page; this is a Chromium screenshot-capture quirk, not a product bug, and is called out explicitly below so it isn't mistaken for one).
- **Prior review cross-reference:** [`UAT_REVIEW_20260622.md`](UAT_REVIEW_20260622.md) found 3 blockers and 6 should-fix items on June 22. This pass re-verified every one of them live.

## Results summary

| Severity | Count | Examples |
|---|---|---|
| Resolved since June 22 | 4 | Anonymous data exposure (reports/members/truck-checks) now 401s; truck-check linked-vehicle save no longer 400s; AAR Studio AI gateway fully working (findings + report generation); Stripe billing portal live |
| Should-fix (new) | 2 | Vehicle Type link dropdown has indistinguishable duplicate entries (Q39); Delete Station dialog reports another station's data (Q40) |
| Fixed same session | 4 | Admin `/signin` sessions didn't join the real-time socket room (Q41) — fixed in `StationContext.tsx`, verified live; found while fixing it — `GET /api/stations` had no organization scoping at all (Q45), fixed alongside; sign-in board defaulted to the touch-grid layout on every screen size once an event was active, un-persisted (Q44) — fixed in `SignInPage.tsx`, verified live at both desktop and kiosk widths; unlinked-appliance truck check fake-passed 0/0 (Q38) — fixed in `CheckWorkflowPage.tsx`, verified live |
| Minor / polish (new) | 2 | Native `confirm()`/`alert()` dialogs still used in 3 flows; analytics beacons (Clarity, Cloudflare Insights) blocked by CSP, plus a stray unauthenticated `/api/billing/status` call on the public marketing page (Q42) |
| Low-confidence (new) | 1 | One-off duplicate member from a single Add click, not reproduced in 3 follow-up attempts (Q43) |
| Retracted same session | 1 | "Check-in silently fails for duplicate-named members" (Q37) — a test-methodology false positive, caught and corrected before any fix was attempted; see the retraction note in Section 4 below |

Full narrative detail below, ordered by the checklist's section order. Queue IDs (Q38–Q44) are filed in `docs/MASTER_PLAN.md`'s "Newly found" section; Q37 is struck through there with a retraction note rather than deleted, so the id isn't confusingly reused.

## Findings by area

### 0 — Pre-flight

Admin login (`Richard BT`) succeeded first try, landing on the app picker. Org: "Test Brigade 1", plan **AI Pro** (all features unlocked — Sign-In, Vehicle Check, Reports, AAR Studio, Station Management all active; Fire Santa Run / Fire Break Calculator correctly show "Not in your plan"). Station: "Default Station", which started this session with **zero members and zero events** — a genuinely fresh test org, not seeded demo data.

### 1 — Public / Marketing

`/`, `/signup`, `/login` all render cleanly logged out, at desktop/iPad/iPhone. Pricing table matches `plans.ts` (Community free, Basic $10/mo, AI Pro $19/mo). Minor: the marketing page fires `GET /api/billing/status` while fully logged out, which correctly 401s but is a needless call on a page with no session context — folded into Q42.

### 2 — Authentication

Admin login/logout both work cleanly (logout clears `localStorage` and returns to the marketing page). Bad credentials show "Invalid username or password" with no crash. The QR-scan button opens its modal (camera itself untestable headless — no device). The device-setup guide modal opens correctly, a clean 5-step wizard. An already-authenticated visit to `/login` redirects straight past the form to `/`, as expected.

### 3 — App picker

All plan-entitled tiles (Sign-In, Vehicle Check, Reports, AAR Studio, Station Management) render active and link correctly; un-entitled suite apps (Santa Run, Fire Break) correctly show a locked "Not in your plan" pill rather than a dead link.

### 4 — Sign-In Board — mostly excellent, one real bug

The full lifecycle — add member, start event (two-step: pick an activity card, then confirm "Start Event"), check in, add a visitor, check out, dark mode, end event — worked cleanly with **zero console errors** end to end, and the event correctly moved to "Past events" with the right duration once ended. Dark mode holds proper contrast.

**Q37 — retracted, test-methodology error (not a product bug):** the initial pass through this section found what looked like a real bug — checking in one of two members sharing the exact display name "UAT Test Member" (see Q43 below for how that happened) showed every correct UI signal, but a direct API query afterward showed no participant recorded for either duplicate. On closer inspection, the repro script itself was the problem: it clicked the same "check them in" button twice in the same run — the first click to check in, a second click a few steps later deliberately intended as "check the member back out" (to test the check-out flow) — and since `POST /api/events/:id/participants` is a **toggle** endpoint (check in if absent, check out if already present), that second click correctly reversed the first. The API query that "found" zero participants ran after both clicks, i.e. after a legitimate check-in followed by a legitimate check-out of the same person — net zero by design, not a persistence failure. Re-tested properly — a single click, no follow-up toggle, API queried immediately while still checked in — and a duplicate-named member persists correctly, same as a uniquely-named one. No code issue; retracted before any fix was attempted, and left as a struck-through entry in `MASTER_PLAN.md` rather than silently deleted.

**Q44 — fixed 2026-07-18 (found via direct user review of the screenshots above):** the board rendered two genuinely different layouts depending on whether an event is active — `signin-board-populated` (no active event) shows a proper 3-column desktop layout (Event Log / Current Event / Sign In); `signin-board-event-started` (event just started) switched to a full-width, large-card touch grid instead, at the *same* 1440×900 viewport. This was intentional code (`hasActiveEvents` forced `isGridExpanded = true`), designed for a walk-up kiosk tablet — but it fired on every screen size, and a station normally has an active event during a shift, so a desktop/dispatcher user rarely saw the better-suited 3-column view. A "Collapse to three-column view" toggle existed and worked correctly (screenshot: `signin-board-collapsed-with-active-event`, all 3 sizes) — including with an active event and 4 members signed in, it's a clean, dense, well laid-out desktop view — but the choice wasn't persisted: reloading the same page while the event stayed active snapped straight back to the grid. **Fixed:** the collapse/expand choice now persists to `localStorage` and always wins on future loads; the *default*, until a user picks, is now viewport-width-based (desktop → three-column, kiosk/tablet width → grid, matching the existing 1024px CSS breakpoint) instead of unconditionally grid on every size. Verified live at both desktop and kiosk widths, with and without a stored preference, and across a full page reload — see the changelog entry for full detail.

Screenshots: `signin-board-populated`, `signin-board-event-started`, `signin-board-member-checked-in`, `signin-board-with-visitor`, `signin-board-dark-mode` (×3 sizes for the populated board; desktop-only for the interaction states); `signin-board-collapsed-with-active-event` (×3 sizes — the preferred desktop view, working correctly today via the manual toggle).

### 5 — Member Profile

Stats, achievements (in-progress achievement cards render correctly, e.g. "Training Enthusiast 0/5"), activity timeline, inline name/rank edit (tested — changed rank to "Firefighter", persisted), delete member (native `confirm()` → soft-delete, "hides from UI but keeps history" — confirmed the member disappeared from `GET /api/members` afterward, so it's a real soft-delete not just a UI hide), personal sign-in link/QR, and invite-link generation all render/function correctly. **Negative test confirmed:** an anonymous visit to a raw `/profile/:id` URL correctly bounces to the marketing page instead of leaking profile data — the `AccessRoute` gate noted in `App.tsx`'s comments works as designed.

### 6 — Truck Check — manual: the core loop is fixed; the unlinked-vehicle trap remains

This is the biggest positive finding of the session. The June 22 review's #1 functional blocker — "there is currently no path to successfully complete a Truck Check on this deployment" — **no longer holds**. Linking an appliance to a standard Vehicle Type, running the real checklist, marking items Done, flagging one with an Issue (photo-upload option, description field), completing the check, submitting the declaration, and the full Follow-ups lifecycle (open → Acknowledge → Mark resolved with resolver name + resolution note) **all worked cleanly with zero network errors**, end to end, exactly as designed. The admin dashboard correctly reflected the result ("Cat 1 — 2/3 OK · 1 issue").

**Q38 — fixed 2026-07-18 (narrower than the June 22 blocker):** the *unlinked* path was still broken exactly as before: starting a check on any of the 5 pre-seeded appliances before linking a Vehicle Type instantly showed "All Items Completed! 0 of 0 items completed (NaN%)" and saved as a genuine "0/0 OK" pass with no real inspection having occurred. Reproduced on "Bulk Water". Root cause: `CheckWorkflowPage.tsx`'s completion condition (`results.size === template.items.length`) is true at `0 === 0`; the in-memory dev DB auto-seeds a generic legacy template for every unlinked appliance so this state can't be reached locally, but the production Table Storage implementation doesn't, which is why this only ever showed up live. **Fixed:** the workflow now refuses to start on a 0-item checklist, showing a "No checklist to run yet" guidance screen with a direct link to `/truckcheck/vehicle-types` instead. Verified live at both desktop viewport widths — see the changelog entry for full detail.

**Q39 (should-fix, confirmed):** the Vehicle Type link dropdown (Vehicle Management → Edit → "Link to a standard type") lists two entries both labelled exactly `Cat 1 Tanker (standard)` — a custom-authored type (3 checks) and NSW RFS's built-in type (24 checks) — with no distinguishing detail shown, so picking the wrong one is a silent trap.

Also re-confirmed, unfixed, already tracked in `qa-walkthrough.md` (not re-logged): "Resume" on an in-progress check doesn't resume — it re-prompts for the inspector's name from scratch.

Screenshots: `truckcheck-hub`, `truckcheck-admin`, `truckcheck-vehicle-types` (×3 sizes each); `truckcheck-workflow-start`, `truckcheck-checklist` (the 0/0 fake-pass), `truckcheck-summary-fakepass`, `truckcheck-real-checklist`, `truckcheck-item-issue-flagged`, `truckcheck-all-items-complete`, `truckcheck-followups`, `truckcheck-followup-acknowledged`, `truckcheck-resolve-modal`, `admin-stations-create-form` (desktop).

### 6b — Truck Check — voice agent

`/truckcheck/voice/:applianceId` is reachable and gates cleanly ("Voice check needs a station selected first" rather than crashing) — no mic/audio hardware available in this headless environment to test the hold-to-talk flow itself. Per `MASTER_PLAN.md`, this is already tracked as 🟡 pending iPad on-device verification (Q3/Q4) — not re-logged here.

### 7 — Reports & Analytics

All three report pages (`/reports`, `/reports/advanced`, `/reports/cross-station`) render with real, non-zero data for this org (Health Score 66/FAIR, 6 current members, attendance/events trends) — no data-leak, no all-zero placeholder. Date-range filtering (7/30/90 days) updates the shown range correctly with no errors. Export is a dropdown (PDF / Excel / PNG, not literally "CSV" as the checklist assumed) — tested "Export as Excel," which downloaded a valid 8.4 KB `.xlsx`. **Negative test confirmed:** `GET /api/reports/attendance-summary`, `/api/members`, `/api/reports/event-statistics`, and `/api/truck-checks/appliances` all correctly return **401** to a fully anonymous request — this directly resolves the June 22 review's top-priority security blocker (anonymous data exposure).

### 8–10 — Admin (Stations, Brigade Access, Organization)

**Stations:** created a real station ("UAT Test Station 3") through the full manual-entry form (national-dataset search skipped — no network path to test it meaningfully here); it appeared correctly with the right hierarchy fields. **Q40 (should-fix, confirmed):** attempting to delete it — while it was still genuinely empty (0 members, 0 events, confirmed via `GET /api/stations`) — was blocked by a "Cannot Delete Station... This station has existing data: 6 members, 2 events" dialog. Those exact figures match the *Default Station's* data at the time, not the new station. Deactivating it (the dialog's suggested alternative) worked correctly and is how the test station was left (station count: 1 active / 1 inactive).

**Brigade Access:** generated a new kiosk token for the test station, confirmed the resulting `?brigade=` URL authenticates a fresh anonymous session into that station's (empty) board, then revoked it and confirmed the same URL now returns **403** with a clear error — the full issue/verify/revoke lifecycle works correctly and immediately.

**Organization:** plan/status display correct (AI Pro, active, "6 of 25 AI sessions used"); a module toggle (Truck Check off → on) round-tripped correctly with an "Updated" confirmation; org data export downloaded a valid JSON file; "Manage billing & invoices" correctly redirected to a live Stripe Customer Portal session (test mode) showing the real $19/mo subscription and card on file — billing is fully wired, not blocked as the June 22 review found.

**Platform console:** `Richard BT` is not a platform operator — `/admin/platform` correctly shows "Not authorised" rather than crashing or leaking data. Marked N/A for deeper testing on this account, as planned.

Screenshots: `admin-stations`, `admin-stations-created`, `admin-brigade-access`, `admin-organization`(-full), `admin-platform-not-authorised` (×3 sizes each); `admin-stations-create-form`, `admin-stations-delete-confirm`, `admin-stations-deactivated`, `admin-brigade-access-token-issued` (desktop).

### 12 — AAR Studio — the hero feature, and it delivers

`/aar` loads its own shell correctly (no blank-screen SPA-fallback regression). Ran the full non-audio path — pasted a realistic 6-line debrief transcript ("Add a typed or pasted transcript instead," under a collapsed `<details>` that needed ~2.5s after route mount before it reliably expanded in automation — a minor timing note, not a functional bug) — and it worked **end to end**: the Findings board produced 4–5 accurately-categorized, well-written findings across all four phases (What happened / went well / didn't go well / next time), each correctly quoting the source line; "Generate with AI" then produced a genuinely polished, publication-ready one-page report (headline, key stats, per-phase detail, consolidated recommendations, top-3 actions, overall assessment) in under 20 seconds. This directly resolves the June 22 review's blocker ("AI service isn't set up on the server yet... AAR Studio's core AI features do not work") — the Azure OpenAI/Speech gateway is fully configured and working in production today.

Screenshots: `aar-studio-home` (×3 sizes), `aar-studio-record`, `aar-studio-transcript-added`, `aar-studio-edit`, `aar-studio-report`, `aar-studio-report-generated` (desktop), `aar-studio-findings` (×3 sizes — the mobile one is a viewport-only capture per the note above).

### 14 — Real-time / multi-device sync — works for the real use case, gap on the admin path

**Confirmed working (the primary deployment pattern):** two independent kiosk/brigade-token sessions (simulating two physical station tablets) synced perfectly — starting an event on device A appeared on device B with no refresh, and checking a member in on A appeared on B within ~1 second via a genuine WebSocket push (verified with raw frame capture: both devices correctly sent `join-station` and received `joined-station`, and B received the `event-update` broadcast after A's check-in).

**Q41 — fixed same session:** the same test using two **admin-JWT** browser sessions (both logged in, both viewing `/signin`) did *not* sync — raw WebSocket frame capture over a 10+ second window showed neither session ever sent a `join-station` frame at all. Root cause: `StationContext.tsx`'s "normal mode" (authenticated, not kiosk/demo) deliberately left `selectedStation` as `null` forever, and `useSocket.ts`'s join-station effect requires a resolved `selectedStation` to have a `stationId` to join — REST calls didn't need this (the server infers the org's station from the JWT when no `X-Station-Id` header is sent), but the socket layer has no equivalent inference. Fixed by having `StationContext` auto-resolve a station for this case: the org's one owned station if it has exactly one, the shared `default-station` fallback if it owns none (the common case for a fresh org), left ambiguous (unchanged) if it owns two or more.

**Q45 — found while fixing Q41, fixed alongside:** `GET /api/stations` had zero `organizationId` filtering — any caller, even anonymous (the route is `optionalAuth`), could list every station across every organization on the platform, and the admin `/admin/stations` management page used this same unscoped endpoint for its own listing. Scoped it: when the caller carries an org context, return (their own org's stations) ∪ (orphaned stations with no `organizationId` yet, per the existing Q35 backfill pattern); left fully open when there's no org context, matching the kiosk/demo back-compat convention already used throughout `entitlements.ts`.

Both fixes verified live end-to-end against a local dev server (not just unit tests): two real admin browser sessions, WebSocket frame capture confirmed both now correctly send `join-station` and receive `joined-station`, and a check-in on one session updated the other's live "signed in" count with no page refresh.

Screenshots: `realtime-sync-kiosk-device-b` (the working kiosk-to-kiosk case); `realtime-sync-device-a`, `realtime-sync-device-b` (the non-syncing admin-session case).

### 15 — Cross-cutting

No console errors on any tested page **except** the CSP-blocked analytics beacons noted in Q42 (Microsoft Clarity on the main app, Cloudflare Insights on `/aar`) — both fire on every load and are silently dropped, so analytics data isn't being collected at all right now, worth a look independent of the console noise. Touch targets on the sign-in board and truck-check screens look kiosk-appropriate at iPad size. Dark mode held up cleanly on every section it was checked against. Service worker registers at scope `/` (didn't reach `active` state in a single headless page load — expected first-visit behavior, not verified further; full offline-queue behavior needs a real device/browser session to verify properly, not a fresh headless context each run).

## Recommendations, in priority order

1. ~~**Q41 — Admin `/signin` sessions don't join the real-time socket room.**~~ Fixed same session — see above.
2. ~~**Q44 — Persist the three-column/grid view choice.**~~ Fixed 2026-07-18 — see above.
3. ~~**Q38 — Truck check unlinked-vehicle fake-pass.**~~ Fixed 2026-07-18 — see above.
   **Q39 — the duplicate Vehicle Type dropdown entries.** A UX trap around the same "vehicles ship unlinked by default" gap; disambiguate the dropdown (show check count and/or custom-vs-built-in inline).
4. **Q40 — Fix the Delete Station data-count check** to query the station actually being deleted, not whichever station's data happens to be cached.
5. **Q42 — Polish sweep** (native dialogs, CSP analytics allowlist, stray anonymous `/api/billing/status` call) — low effort, whenever this area is next touched.
6. **Q43 — Keep an eye out for the duplicate-member-on-Add flake.** Not reproducible on demand; re-open if it recurs.

## What's confirmed fixed since the June 22, 2026 review (no action needed)

- Anonymous access to `/api/reports/*`, `/api/members`, `/api/truck-checks/appliances` — was open, now correctly 401s.
- Truck-check save on a Vehicle-Type-linked appliance — was a 400 on the first item, now saves cleanly end to end including issue-flagging and the follow-up lifecycle.
- AAR Studio's AI gateway — was a 503 ("not set up on the server yet"), now produces real, high-quality findings and reports.
- Stripe billing — was "not configured," now a live Customer Portal session with the real subscription.

## What was fixed in this session, after the pass (no action needed)

- **Q41** — admin `/signin` sessions weren't joining the real-time socket room; fixed in `StationContext.tsx`, verified live with two real browser sessions.
- **Q45** — `GET /api/stations` had no organization scoping at all (found while fixing Q41); scoped to the caller's own org + not-yet-backfilled orphans, left open when there's no org context.
- **Q44** — the sign-in board force-defaulted to the touch grid on every screen size once an event was active, with no persistence for a manual collapse; fixed in `SignInPage.tsx` (`localStorage`-backed preference + viewport-width-based default), verified live at both desktop and kiosk widths.
- **Q38** — an appliance with no linked Vehicle Type and no legacy template fake-passed a check with 0 items; fixed in `CheckWorkflowPage.tsx` (refuses to start, shows a "No checklist to run yet" guidance screen instead), verified live against a forced 0-item state.

## Test data left on the live org

- Station "Default Station": one member, "UAT Test Member" (kept as a fixture; its accidental duplicate and the other disposable probe members created during testing were deleted). Two ended events ("Maintenance", "Brigade Training") and one truck-check run remain in history — normal accumulation, not cleanup debris.
- Station "UAT Test Station 3": created, then deactivated (not deleted, due to Q40) — 0 members, 0 events, 1 (now-revoked) brigade token in its history.
- Truck check: "Cat 1" now has a linked Vehicle Type and one completed, resolved-issue check in its history. "Bulk Water" has one 0-item fake-pass check in its history (evidence for Q38 — left in place rather than manufacturing a second one later).
- AAR Studio: the transcript-and-report test review lives only in that browser session's local `IndexedDB` (AAR Studio's local-first design) — it was not saved to the cloud/team library, so it left no trace on the shared org data.
