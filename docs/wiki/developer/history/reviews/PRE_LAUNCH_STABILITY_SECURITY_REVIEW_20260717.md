# Pre-launch stability, security & safety review — 2026-07-17

**Scope:** Backend API + auth, real-time (Socket.io), deploy pipeline, dependency
posture, and the launch-critical "rock solid, minimal-to-no downtime" ask.
Point-in-time review; findings are ranked by launch risk. One fix was applied in
this pass (F1); everything else is a recommendation for the owner to triage.

**Overall:** the codebase is in good shape for launch. Auth primitives are sound
(JWT fail-fast in prod, bcrypt, signature-verified idempotent Stripe webhooks,
per-IP rate limiting, Helmet/CSP, `requireSession` read gate). The findings below
are a focused list of gaps, not a rewrite. The single most important one (F1) is
an active anonymous data/credential leak and has been fixed in this branch.

---

## Findings

### F1 — `/api/export/*` was anonymously accessible (member roster + QR codes) — **FIXED in this PR**

**Severity: High.** The export endpoints (`/api/export/members`, `/checkins`,
`/events`, `/truckcheck-results`) were mounted in `index.ts` with
`requireFeature('reportsEnabled')` but **without** `requireSession`. `requireFeature`
is a no-op when there is no org context (kiosk/demo/back-compat pass through), so a
fully credential-less caller could `GET /api/export/members` and receive the entire
member roster as CSV — **name, first/last name, rank, member number, and QR code**.
The QR code is the check-in credential, so this is not just a PII leak: it hands an
attacker the tokens needed to check in as any member. `stationMiddleware` defaults a
missing station to `DEFAULT_STATION_ID`, and the `X-Station-Id` header is
attacker-controlled, so any station's roster was reachable.

This is the exact class of hole the 2026-06-22 UAT fix
([UAT_REVIEW_20260622](UAT_REVIEW_20260622.md)) closed on
members/reports/truck-checks by adding `requireSession({ readsOnly: true })` — but
`/api/export` was missed in that sweep. It also contradicts the MASTER_PLAN's
**AC-4 consistency-sweep** assumption ("Reports and admin are already auth-gated …
confirm nothing else exposes a walk-up surface") and Feature #15's "✅ no remaining".

**Fix applied:** mounted `requireSession({ readsOnly: true })` on `/api/export`,
mirroring the adjacent `/api/reports` line exactly. Admin exporters carry a JWT and
kiosks carry a brigade token, so legitimate callers are unaffected; the demo station
stays open. Backend typecheck clean; the 15 existing export-route tests still pass.

**Follow-up (not done here):** the export gate is not integration-tested. The
`export.test.ts` suite mounts the router on a bare Express app *without* the
`index.ts` middleware chain, so it passed all along and gave false confidence. Add a
test that asserts `401` for an anonymous non-demo request against the fully-wired app
(this is the pattern that would have caught F1). Applies to reports/members too.

### F2 — No zero-downtime deploy (every push is a hard restart) — **tracked as decision D6**

**Severity: High for the stated launch goal ("minimal to no downtime").** The
pipeline deploys `release.zip` straight onto the live `bungrfs-linux` app and then
runs `az webapp restart`, and post-deploy smoke tests run *after* the new code is
already live. Each deploy is therefore a 2–3 minute outage that also drops every open
Socket.io connection mid-shift. This is already captured as open decision **D6**: the
CI-side graceful slot-swap detection shipped (#649), but the staging slot itself is
not created because it needs an App Service tier upgrade (B1 → Premium P1v2+), which
is an unmade spend decision.

**Recommendation for launch:** this is the one item that directly blocks the
"rock solid, no downtime" requirement. Create the staging slot and enable
swap-with-preview + a warm-up health-check ping. The CI already swaps if a slot
exists, so the only action is the tier upgrade + slot creation. Until then, deploys
should be scheduled outside brigade operational hours. Also configure an Azure
**health-check path** (`/health`) so the platform gates the swap on readiness — today
nothing does.

### F3 — No `unhandledRejection` / `uncaughtException` process handlers

**Severity: Medium (availability).** There are no `process.on('unhandledRejection')`
or `process.on('uncaughtException')` handlers anywhere. The many `async` Socket.io
event handlers and route handlers mean a single un-awaited rejection (e.g. a Table
Storage blip inside a fire-and-forget path) can crash the process. Winston's
`exitOnError: false` only covers logging transports, not app rejections. On a single
App Service instance a crash is a full outage until the platform restarts it.

**Recommendation:** add top-level handlers that log via `logger.error` and flush App
Insights. For `uncaughtException`, log and exit cleanly so the platform restarts a
known-good process; for `unhandledRejection`, log loudly (and treat as a bug to fix).
Pair with an instance count ≥ 2 so a restart is never a total outage.

### F4 — AI gateway endpoints have no authentication

**Severity: Medium (cost / abuse).** `POST /api/ai/chat` and `POST /api/ai/report`
have no auth middleware, and `passesAiGate` returns `true` whenever there is no org
context. An anonymous caller can therefore drive the server-side Azure OpenAI gateway
directly; usage is only metered when an org is known, so anonymous calls burn credits
unmetered. The only bound is the per-IP `apiRateLimiter` (~84 requests / 5 min), which
is generous for an LLM cost surface and trivially spread across IPs. `POST /api/ai/speech/token`
has the same shape (bounded only by the allowance gate when an org is present).

**Recommendation:** require a session (JWT, brigade token, or member-session) on the
AI routes, or apply a much tighter dedicated rate limiter to `/api/ai/*`. Decide the
intended anonymous-AAR story explicitly (MASTER_PLAN A2 tracks AAR identity).

### F5 — Brigade-access token endpoints are only `optionalAuth`

**Severity: Medium (privilege / enumeration), conditional on `REQUIRE_AUTH`.**
`POST /api/brigade-access/generate`, `GET /api/brigade-access/all-tokens`, and
`/stats` use `optionalAuth`, which enforces auth **only when `REQUIRE_AUTH=true`**.
If that env var is not set in production:
- `/generate` lets anyone mint a working kiosk URL for any `stationId`/`brigadeId`
  (a station-scoped read credential).
- `/all-tokens` dumps **every** active kiosk token across **all** stations, each of
  which grants station-scoped read access — a one-request compromise of every kiosk.

**Recommendation:** confirm `REQUIRE_AUTH=true` is set in the production App Service
settings (verify, don't assume — the default is off). Better: gate these
admin-only routes with `authMiddleware`+`requireAdmin` unconditionally rather than
the env-dependent `optionalAuth`, since minting and listing kiosk credentials is
never a public operation. `all-tokens` returning cross-station data is the sharpest
edge.

### F6 — Manual rollover endpoint is unauthenticated; expiry is lazy

**Severity: Low.** `POST /api/events/admin/rollover` has no auth — any caller can
trigger a rollover pass. Impact is low (it only deactivates already-expired events),
but it's an unauthenticated state-changing "admin" endpoint. Separately, auto-expiry
is **lazy**: `autoExpireEvents` only runs when events are *read* (inside `getEvents`
on both DB twins). There is no scheduled job, so on a quiet station an event can stay
`isActive` well past `EVENT_EXPIRY_HOURS` until someone opens the book. The CLAUDE.md
"midnight rollover" description overstates what actually runs.

**Recommendation:** gate `/admin/rollover` behind `authMiddleware`+`requireAdmin`.
If time-accurate expiry matters, add a lightweight interval (like
`meteredUsageReporter`'s `setInterval`) rather than relying on read-triggered expiry.

### F7 — Socket.io events accept unauthenticated, unvalidated payloads

**Severity: Low–Medium.** Any connected client can emit `join-station` with an
arbitrary `stationId` (station IDs are not secrets) and then emit `checkin`,
`activity-change`, `member-added`, `event-created/ended`, `participant-change`. The
server rebroadcasts the raw client payload to everyone in `station-<id>` with no auth
check and no schema validation. A malicious client that guesses/knows a station ID can
inject spoofed real-time updates onto every kiosk in that station (the REST layer is
the source of truth, so this is display-spoofing, not persisted corruption — but on
kiosks it's still disruptive).

**Recommendation:** require the same brigade/member-session credential on socket
`join-station` that the REST reads require, and validate event payload shapes before
rebroadcast. Track under the D4/AC access work.

### F8 — 30 moderate dependency advisories (backend, transitive)

**Severity: Low.** `npm audit --omit=dev` reports 30 moderate advisories in the
backend, all transitive via Application Insights (`@opentelemetry/*`, `protobufjs`
GHSA-f38q-mgvj-vph7). Frontend production deps: **0 vulnerabilities**. Nothing
critical/high. `npm audit fix` resolves the `protobufjs` one without breaking changes.

**Recommendation:** run `npm audit fix` for the non-breaking set; let Dependabot
(R9) carry the OpenTelemetry bumps. Not launch-blocking.

### F9 — Minor hygiene

- **`web.config` is dead weight.** It's an IIS/Windows config (`iisnode`,
  `<webSocket enabled="false" />`) shipped into a **Linux** App Service deployment,
  where it's ignored. Harmless today, but `webSocket enabled="false"` would break
  Socket.io if this app were ever run on Windows, and its presence is misleading.
  Consider removing it and the Windows framing left in `ci-cd.yml`'s header comments
  (the comments say "Windows/IIS" and `SCM_DO_BUILD_DURING_DEPLOYMENT=false` while the
  env-set step sets it via run-from-package — stale narrative).
- **JWT in `localStorage`** (frontend `api.ts`) is XSS-exposed. Standard SPA
  trade-off and acceptable given the strict CSP; noted for completeness, not action.
- **Health endpoint** returns 200 during DB init (correct, so Azure sees the
  container healthy) and 503 on DB failure — good. Wire it as the Azure health-check
  path (see F2) so it actually gates deploy readiness.

---

## What's solid (verified, no action)

- **JWT secret** fails the process fast in production if unset/default, before any
  module reads it (`index.ts` + `config/jwtSecret.ts`).
- **Stripe webhook** verifies the signature against the raw body (registered before
  `express.json()`), is idempotent via a recorded-event check, and always 200s after
  audit. Textbook.
- **Passwords**: bcrypt via `adminUserDatabase`; signup enforces ≥8 chars; login
  reveals no user-existence oracle in production.
- **CORS** denies unlisted origins without throwing (a throw would 500 same-origin
  asset requests) — the documented seam is handled correctly.
- **File uploads** (member CSV 5 MB, truck-check photos 10 MB) have size limits and
  MIME/extension filters, memory storage.
- **Rate limiting**: sensible per-IP limiter with correct `trust proxy: 1` and
  IPv4:port handling; a stricter `sensitiveActionRateLimiter` on signup/login/org
  mutations.
- **Entitlements** gate on both sides (`requireFeature` + `FeatureRoute`), default-on,
  fail-open only for genuine no-org (kiosk/demo) contexts.

---

## Recommended pre-launch order

1. **F1** — done (merge this PR).
2. **F5** — verify `REQUIRE_AUTH=true` in prod app settings (one-line check, closes
   the biggest conditional hole) and/or harden the brigade-access admin routes.
3. **F2 / D6** — decide the staging-slot spend; it's the only thing standing between
   the current pipeline and the "no downtime" requirement.
4. **F3** — add process-level crash handlers + run ≥ 2 instances.
5. **F4** — gate/limit `/api/ai/*`.
6. **F6, F7, F8, F9** — as capacity allows; none are launch blockers.
