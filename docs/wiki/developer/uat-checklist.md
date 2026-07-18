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
   this file tracks completion state (✅/🟡/⬜) per item but never accumulates
   run-specific narrative or screenshots itself.
3. New findings from a run get folded into `docs/MASTER_PLAN.md`'s queue, not left
   only in the dated review.

**Screenshot convention for a run:** 3 sizes per feature area — **Desktop**
(1440×900), **iPad landscape** (1024×768, the primary kiosk/tablet orientation),
**iPhone** (390×844) — saved to `history/reviews/images/` as
`<page>-<yyyymmdd>-<desktop|ipad|mobile>.png`, referenced from the dated review.

**Status key:** ✅ verified working · 🟡 verified with a filed issue (see linked Q-id)
· ⬜ not exercised this run (needs a real token/device/credential, or out of scope
for the account used) · N/A not applicable to the account/plan under test.

**Last run:** 2026-07-17 — see
[UAT_REVIEW_2026-07-17.md](history/reviews/UAT_REVIEW_2026-07-17.md) for full
narrative, evidence, and the findings list (Q38–Q44 in `MASTER_PLAN.md`; an
initial Q37 finding was retracted the same session — see the review). Q41/Q45
and Q44 were fixed and re-verified live the same session (2026-07-17/18); the
remaining findings (Q38–Q40, Q42, Q43) are still open.

---

## 0. Pre-flight

- [x] Confirm the admin test login reaches `/login` successfully and lands on the
  app picker (`/apps`)
- [x] Note which organization/plan the test account is on (Community / Basic / AI
  Pro) — determines which gated features below are reachable at all
- [x] Note which station(s) the account has access to
- [x] Open DevTools console (or equivalent) and watch for errors across the whole
  run, not just per-page

## 1. Public / Marketing (unauthenticated)

- [x] `/` (logged out) — hero, "What's in the kit" tiles, live-demo mocks, pricing
  table, FAQ accordion, footer links
- [x] Pricing table figures match `backend/src/constants/plans.ts`
- [x] "Try it free" / "Try the demo" / "See plans" CTAs route correctly
- [x] `/signup` — signup form renders (facility-claim conflict path not exercised —
  needs a facility already claimed by another org)
- [ ] `/activate/:token` — account activation (needs a real token to fully exercise)
- [ ] `/invite/:token` — org invite acceptance (needs a real token)

## 2. Authentication

- [x] `/login` — admin username/password sign-in
- [x] Bad credentials show a clear error, no crash
- [x] "Scan Device QR Code" opens the QR scanner modal (camera capture itself
  untestable headless)
- [x] "Setup Guide" (`?`) opens the device setup guide modal
- [x] Already-authenticated visit to `/login` redirects past the form
- [x] Logout returns to the marketing page and actually clears the session

## 3. App picker / Landing (`/`, `/apps`, post-login)

- [x] Tiles for Station Manager, AAR Studio, Fire Break Calculator, Fire Santa Run
  render with correct enabled/disabled state per plan entitlement
- [x] Each tile links correctly (`/signin`, `/aar`, external suite URLs)
- [x] "Coming soon" / "Not in your plan" states match the account's actual plan

## 4. Sign-In Board (`/signin`) — core feature

- [x] Board loads with live member roster and current event/activity
- [x] Real-time "Connected" indicator
- [x] Search-by-name and A–Z index jump
- [x] Check a member **in** — updates immediately, participant count increments —
  confirmed persisting correctly server-side, including for duplicate-named
  members (an initial "Q37" finding was a test-methodology false positive,
  retracted same session — see the dated review)
- [x] Check the same member **out** — updates immediately
- [x] **+ Visitor** — add and sign in a one-off visitor
- [x] **+ New Event** — start an activity/event, becomes "current"
- [x] End an event — moves to "Past events" with correct duration
- [x] Dark mode toggle — theme switches and persists
- [x] Desktop layout stays appropriate once an event is active — fixed same session
  (**Q44**): the grid/three-column choice now persists across reload, and the
  default (until a user picks) is viewport-width-based — desktop starts
  three-column, kiosk/tablet widths keep the touch grid; re-verified live against
  a local dev server at both widths
- [ ] `/sign-in` (ungated personal QR/walk-up entry point) — not exercised this run

## 5. Member Profile (`/profile/:memberId`)

- [x] Stats, check-in history, achievements render
- [x] QR code for the member displays
- [x] Edit member details — name/rank inline edit tested, persists
- [x] Delete member — soft-delete confirmed (native `confirm()` dialog — see **Q42**)
- [x] Anonymous/no-credential visit to a raw `/profile/:id` URL is blocked
  (negative test — AccessRoute gate) — confirmed, bounces to marketing page

## 6. Truck Check — manual (`/truckcheck/*`, gated by `truckCheckEnabled`)

- [x] `/truckcheck` — vehicle roster / appliance list
- [ ] `/truckcheck/select` — template selection page (not separately exercised —
  the check-workflow entry point was used instead)
- [🟡] `/truckcheck/check/:applianceId` — run a full guided checklist end-to-end —
  works correctly **once the appliance is linked to a Vehicle Type**; an unlinked
  appliance fake-passes with 0 items (**Q38**)
- [x] Flag a fault/issue mid-check — description + photo option, saves correctly
- [x] `/truckcheck/summary/:runId` — correct pass/fail/issue rollup, declaration +
  submit works
- [x] `/truckcheck/admin` — history, issue lifecycle/audit trail (open → acknowledge
  → resolve, all in-app modals, no native dialogs)
- [ ] `/truckcheck/templates/:applianceId` — standalone template editor route not
  separately exercised (vehicle-type checklist editing was, via Vehicle Types)
- [🟡] `/truckcheck/vehicle-types` — vehicle type management — page loads and lists
  correctly; linking flow has **Q39** (duplicate indistinguishable dropdown entries)
- [ ] Share/QR link for a truck check — not exercised this run
- [x] `/truckcheck/comparative` — loads correctly, gated by `reportsEnabled` as
  documented (this account has both, so no mismatch to observe)

## 6b. Truck Check — voice agent (`/truckcheck/voice/:applianceId`, gated by `aiEnabled`)

- [ ] Hold-to-talk starts and a response comes back (STT → tool loop → TTS) — no
  mic/audio hardware in this environment; route reachability + gating confirmed only
- [ ] A basic checklist item can be completed by voice — not testable headless
- [x] Cross-checked against Master Plan Q3/Q4/Q12/Q13/Q28 — all still open/tracked,
  nothing new found

## 7. Reports & Analytics (`/reports*`, gated by `reportsEnabled`)

- [x] `/reports` — dashboard stats render with real numbers
- [x] `/reports/advanced` — heat maps, KPI cards, insight cards render
- [x] `/reports/cross-station` — page loads correctly (only 1 station with data, so
  cross-station comparison itself not meaningfully exercised)
- [x] Export downloads and opens with correct data — no plain "CSV" option, tested
  "Export as Excel" (valid .xlsx)
- [x] Date-range / filter controls actually filter — confirmed via range change

## 8. Admin — Stations (`/admin/stations`)

- [x] Station list loads
- [x] Create a station — succeeded (`maxStations` limit not hit on AI Pro/unlimited)
- [x] Edit a station's details — status (active/inactive) toggle tested
- [ ] Station lookup / national facilities dataset search — not meaningfully
  testable without a real geolocation/network path in this environment
- [🟡] Delete a station — **Q40**: confirmation dialog blocked deleting a genuinely
  empty station, reporting another station's data counts; deactivate works as a
  fallback and was used instead
- [ ] "Reset demo station" button — not visible on this account/org

## 9. Admin — Brigade Access (`/admin/brigade-access`)

- [x] Existing device/brigade tokens list
- [x] Issue a new token — working `?brigade=` sign-in link, verified live
- [x] Revoke a token — stops working immediately (403), confirmed via live negative
  test
- [x] QR code for a token renders (Copy-link mechanism tested directly via clipboard)

## 10. Admin — Organization (`/admin/organization`)

- [x] Current plan, status, entitlements display correctly
- [x] User/member management within the org — members table renders; add/invite UI
  present (not exercised — would need a second real account)
- [x] Billing section — Stripe Checkout/Portal links — confirmed live Stripe
  Customer Portal redirect with the real subscription
- [x] Org data export — valid JSON downloaded

## 11. Admin — Platform console (`/admin/platform`, operator-only)

- N/A — `Richard BT` is not a platform operator; page correctly shows "Not
  authorised" rather than crashing or leaking data. Deeper testing needs an
  operator account.

## 12. AAR Studio (`/aar`) — the hero feature, test thoroughly

- [x] `/aar` loads its own shell (not a blank screen / SPA-fallback regression)
- [x] **Reviews** (`#/home`) — lists local + team-synced reviews correctly
- [x] **Details/Record** (`#/capture`) — typed-transcript path exercised end to end
  (live audio untestable headless)
- [x] **Findings** (`#/board`) — AI-generated findings, correctly categorized across
  all 4 phases with source quotes — fully working (June 22 AI-gateway blocker
  confirmed resolved)
- [x] **Edit** (`#/review`) — findings editable, persists
- [x] **Report** (`#/report`) — "Generate with AI" produced a polished, complete
  report in ~20s — fully working
- [ ] Settings (gear icon) — not exercised this run
- [x] Service-worker isolation: `/aar` doesn't get the SPA shell (denylist check) —
  confirmed, loads its own shell correctly

## 13. PWA / Offline

- [x] Service worker registers at scope `/` (didn't reach `active` in a single
  fresh headless load — expected for a first visit)
- [ ] Install prompt — not testable headless
- [ ] Offline mid-session / reconnect sync — needs a real device session across
  multiple loads, not reliably testable in a fresh-context-per-run harness
- [x] Service worker doesn't serve the SPA shell for `/aar` or `/api` — confirmed
  via direct reachability of both

## 14. Real-time / multi-device sync

- [x] A check-in in one session appears in a second concurrent session without
  refresh — **confirmed working** for the primary kiosk/brigade-token deployment
  pattern (raw WebSocket frame capture verified `join-station` → `joined-station` →
  live `event-update` push)
- [x] Same test between two **admin-JWT** sessions — fixed same session
  (**Q41**): `StationContext` now auto-resolves a station for a normal-mode
  admin, so `join-station` fires correctly; re-verified live against a local
  dev server with raw WebSocket frame capture
- [x] Same for starting/ending an event — confirmed working (kiosk path)

## 15. Cross-cutting / polish

- [x] Touch targets ≥60px on kiosk-relevant screens (sign-in board, truck check) —
  visual check at iPad size, looks correct
- [x] Dark mode holds up across every section tested, not just the sign-in board
- [🟡] No console errors on any page tested — **Q42**: analytics beacons (Clarity,
  Cloudflare Insights) blocked by CSP on every load; a stray unauthenticated
  `/api/billing/status` call on the public marketing page
- [x] Responsive layout doesn't break at any of the 3 target widths on any tested
  page (one screenshot-capture artifact noted and corrected — see the dated review;
  not a product bug)
