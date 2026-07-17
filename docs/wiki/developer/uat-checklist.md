# Station Manager — UAT Checklist (living reference)

This is the **master checklist** for a full user-acceptance pass across the app —
every route, every gated feature, `/aar`, and the cross-cutting concerns (real-time
sync, offline/PWA, responsive). It's a companion to
[qa-walkthrough.md](qa-walkthrough.md), which is a narrower, deeper script focused
on Truck Check + AAR sync; this one is the broad sweep across the whole product.

**How this doc is used:**

1. This file stays evergreen — the target list of what a UAT pass should cover.
   Update it when a route or feature is added/removed/re-gated.
2. Each actual run of this checklist produces a dated results doc in
   [`history/reviews/`](history/reviews/) (e.g. `UAT_REVIEW_2026-07-17.md`) with the
   narrative, screenshots, and a findings list. That's where "what happened" lives —
   this file never accumulates run-specific results or screenshots itself.
3. New findings from a run get folded into `docs/MASTER_PLAN.md`'s queue, not left
   only in the dated review.

**Screenshot convention for a run:** 3 sizes per feature area — **Desktop**
(1440×900), **iPad landscape** (1024×768, the primary kiosk/tablet orientation),
**iPhone** (390×844) — saved to `history/reviews/images/` as
`<page>-<yyyymmdd>-<desktop|ipad|mobile>.png`, referenced from the dated review.

---

## 0. Pre-flight

- [ ] Confirm the admin test login reaches `/login` successfully and lands on the
  app picker (`/apps`)
- [ ] Note which organization/plan the test account is on (Community / Basic / AI
  Pro) — determines which gated features below are reachable at all
- [ ] Note which station(s) the account has access to
- [ ] Open DevTools console (or equivalent) and watch for errors across the whole
  run, not just per-page

## 1. Public / Marketing (unauthenticated)

- [ ] `/` (logged out) — hero, "What's in the kit" tiles, live-demo mocks, pricing
  table, FAQ accordion, footer links
- [ ] Pricing table figures match `backend/src/constants/plans.ts`
- [ ] "Try it free" / "Try the demo" / "See plans" CTAs route correctly
- [ ] `/signup` — signup form, facility/station claim step, conflict handling
- [ ] `/activate/:token` — account activation (needs a real token to fully exercise)
- [ ] `/invite/:token` — org invite acceptance (needs a real token)

## 2. Authentication

- [ ] `/login` — admin username/password sign-in
- [ ] Bad credentials show a clear error, no crash
- [ ] "Scan Device QR Code" opens the QR scanner modal
- [ ] "Setup Guide" (`?`) opens the device setup guide modal
- [ ] Already-authenticated visit to `/login` redirects past the form
- [ ] Logout returns to the marketing page and actually clears the session

## 3. App picker / Landing (`/`, `/apps`, post-login)

- [ ] Tiles for Station Manager, AAR Studio, Fire Break Calculator, Fire Santa Run
  render with correct enabled/disabled state per plan entitlement
- [ ] Each tile links correctly (`/signin`, `/aar`, external suite URLs)
- [ ] "Coming soon" / "Not in your plan" states match the account's actual plan

## 4. Sign-In Board (`/signin`) — core feature

- [ ] Board loads with live member roster and current event/activity
- [ ] Real-time "Connected" indicator
- [ ] Search-by-name and A–Z index jump
- [ ] Check a member **in** — updates immediately, participant count increments
- [ ] Check the same member **out** — updates immediately
- [ ] **+ Visitor** — add and sign in a one-off visitor
- [ ] **+ New Event** — start an activity/event, becomes "current"
- [ ] End an event — moves to "Past events" with correct duration
- [ ] Dark mode toggle — theme switches and persists
- [ ] `/sign-in` (ungated personal QR/walk-up entry point)

## 5. Member Profile (`/profile/:memberId`)

- [ ] Stats, check-in history, achievements render
- [ ] QR code for the member displays
- [ ] Edit member details (if permitted)
- [ ] Anonymous/no-credential visit to a raw `/profile/:id` URL is blocked
  (negative test — AccessRoute gate)

## 6. Truck Check — manual (`/truckcheck/*`, gated by `truckCheckEnabled`)

- [ ] `/truckcheck` — vehicle roster / appliance list
- [ ] `/truckcheck/select` — template selection
- [ ] `/truckcheck/check/:applianceId` — run a full guided checklist end-to-end
- [ ] Flag a fault/issue mid-check
- [ ] `/truckcheck/summary/:runId` — correct pass/fail/issue rollup
- [ ] `/truckcheck/admin` — history, issue lifecycle/audit trail
- [ ] `/truckcheck/templates/:applianceId` — template editor
- [ ] `/truckcheck/vehicle-types` — vehicle type management
- [ ] Share/QR link for a truck check works
- [ ] `/truckcheck/comparative` — cross-brigade comparative view (gated by
  `reportsEnabled`, not `truckCheckEnabled` — note if the plan has a mismatch)

## 6b. Truck Check — voice agent (`/truckcheck/voice/:applianceId`, gated by `aiEnabled`)

- [ ] Hold-to-talk starts and a response comes back (STT → tool loop → TTS)
- [ ] A basic checklist item can be completed by voice
- [ ] Cross-check against Master Plan Q3/Q4/Q12/Q13/Q28 before logging anything here
  as new — most gaps in this area are already tracked

## 7. Reports & Analytics (`/reports*`, gated by `reportsEnabled`)

- [ ] `/reports` — dashboard stats render with real numbers
- [ ] `/reports/advanced` — heat maps, KPI cards, insight cards
- [ ] `/reports/cross-station` — cross-station comparison (needs 2+ stations)
- [ ] CSV export downloads and opens with correct data
- [ ] Date-range / filter controls actually filter

## 8. Admin — Stations (`/admin/stations`)

- [ ] Station list loads
- [ ] Create a station — respects `maxStations` plan limit
- [ ] Edit a station's details
- [ ] Station lookup / national facilities dataset search
- [ ] Delete a station — confirmation dialog behaves, delete actually removes it
- [ ] "Reset demo station" button (if visible) is clearly scoped to demo data only

## 9. Admin — Brigade Access (`/admin/brigade-access`)

- [ ] Existing device/brigade tokens list
- [ ] Issue a new token — working `?brigade=` sign-in link
- [ ] Revoke a token — stops working immediately (live negative test)
- [ ] QR code for a token renders and is usable for kiosk setup

## 10. Admin — Organization (`/admin/organization`)

- [ ] Current plan, status, entitlements display correctly
- [ ] User/member management within the org (invite, role change)
- [ ] Billing section — Stripe Checkout/Portal links (cross-check Q5 before logging
  as new)
- [ ] Org data export

## 11. Admin — Platform console (`/admin/platform`, operator-only)

- [ ] Organizations tab — cross-org visibility (aggregate counts only)
- [ ] Stations tab — including "orphaned stations" backfill tool
- [ ] Audit log tab
- [ ] Mark N/A if the test account isn't a platform operator, rather than "broken"

## 12. AAR Studio (`/aar`) — the hero feature, test thoroughly

- [ ] `/aar` loads its own shell (not a blank screen / SPA-fallback regression)
- [ ] **Reviews** (`#/home`) — list of past AARs
- [ ] **Details** (`#/setup`) — start a new review, incident details form
- [ ] **Record** (`#/capture`) — live audio capture + transcription
- [ ] **Findings** (`#/board`) — AI findings sort into Sustain / Improve / Action
- [ ] **Edit** (`#/review`) — edit/refine findings
- [ ] **Report** (`#/report`) — generates and exports a polished report
- [ ] Settings (gear icon) — configuration options
- [ ] Service-worker isolation: `/aar` doesn't get the SPA shell (denylist check)

## 13. PWA / Offline

- [ ] Install prompt appears (or note if untestable in this environment)
- [ ] Offline mid-session — check-ins queue locally
- [ ] Reconnect — queued actions sync, offline indicator clears
- [ ] Service worker doesn't serve the SPA shell for `/aar` or `/api`

## 14. Real-time / multi-device sync

- [ ] A check-in in one session appears in a second concurrent session without
  refresh
- [ ] Same for starting/ending an event
- [ ] Same for a new member being added

## 15. Cross-cutting / polish

- [ ] Touch targets ≥60px on kiosk-relevant screens (sign-in board, truck check)
- [ ] Dark mode holds up across every section, not just the sign-in board
- [ ] No console errors on any page tested (list any found)
- [ ] Responsive layout doesn't break at any of the 3 target widths on any page
