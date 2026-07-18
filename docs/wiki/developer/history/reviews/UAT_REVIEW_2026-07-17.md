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
| Should-fix (new) | 6 | Check-in silently fails to persist for duplicate-named members (Q37); unlinked-appliance truck check still fake-passes 0/0 (Q38); Vehicle Type link dropdown has indistinguishable duplicate entries (Q39); Delete Station dialog reports another station's data (Q40); admin `/signin` sessions don't join the real-time socket room (Q41); sign-in board defaults to the touch-grid layout on every screen size once an event is active, un-persisted (Q44) |
| Minor / polish (new) | 2 | Native `confirm()`/`alert()` dialogs still used in 3 flows; analytics beacons (Clarity, Cloudflare Insights) blocked by CSP, plus a stray unauthenticated `/api/billing/status` call on the public marketing page (Q42) |
| Low-confidence (new) | 1 | One-off duplicate member from a single Add click, not reproduced in 3 follow-up attempts (Q43) |

Full narrative detail below, ordered by the checklist's section order. Queue IDs (Q37–Q43) are filed in `docs/MASTER_PLAN.md`'s "Newly found" section.

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

**Q37 (should-fix, confirmed):** while testing with two members that happened to share the exact display name "UAT Test Member" (see Q43 below for how that happened), checking one of them in showed every correct UI signal — green highlight, checkmark, "1 signed in" badge — but a direct API query (`GET /api/events`) showed the ended event's `participants` array contained **only** the visitor added afterward; neither duplicate member ID was ever recorded. Re-tested clean: a single, uniquely-named "Clean Repro Member" checked in and persisted correctly, confirmed via the same API query while still checked in. The failure is specific to the duplicate-name scenario — worth checking whether check-in resolution anywhere keys on member *name* instead of ID (e.g., a React list `key` collision that binds the click handler to the wrong closure).

**Q44 (should-fix, confirmed — found via direct user review of the screenshots above):** the board renders two genuinely different layouts depending on whether an event is active — `signin-board-populated` (no active event) shows a proper 3-column desktop layout (Event Log / Current Event / Sign In); `signin-board-event-started` (event just started) switches to a full-width, large-card touch grid instead, at the *same* 1440×900 viewport. This is intentional code (`hasActiveEvents` forces `isGridExpanded = true`), designed for a walk-up kiosk tablet — but it fires on every screen size, and a station normally has an active event during a shift, so a desktop/dispatcher user rarely sees the better-suited 3-column view. A "Collapse to three-column view" toggle exists and works correctly (screenshot: `signin-board-collapsed-with-active-event`, all 3 sizes) — including with an active event and 4 members signed in, it's a clean, dense, well laid-out desktop view — but the choice isn't persisted: reloading the same page while the event stays active snaps straight back to the grid.

Screenshots: `signin-board-populated`, `signin-board-event-started`, `signin-board-member-checked-in`, `signin-board-with-visitor`, `signin-board-dark-mode` (×3 sizes for the populated board; desktop-only for the interaction states); `signin-board-collapsed-with-active-event` (×3 sizes — the preferred desktop view, working correctly today via the manual toggle).

### 5 — Member Profile

Stats, achievements (in-progress achievement cards render correctly, e.g. "Training Enthusiast 0/5"), activity timeline, inline name/rank edit (tested — changed rank to "Firefighter", persisted), delete member (native `confirm()` → soft-delete, "hides from UI but keeps history" — confirmed the member disappeared from `GET /api/members` afterward, so it's a real soft-delete not just a UI hide), personal sign-in link/QR, and invite-link generation all render/function correctly. **Negative test confirmed:** an anonymous visit to a raw `/profile/:id` URL correctly bounces to the marketing page instead of leaking profile data — the `AccessRoute` gate noted in `App.tsx`'s comments works as designed.

### 6 — Truck Check — manual: the core loop is fixed; the unlinked-vehicle trap remains

This is the biggest positive finding of the session. The June 22 review's #1 functional blocker — "there is currently no path to successfully complete a Truck Check on this deployment" — **no longer holds**. Linking an appliance to a standard Vehicle Type, running the real checklist, marking items Done, flagging one with an Issue (photo-upload option, description field), completing the check, submitting the declaration, and the full Follow-ups lifecycle (open → Acknowledge → Mark resolved with resolver name + resolution note) **all worked cleanly with zero network errors**, end to end, exactly as designed. The admin dashboard correctly reflected the result ("Cat 1 — 2/3 OK · 1 issue").

**Q38 (should-fix, confirmed — narrower than the June 22 blocker):** the *unlinked* path is still broken exactly as before: starting a check on any of the 5 pre-seeded appliances before linking a Vehicle Type instantly shows "All Items Completed! 0 of 0 items completed (NaN%)" and saves as a genuine "0/0 OK" pass with no real inspection having occurred. Reproduced on "Bulk Water".

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

**Q41 (should-fix, confirmed):** the same test using two **admin-JWT** browser sessions (both logged in as `Richard BT`, both viewing `/signin`) did *not* sync — raw WebSocket frame capture over a 10+ second window showed neither session ever sent a `join-station` frame at all, so neither received the other's live updates. `frontend/src/hooks/useSocket.ts` only emits `join-station` from inside the socket's `connect` handler (closing over `selectedStation` at effect-mount time) plus a second effect keyed on `[selectedStation, isConnected]` meant to catch late resolution — worth checking why neither path fired for an admin session on this route. Lower severity than it first appears: the actual kiosk-to-kiosk path (how real stations are deployed) is unaffected and confirmed solid.

Screenshots: `realtime-sync-kiosk-device-b` (the working kiosk-to-kiosk case); `realtime-sync-device-a`, `realtime-sync-device-b` (the non-syncing admin-session case).

### 15 — Cross-cutting

No console errors on any tested page **except** the CSP-blocked analytics beacons noted in Q42 (Microsoft Clarity on the main app, Cloudflare Insights on `/aar`) — both fire on every load and are silently dropped, so analytics data isn't being collected at all right now, worth a look independent of the console noise. Touch targets on the sign-in board and truck-check screens look kiosk-appropriate at iPad size. Dark mode held up cleanly on every section it was checked against. Service worker registers at scope `/` (didn't reach `active` state in a single headless page load — expected first-visit behavior, not verified further; full offline-queue behavior needs a real device/browser session to verify properly, not a fresh headless context each run).

## Recommendations, in priority order

1. **Q37 — Check-in silently fails to persist for duplicate-named members.** Data-loss risk on the single most-used feature in the app; worth understanding the mechanism even though duplicate names should be rare in practice.
2. **Q41 — Admin `/signin` sessions don't join the real-time socket room.** Narrower than it sounds (kiosk path is fine) but worth a quick fix in `useSocket.ts` since admins reasonably expect to watch the board live too.
3. **Q38 / Q39 — Truck check unlinked-vehicle fake-pass, and the duplicate Vehicle Type dropdown entries.** Both are UX traps around the same "vehicles ship unlinked by default" gap; consider refusing to start a check on an unlinked appliance instead of letting it fake-pass, and disambiguating the dropdown (show check count and/or custom-vs-built-in inline).
4. **Q40 — Fix the Delete Station data-count check** to query the station actually being deleted, not whichever station's data happens to be cached.
5. **Q44 — Persist the three-column/grid view choice** (and/or default to three-column above some viewport width) so desktop users aren't forced into the touch-grid layout every time an event starts.
6. **Q42 — Polish sweep** (native dialogs, CSP analytics allowlist, stray anonymous `/api/billing/status` call) — low effort, whenever this area is next touched.
7. **Q43 — Keep an eye out for the duplicate-member-on-Add flake.** Not reproducible on demand; re-open if it recurs.

## What's confirmed fixed since the June 22, 2026 review (no action needed)

- Anonymous access to `/api/reports/*`, `/api/members`, `/api/truck-checks/appliances` — was open, now correctly 401s.
- Truck-check save on a Vehicle-Type-linked appliance — was a 400 on the first item, now saves cleanly end to end including issue-flagging and the follow-up lifecycle.
- AAR Studio's AI gateway — was a 503 ("not set up on the server yet"), now produces real, high-quality findings and reports.
- Stripe billing — was "not configured," now a live Customer Portal session with the real subscription.

## Test data left on the live org

- Station "Default Station": one member, "UAT Test Member" (kept as a fixture; its accidental duplicate and the other disposable probe members created during testing were deleted). Two ended events ("Maintenance", "Brigade Training") and one truck-check run remain in history — normal accumulation, not cleanup debris.
- Station "UAT Test Station 3": created, then deactivated (not deleted, due to Q40) — 0 members, 0 events, 1 (now-revoked) brigade token in its history.
- Truck check: "Cat 1" now has a linked Vehicle Type and one completed, resolved-issue check in its history. "Bulk Water" has one 0-item fake-pass check in its history (evidence for Q38 — left in place rather than manufacturing a second one later).
- AAR Studio: the transcript-and-report test review lives only in that browser session's local `IndexedDB` (AAR Studio's local-first design) — it was not saved to the cloud/team library, so it left no trace on the shared org data.
