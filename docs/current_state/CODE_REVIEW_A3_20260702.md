# Code Review — A3 Voice Agent (inc 1–3), 2026-07-02

Point-in-time review of the voice-agent surface shipped in PRs #606 (inc 1) and
#607 (inc 2 + 3). Scope: `git diff` of the two inc 2/3 commits plus the inc 1
plumbing. **No code was changed by this review** — these are findings for a
later agent to fix, ranked by severity. Each has been verified against source.

The dominant theme: the **raw WebSocket at `/ws/agent-check` bypasses every
guard the REST layer enforces** (tenancy, entitlement gating, rate limiting,
payload caps). Inc 1 added the endpoint with JWT-only auth as a "stub"; inc 2/3
turned it into the primary, cost-incurring surface without back-filling those
guards. Fix the tenancy + entitlement items (F1–F3) before this feature is
exposed to more than one trusted org.

---

## Security / tenancy (fix before wider rollout)

### F1 — WS `applianceId` has no org/station scoping (cross-tenant read **and write**) — CRITICAL
- **Where:** `backend/src/routes/agentCheck.ts` (upgrade handler, ~line 116, `applianceId` from `url.searchParams`); `backend/src/services/agentTools.ts` `AgentToolExecutor.getAppliance()` calls `getApplianceById(applianceId)` with no tenant filter.
- **Problem:** Every REST truck-check route runs through `stationMiddleware`/`requireSession` and scopes by station/org. The WS takes `applianceId` straight from the query string and never checks it belongs to the caller's org/station.
- **Failure:** An authenticated user from org A connects with `?applianceId=<org B appliance id>`. `get_appliance_context` returns org B's `quirksNotes`, full checklist, zones and equipment; `record_result`/`complete_run` write bogus `CheckRun` results into org B's formal truck-check history.
- **Fix direction:** Resolve the appliance, look up its `stationId`/org, and reject the upgrade (or the first turn) when it doesn't match the caller's `organizationId`/station — mirror `stationMiddleware`. Consider passing the resolved appliance into `AgentToolExecutor` so tools can't re-widen scope.

### F2 — `GET /api/agent-sessions/:id` and `/:id/turns` have no ownership check (cross-tenant transcript read) — HIGH
- **Where:** `backend/src/routes/agentCheck.ts` REST handlers (~line 43); only `authMiddleware` is applied.
- **Problem:** Any authenticated JWT (any org) that obtains or guesses a session id reads the full transcript — member names, appliance quirks, defect details echoed in tool payloads. Contrast `routes/aarSessions.ts`, which scopes every read by `req.user.organizationId`.
- **Failure:** User enumerates/obtains a session id → `GET /api/agent-sessions/<id>/turns` → another brigade's voice transcript.
- **Fix direction:** Store `organizationId` on `AgentSession` (it isn't captured today) and filter reads by it, exactly like `aarSessions`. Note this needs a field add to `AgentSession` + both twins.

### F3 — WS endpoint is not entitlement-gated (`aiEnabled` bypass → unpaid Azure spend) — HIGH
- **Where:** `backend/src/index.ts` mounts the REST router behind `requireFeature('aiEnabled')`, but `attachAgentCheckWs` (`agentCheck.ts`) only calls `jwt.verify` on upgrade.
- **Problem:** Plan gating is enforced on the cheap REST reads but **not** on the expensive streaming surface. CLAUDE.md's rule: *"a gated feature must be wrapped on both sides (FeatureRoute + requireFeature)."* The WS has neither `requireFeature` nor any equivalent.
- **Failure:** A Community/Basic-plan org user (no `aiEnabled`) is blocked from `/api/agent-sessions` but connects to `/ws/agent-check` and drives unlimited STT + GPT + TTS turns — Azure spend the org never paid for.
- **Fix direction:** After JWT verify, load the org (reuse `attachOrganization`'s decode) and reject the upgrade unless entitlements allow `aiEnabled` (respecting the no-org kiosk/demo pass-through only where intended — and note kiosk/demo probably should *not* get free AI).

### F4 — No rate limiting / per-session turn cap on the WS (unbounded cloud spend / AI-budget DoS) — MEDIUM-HIGH
- **Where:** `agentCheck.ts` — `apiRateLimiter` only wraps HTTP routes; `MAX_TOOL_ITERATIONS` caps tool calls *within one turn* but nothing caps turns per connection, connections per user, or `user-text` length.
- **Failure:** One credential opens many concurrent sockets (or loops `user-text` frames) with long bodies; each turn fans out to Azure OpenAI + TTS with no throttle.
- **Fix direction:** Per-user connection cap, per-session turn cap (and total-duration cap), and a `user-text` length limit fed into the loop; consider a monthly session/minute budget tied to entitlements (`aiIncludedSessions` already exists for AAR).

### F5 — No `maxPayload` on the WS; large JSON text frames buffered + parsed — MEDIUM
- **Where:** `agentCheck.ts` `new WebSocketServer({ noServer: true })` — no `maxPayload`. Only binary utterance chunks are bounded (`MAX_UTTERANCE_BYTES`). `ws` v8 default `maxPayload` is 100 MiB.
- **Failure:** A client sends a ~100 MiB JSON text frame (huge `user-text.text`); the server buffers and `JSON.parse`s the whole thing — memory/CPU spike per connection, repeatable across sockets to exhaust the instance.
- **Fix direction:** Set `maxPayload` on the `WebSocketServer` (e.g. a few MB) and cap `msg.text` length before use.

### F6 — JWT passed in the WS URL query string (`?token=`) leaks into logs — MEDIUM
- **Where:** `frontend/src/features/truckcheck/voice/voiceAgentClient.ts` (~line 53) builds `...?token=<jwt>`; the server also accepts the `Authorization` header path.
- **Failure:** App Service / reverse-proxy request logging or an APM trace captures `/ws/agent-check?token=<jwt>…`; anyone with log access replays a live bearer token until expiry. (Browsers don't put WS URLs in history, but server/proxy logs and devtools do.)
- **Fix direction:** Prefer the `Sec-WebSocket-Protocol` subprotocol or a short-lived one-time ticket over the query param. At minimum, redact `token` from any URL logging.

---

## Stability / UX

### F7 — Voice check is broken in local dev: WS targets the Vite origin, not the backend — MEDIUM (dev), clear defect
- **Where:** `voiceAgentClient.ts` builds `ws://${window.location.host}/ws/agent-check`. In dev `window.location.host` is the Vite server (`:5173`); there is **no `/ws` proxy** in `frontend/vite.config.ts` (no proxy block at all). REST (`api.ts`) and Socket.io (`useSocket.ts`) both correctly target `http://localhost:3000` in dev via `import.meta.env.PROD ? window.location.origin : 'http://localhost:3000'`.
- **Failure:** `npm run dev` → open Voice Check → WS connection fails (nothing serves `/ws` on :5173); the feature is untestable locally.
- **Fix direction:** Follow the `useSocket` precedent — derive the WS base from `VITE_SOCKET_URL`/`import.meta.env.PROD ? window.location : 'localhost:3000'` and swap the scheme to `ws(s)`. (Convention: the repo already has one WS-origin pattern; this diverged from it.)

### F8 — Agent audio replies are silently dropped on iPad (iOS Safari autoplay policy) — HIGH (primary kiosk device)
- **Where:** `frontend/src/features/truckcheck/voice/audioIO.ts` `playAudioBlob()` — `new Audio(url).play()` is triggered by an inbound WS `agent-audio` frame, **not** a user gesture.
- **Problem:** iOS Safari (the iPad kiosk target named throughout CLAUDE.md) blocks `HTMLMediaElement.play()` outside a user-gesture call stack. The reply plays on desktop but is silently swallowed on iPad → the whole point of a *voice* agent (spoken read-back) is lost on the primary device, with no error shown.
- **Related capture risk:** `MicCapture.start()` creates `new AudioContext()` **after** `await getUserMedia(...)`; the user-gesture window may have closed by then, so the context can start `suspended` on iOS → zero audio captured, no error. Add an explicit `await context.resume()` and verify on device.
- **Fix direction:** Unlock an `HTMLAudioElement`/`AudioContext` during the initial hold-to-talk gesture (play a silent buffer) and reuse it for playback; surface a visible fallback if playback is blocked. **Must be verified on a real iPad** — jsdom tests can't catch this.

### F9 — No WS reconnect; a dropped socket is a dead-end and orphans the CheckRun — MEDIUM
- **Where:** `VoiceCheckPage.tsx` `onClose` sets `connection = 'closed'` with no retry affordance; the WS close handler in `agentCheck.ts` marks the session `aborted` but the formal `CheckRun` (created lazily by the first `record_result`) is left `in-progress`.
- **Failure:** App Service's 60 s idle drop or a restart kills the socket mid-check; the member sees "Disconnected" with no reconnect button and loses the transcript, and the partially-completed `CheckRun` lingers as a phantom "In progress" entry in admin history (same class as the UAT "Cancel leaves phantom run" issue fixed for the manual flow).
- **Fix direction:** Add reconnect-with-backoff (mirror `useSocket`), rehydrate the session/transcript on reconnect (the turns are persisted — `GET /:id/turns` exists), and decide a lifecycle for an aborted run's `CheckRun` (leave `in-progress`, or mark it and badge it like the manual path already does).

---

## Lower-value / already-tracked

- **API registry not updated.** CLAUDE.md: *"If an API endpoint was added/changed → also update `docs/api_register.json` and `docs/API_DOCUMENTATION.md`."* The WS endpoint and `GET /api/agent-sessions/:id[/turns]` are not registered. Deliberately deferred in the PR until the WS contract is final — do it when F1–F6 settle the contract.
- **iPad screenshots** for the Voice Check page are pending (CLAUDE.md requires them for UI PRs); tied to F8's on-device verification.
- **`🎙 Voice Check` button visibility on kiosk/demo/single-tenant.** `hasFeature()` returns `true` when no entitlements are loaded, so the button shows on single-tenant/demo deployments where Azure may be unconfigured; tapping it degrades to 503-style error frames rather than being hidden. Cosmetic; decide intended behaviour alongside F3.

---

## Verified-not-a-bug (checked, no action)

- **Table-twin `completeCheckRun` preserving `source`/`agentSessionId`:** re-fetches the full entity via `getEntity` and `updateEntity(..., 'Replace')`, so the new columns survive round-trip. OK.
- **SSML injection via TTS:** `escapeXml` encodes `& < > " '` before interpolating LLM text into `<voice>`; voice/language come from server env. Not exploitable.
- **`resolveEffectiveChecklist` extraction:** byte-for-byte move into `services/effectiveChecklist.ts`; route behaviour unchanged.
