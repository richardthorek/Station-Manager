# UAT Review — June 22, 2026

## Overview
Hands-on user acceptance test of the production deployment (`bungrfs-linux.azurewebsites.net`, branded "Bushie Tools") via live browser automation. Covered the full new-signup flow, sign-in/check-in, truck check, reports, admin (organization/stations/brigade access), profile, AAR Studio, and a logged-out/anonymous-access pass. Every write action was performed against a real new test organization, not a mock.

## Review Methodology
- **Method**: Live browser automation (Claude-in-Chrome) against the production URL — no staging environment used.
- **Test org**: "Bushie UAT Brigade", Community (free) plan, created via `/signup`, owner `uat-admin`.
- **Review date**: June 22, 2026
- **Scope**: Every page in the app picker, every primary action on each page, plus a deliberate logged-out/anonymous pass against the API directly (DevTools `fetch()`), since the kiosk-bypass design (CLAUDE.md) makes auth boundaries worth checking explicitly rather than assuming the UI's gating reflects the API's.
- **Screenshots**: Captured live during the session for nearly every page and bug repro (login, marketing/landing, signin board, truckcheck hub, the truck-check 0/0-items bug, the reports data-leak screen from two independent tabs, the AAR Studio bypass screen). These exist as image files on the operator's machine from this session but were not placed into `docs/current_state/images/` — the automation tool's "save to disk" target is outside the sandbox this review was written from, and there was no available path to move them into the repo programmatically. **Follow-up**: if you want them embedded here, the fastest path is for you to drop them into `docs/current_state/images/` (named per the existing `<page>-20260622-<orientation>.png` convention) and re-run this review pass, or tell me where they landed and I'll move them.

## Results summary

| Severity | Count | Examples |
|---|---|---|
| Blocker | 3 | Anonymous data exposure (reports/members/appliances APIs); Truck Check has no working configuration (0-item fake-pass on unlinked vehicles, 400 on Vehicle-Type-linked results); Stripe billing not configured — no upgrade path exists |
| Should-fix | 6 | AAR Studio direct-nav bypasses plan gate; vehicle create 403 with no error toast; template-fetch 404 hangs the dashboard; org-admin page rate-limits after ~5 normal loads; module-toggle clamp reports false "Updated"; 5-vehicle ceiling not enforced/communicated on Community plan |
| Minor | 5 | App-picker Reports card inconsistent with other locked cards; stale PWA double service-worker registration log; Join Check doesn't resume; Cancel leaves a phantom "completed" history entry; `/login` and `/profile/:memberId` noticeably slower to settle than other routes |

Full narrative detail for every row below, ordered by section walked.

## Findings by area

### 0 — Setup, signup, first load
Marketing page renders cleanly logged out, no console errors. Signup created the org and landed authenticated on `/admin/organization` with no friction. Two `[PWA] Service worker registered` log lines fired on the same load — looks like the SW registers twice per page load; low severity but worth a five-minute look.

### Sign-In (`/signin`)
The strongest feature in the app. Full lifecycle tested clean: start an event, toggle members in/out (live counter, correct highlighting), end the event, reopen/expand a past event with per-participant sign-out timestamps. No console errors anywhere in this flow. Keyboard navigation also checked out: visible focus ring on every control, a working skip-to-content link, no keyboard trap.

### Truck Check (`/truckcheck`) — blocker
A brand-new Community-plan org lands with 5 pre-seeded demo appliances, none of which have a linked Vehicle Type or template. Running a check against any of them (tested on Cat 1, Bulk Water, Cat 7) skips straight to "All Items Completed! 0 of 0 items completed (NaN%)" — the write succeeds and the appliance flips to "Checked today," but the inspection itself is a no-op dressed as a 100% pass. This reproduces on every seeded appliance.

Linking a vehicle to a Vehicle Type (created fresh via the Vehicle Types authoring screen, which itself worked correctly — add/remove/reorder checks all behaved) does load the real checklist, but clicking **Done** or **Skip** on the very first item throws a full-page "Failed to save result" error. `POST /api/truck-checks/results` returns 400. Reproduced three times, both actions, same result. **There is currently no path to successfully complete a Truck Check on this deployment** — unlinked vehicles fake-pass with zero items, and linked vehicles 400 out on the first real item. This should be the next engineering priority after the data-exposure issue below, since Truck Check is a marketed v1.1 feature that doesn't function at all right now.

Secondary issues in this area: "Add New Vehicle" silently 403s past 5 appliances on Community with no error toast (just an infinite spinner) — worth surfacing the rejection and reconciling it with the plan card's advertised "1 vehicle" limit, since 5 are already seeded. "Template" on any vehicle without a saved per-vehicle override hangs the dashboard indefinitely (`GET /api/truck-checks/templates/:id` 404, unhandled rejection) — should treat 404 as "use Vehicle Type defaults," not throw. Cancelling out of an unsubmitted check still leaves it marked "Completed by: [name]" in history, and "Join Check" doesn't actually resume shared progress, it just re-prompts for a name — both low severity until the items above are fixed, since right now no check actually gets that far.

### Reports / Members / Truck Check data — blocker (security)
While logged out — confirmed genuinely logged out via a fresh `document.cookie` check and a direct `fetch('/api/auth/me')` returning 401 — navigating to `/reports` no longer shows the expected upgrade wall. It renders the full dashboard with real numbers (Health Score 42 "NEEDS ATTENTION," 25% truck-check compliance, average check-ins per period). Probing the underlying endpoints directly with `fetch(url, {credentials: 'omit'})` from a brand-new tab confirms it's not a caching artifact: `/api/reports/attendance-summary`, `/api/reports/member-participation`, `/api/reports/activity-breakdown`, `/api/reports/event-statistics`, `/api/reports/truckcheck-compliance`, `/api/truck-checks/appliances`, and `/api/members` all return **200 with real data** to a fully anonymous request — no cookie, no token, no station context. For contrast, `/api/auth/me`, `/api/organizations/current`, and `/api/billing/status` correctly return 401 for the identical request, so authentication enforcement clearly exists and works on those routes — it's specifically missing on the reports and members read paths.

CLAUDE.md documents that requests with no org context intentionally pass through entitlement checks, by design, for kiosk/demo convenience on sign-in and truck-check actions. That's a reasonable default for a station kiosk taking write actions. It's a different and much higher-risk problem when it applies to analytics and member-PII *read* endpoints: any anonymous visitor who finds the URL gets a real brigade's attendance history, member names, and compliance data, with no account at all — not even a free signup. This is more severe than the AAR Studio gap below because it requires zero credentials. Recommend treating this as the top engineering priority, ahead of the Stripe gap: `reports` and `members` routes should require an authenticated session (or at minimum a valid station/kiosk token) before returning data, while write-path kiosk actions keep their current pass-through behaviour.

### AAR Studio (`/aar/`) — should-fix
`/reports` correctly hits the `FeatureRoute` upgrade wall while authenticated ("Reports isn't on your plan"). `/aar/` does not have an equivalent gate: direct navigation loads the full UI (Reviews/Record/Findings/Report tabs, "Start recording now") on a Community-plan org with `aiEnabled` off, console clean, no entitlement check observed anywhere in the flow. Because AAR Studio is a separate static bundle outside the SPA's router, the locked card on the app picker is cosmetic only — it doesn't stop direct navigation. Needs an entitlement check inside `aar-studio/` itself on load (`GET /api/auth/entitlements` is already built and exactly fits this).

### Admin — Organization, Stations, Brigade Access
Generating a kiosk token and showing its QR code worked correctly for two independently created stations. Creating a second station on Community succeeded with no ceiling, warning, or upsell — matches the already-known "`maxStations` unenforced" gap in this plan's roadmap, now confirmed live in production. Toggling the "Reports & analytics" module checkbox triggered a 429 "Too many requests" banner after only about 5 page loads in four minutes — `GET /api/organizations/current` and `.../users` are both hitting the 5-requests/15-minutes auth-tier rate limiter, which is far too aggressive for a legitimate owner reviewing their own settings right after signup, and the banner gives no indication of why or how long to wait. Re-testing after the window cleared: clicking the same checkbox on Community shows a green "Updated" success banner, but the checkbox silently reverts and stays unchecked after reload — the override is correctly clamped to the plan ceiling server-side, but the UI claims success regardless, which will read to a real owner as "I just turned this on."

Both "Upgrade to Basic" and "Upgrade to AI Pro" return "Billing is not configured on this server," confirmed on both buttons independently. There is currently no working path on this deployment to move an org off the free plan — this matches CLAUDE.md ("Stripe checkout/portal/webhooks... not yet wired") but contradicts `README.md`'s claim that Stripe is wired in test mode. Recommend wiring `STRIPE_SECRET_KEY`/price IDs on the App Service config, or pulling the Upgrade buttons and correcting the README until billing is live — this is revenue-blocking, not just a UAT note, since nobody can convert from free today.

### Profile (`/profile/:memberId`)
Functionally correct top to bottom: inline name/rank edit, stat cards, empty-state timeline for a never-checked-in member, working QR code, edit/delete actions. Took roughly 5 seconds to settle before rendering — noticeably slower than every other route tested. Worth a look at what mounts eagerly (possibly full check-in history fetched up front), not severe enough to call a functional bug.

### App picker (logged in)
"Reports & Analytics" renders as a fully active card even though Reports is off for this org — clicking through correctly hits the upgrade wall, so it's UX inconsistency rather than a gating gap. AAR Studio, Fire Santa Run, and Fire Break correctly show a locked pill directly on the card. Recommend Reports follow the same pattern as the other locked cards.

### Final smoke test
Logout returned cleanly to the marketing page with no console errors. `/login` took roughly 3.5 seconds to settle, briefly showing stale content then an unstyled form before resolving to full branding — same pattern as the profile page above, likely a slow lazy-loaded chunk rather than a missing-CSS issue. Re-login with the test account was not completed in this session (the test password wasn't retained across a context boundary) — this is a testing-process gap, not a product finding.

## Recommendations, in priority order
1. Require authentication (or a valid station/kiosk token) on the reports and members read endpoints — currently the single highest-risk item in production.
2. Fix `POST /api/truck-checks/results` against Vehicle-Type-linked appliances (400 on every item), and stop the empty-checklist fake-pass on unlinked appliances — Truck Check does not currently work in any configuration.
3. Wire Stripe (or pull the Upgrade buttons and correct the README) — no revenue path exists today.
4. Add an entitlement check inside `aar-studio/` on load.
5. Loosen or scope the rate limiter away from idempotent org-admin GETs, and give the 429 banner a retry-after message.
6. Surface the vehicle-create 403 and the module-toggle clamp as honest UI feedback instead of silence/false-success.
