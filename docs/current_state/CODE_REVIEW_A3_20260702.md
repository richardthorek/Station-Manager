# Code Review — A3 Voice Agent (inc 1–3), 2026-07-02

Point-in-time review of the voice-agent surface shipped in PRs #606 (inc 1) and
#607 (inc 2 + 3). Scope: `git diff` of the two inc 2/3 commits plus the inc 1
plumbing. **No code was changed by this review** — these are findings for a
later agent to fix, ranked by severity. Each has been verified against source.
Updated with a second review pass (same day) that traced a real concurrency
bug end-to-end and found several defects the first pass missed.

Two dominant themes:
1. **The raw WebSocket at `/ws/agent-check` bypasses every guard the REST
   layer enforces** (tenancy, entitlement gating, rate limiting, payload caps).
   Inc 1 added the endpoint with JWT-only auth as a "stub"; inc 2/3 turned it
   into the primary, cost-incurring surface without back-filling those guards.
   Fix the tenancy + entitlement items (F1–F3) before this feature is exposed
   to more than one trusted org.
2. **`AgentSession` state is mutated from two independent, uncoordinated
   places** (the tool executor's `complete_run` and the WS close handler),
   and the DB-layer `updateSession` does an unguarded read-modify-write with
   no version check — so the two writers can race and silently clobber each
   other (F10). This is a genuine data-integrity bug, not just a tenancy gap.

**Suggested fix order:** F1–F3 (tenancy/entitlement — blocks rollout) → F10/F11
(session race + the frontend dead-end it causes — data integrity) → F8/F9
(iPad audio + orphaned-run lifecycle — the feature is unusable/dangerous on the
primary kiosk device and can brick an appliance without them) → F4–F7, F12–F16
(hardening/UX polish) → conventions/reuse items (cheap, do opportunistically).

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

### F6 — JWT passed in the WS URL query string (`?token=`) leaks into logs; no Origin check — MEDIUM
- **Where:** `frontend/src/features/truckcheck/voice/voiceAgentClient.ts` (~line 53) builds `...?token=<jwt>`; the server also accepts the `Authorization` header path. `backend/src/routes/agentCheck.ts`'s raw `http.Server.on('upgrade', ...)` handler never checks the `Origin` header — unlike Socket.io on the same `httpServer`, which runs every connection through the `allowedOriginsList` callback in `index.ts`.
- **Failure:** App Service / reverse-proxy request logging or an APM trace captures `/ws/agent-check?token=<jwt>…`; anyone with log access replays a live bearer token until expiry. Separately, because the raw WS upgrade skips the Origin check the rest of the app relies on, any site a victim's browser visits could attempt a cross-site WebSocket to `/ws/agent-check` — the token-in-URL requirement limits practical impact (an attacker page can't read `localStorage['auth_token']` cross-origin), but this is still a second, independent place the app's CORS/origin policy silently doesn't apply.
- **Fix direction:** Prefer the `Sec-WebSocket-Protocol` subprotocol or a short-lived one-time ticket over the query param. At minimum, redact `token` from any URL logging, and add the same `allowedOriginsList` check to the upgrade handler that Socket.io already performs.

---

## Data integrity — session-state race conditions (new, high-confidence)

Three independent finder passes (removed-behavior audit, cross-file trace,
line-by-line scan) converged on the same defect from different angles and
between them traced it to its exact root cause. Presented as one finding with
its two concrete triggers.

### F10 — `AgentSession.status` race between `complete_run` and WS close — HIGH
- **Root cause (confirmed in source):** `tableStorageAgentSessionDatabase.updateSession` (line 171) does an unguarded read-modify-write: `getSession` → spread the patch onto the fetched snapshot → `updateEntity(..., 'Replace')` — **no ETag / optimistic-concurrency check**. Any two concurrent calls to `updateSession` for the same session id will silently lose whichever write's fields aren't in the other's stale snapshot (e.g. one call's `runId` gets reverted by the other's older snapshot).
- **Trigger 1 (completion race):** `AgentToolExecutor.completeRun` (`agentTools.ts:361-372`) does: `await db.completeCheckRun(...)` → `await ensureAgentSessionDatabase().updateSession(id, {status:'completed', ...})` → **then, only after both awaits resolve**, `this.session.status = 'completed'`. The WS close handler (`agentCheck.ts:256-269`) reads `session.status` synchronously at disconnect and, if it's still `'active'` (i.e. the socket dropped in the window between the two awaits and the in-memory flag flip), calls `updateSession(id, {status:'aborted', endedAt})`. Whichever `updateSession` call's RMW cycle finishes last wins — a fully completed check can be **permanently recorded as aborted**, or vice versa depending on await ordering.
- **Trigger 2 (turn-slot race, related but distinct):** the `audio-end` handler (`agentCheck.ts:217-241`) `await recognizeSpeech(...)` (a real network round-trip) **before** ever reaching `runTurnAndReply`, which is the only place `turnInFlight` is checked/set. During that STT-in-flight window, `turnInFlight` is still `false`, so the guard does not apply to any other frame the connection receives. The shipped frontend happens to self-gate (`endHold` sets `busy=true`, disabling the composer, before `audio-end` is even sent) so it's not straightforwardly self-triggerable by the current UI — but this is a **server-side robustness gap reachable by any WS client that holds a valid JWT** (the endpoint is just a WebSocket; nothing requires using the shipped frontend), and a latent trap for the next frontend change that adds a second concurrent input path.
- **Fix direction:** Add an ETag/optimistic-concurrency check to `tableStorageAgentSessionDatabase.updateSession` (Table Storage entities carry an `etag` for exactly this; pass it through `updateEntity`'s `ifMatch` and retry-on-412), and set `turnInFlight = true` at the *start* of `audio-end` (before the `recognizeSpeech` await), not inside `runTurnAndReply`.

### F11 — No `onBusy` handler on the frontend → a `busy` frame permanently disables the UI — HIGH (compounds with F9)
- **Where:** `VoiceCheckPage.tsx`'s `VoiceAgentClient` event object (lines 58-83) defines `onSessionStarted`/`onTranscript`/`onAgentText`/`onAgentAudio`/`onError`/`onClose` — **`onBusy` is not implemented**, confirmed by reading the full object literal. `busy` (React state) is only ever cleared by `onAgentText`, `onError`, and `onClose`.
- **Failure:** Whenever the server legitimately sends `{type:'busy'}` for an action the client already marked itself busy for — which can happen via F10's trigger 2, or via ordinary UI races like a rapid double-tap on the talk/Send button on the actual iPad kiosk hardware racing ahead of a React re-render — the client's `busy` state is never cleared. `canInteract` (`connection==='ready' && !busy && !completed`) stays permanently `false`: the talk button and composer are disabled with **no error shown and no explanation**, and the only recovery is reloading the page, which (per F9) abandons the session and orphans the `CheckRun`.
- **Fix direction:** Implement `onBusy` to clear `busy` and surface a short "still working on the last message, try again" status instead of silently hanging.

---

## Stability / UX

### F7 — Voice check is broken in local dev: WS targets the Vite origin, not the backend — MEDIUM (dev), clear defect
- **Where:** `voiceAgentClient.ts` builds `ws://${window.location.host}/ws/agent-check`. In dev `window.location.host` is the Vite server (`:5173`); there is **no `/ws` proxy** in `frontend/vite.config.ts` (no proxy block at all). REST (`api.ts`) and Socket.io (`useSocket.ts`) both correctly target `http://localhost:3000` in dev via `import.meta.env.PROD ? window.location.origin : 'http://localhost:3000'`.
- **Failure:** `npm run dev` → open Voice Check → WS connection fails (nothing serves `/ws` on :5173); the feature is untestable locally.
- **Fix direction:** Follow the `useSocket` precedent — derive the WS base from `VITE_SOCKET_URL`/`import.meta.env.PROD ? window.location : 'localhost:3000'` and swap the scheme to `ws(s)`. (Convention: the repo already has one WS-origin pattern; this diverged from it.)

### F8 — Agent audio replies are silently dropped on iPad (iOS Safari autoplay policy); mic can silently capture nothing — HIGH (primary kiosk device)
- **Where:** `frontend/src/features/truckcheck/voice/audioIO.ts` `playAudioBlob()` — `new Audio(url).play()` is triggered by an inbound WS `agent-audio` frame, **not** a user gesture; the rejection is caught and only used to revoke the object URL (`.catch(() => URL.revokeObjectURL(url))`), so a blocked play is completely invisible.
- **Problem:** iOS Safari (the iPad kiosk target named throughout CLAUDE.md) blocks `HTMLMediaElement.play()` outside a user-gesture call stack. The reply plays on desktop but is silently swallowed on iPad → the whole point of a *voice* agent (spoken read-back) is lost on the primary device, with no error shown. The member sees the agent's text bubble appear but hears nothing and has no way to know audio was even supposed to play.
- **Capture-side counterpart:** `MicCapture.start()` creates `new AudioContext()` **after** `await getUserMedia(...)` and never checks `context.state` or calls `.resume()`. On iOS the context can start (or end up) `suspended` if the permission-prompt delay breaks the gesture chain; `onaudioprocess` still fires but delivers silence, so the UI shows "Listening…" the whole time while zero real audio reaches the server — every utterance ends in "I did not hear anything" with no indication why.
- **Fix direction:** Unlock an `HTMLAudioElement`/`AudioContext` during the initial hold-to-talk gesture (play a silent buffer) and reuse it for playback; explicitly check `context.state` and `await context.resume()` in `MicCapture.start()`. **Must be verified on a real iPad** — jsdom tests can't catch either half of this.

### F9 — No WS reconnect; a dropped socket orphans the CheckRun and can permanently brick the appliance — HIGH (upgraded from MEDIUM)
- **Where:** `VoiceCheckPage.tsx` `onClose` sets `connection = 'closed'` with no retry affordance; the WS close handler in `agentCheck.ts` marks the session `aborted` but the formal `CheckRun` (created lazily by the first `record_result`, via `AgentToolExecutor.ensureRun`) is left `in-progress` with no cancel/expiry path anywhere in `routes/truckChecks.ts`.
- **Failure — worse than "loses the transcript":** `getActiveCheckRunForAppliance` (`truckChecksDatabase.ts`) is what both the manual "Start/Join Check" flow and the voice agent use to find the current run for an appliance. Once a voice check is abandoned mid-way, **every subsequent check on that truck — voice or manual — resolves to and force-joins the same stuck `in-progress` run**, because nothing ever calls `completeCheckRun` or a cancel/abandon equivalent for it. The appliance is effectively un-checkable (new checks just append to a run nobody is actively working) until an operator manually intervenes in the data.
- **Compounding cause:** `ws.ping()` (30 s keepalive) has no pong/timeout tracking — if a connection dies without a clean TCP close (e.g. a cellular radio drop on an iPad, or the OS suspending a backgrounded PWA), `ws.on('close')` may never fire, so `clearInterval(client.pingTimer)` never runs and the `AgentSession` is never marked `aborted` at all — it (and its linked `CheckRun`) sit as phantom `active`/`in-progress` records indefinitely, well beyond the already-bad "reload loses the transcript" case.
- **Fix direction:** Add reconnect-with-backoff (mirror `useSocket`), rehydrate the session/transcript on reconnect (the turns are persisted — `GET /:id/turns` exists), add a real pong-timeout to detect and clean up dead connections, and give the manual admin UI (or a scheduled sweep) a way to cancel/expire a stale `in-progress` run so a botched voice check can't permanently block the truck.

---

## Additional correctness gaps (new)

### F12 — Voice agent never joins an already-active `CheckRun` — creates a duplicate parallel run
- **Where:** `AgentToolExecutor.ensureRun` (`agentTools.ts:199-212`) unconditionally calls `db.createCheckRun(...)` the first time a result is recorded. Contrast the manual flow: `routes/truckChecks.ts:699` calls `getActiveCheckRunForAppliance` first and joins the existing run if one is active — that's literally how the collaborative "Join Check" feature works.
- **Failure:** A member starts a manual check on a truck (an `in-progress` `CheckRun` now exists), then opens Voice Check on the *same* appliance (or a second member does, simultaneously) — the agent creates a brand-new, separate `CheckRun` instead of joining the active one. Results split across two runs; neither reflects the full inspection; the admin "Check History" and compliance reports see two runs for what was really one inspection.
- **Fix direction:** Have `ensureRun` call `getActiveCheckRunForAppliance` first and join it (recording `source`/`agentSessionId` as an update rather than only at creation) before falling back to `createCheckRun`.

### F13 — Silence/no-match replies bypass the transcript entirely
- **Where:** `agentCheck.ts` lines 225-226 and 235-236 send `{type:'agent-text', ...}` directly via `send(...)` for the "didn't hear anything" / "didn't catch that" fallbacks — unlike every other agent utterance, which `runAgentTurn` (`agentLoop.ts`) persists via `db.addTurn`.
- **Failure:** `GET /api/agent-sessions/:id/turns` returns an incomplete transcript: silence/no-match exchanges the member actually experienced (and which explain gaps in the recorded checklist) are invisible to later review/audit. The two canned strings are also duplicated inline in the route instead of living with the loop's own fallback text (`agentLoop.ts` has its own "Sorry, I did not catch that" fallback for a different case) — a future wording/tone change needs synchronized edits in two files.
- **Fix direction:** Route these through the same turn-persisting path as everything else (e.g. a small `persistAgentReply` helper shared by both files).

### F14 — `audio-start` re-entry silently discards already-captured audio
- **Where:** `agentCheck.ts`'s `audio-start` handler (~line 208-215) only guards on `turnInFlight`, not on an existing in-progress capture: `utterance = []; utteranceBytes = 0;` unconditionally resets the buffer.
- **Failure:** A double-fired `pointerdown` (a known touchscreen quirk — synthetic mouse + touch events, or a bouncing/stuck touch) sends two `audio-start` frames before the matching `audio-end`; the second wipes out whatever PCM the first press already buffered, so only audio captured after the *second* `audio-start` is transcribed — part of what the member said is silently lost.
- **Fix direction:** Ignore a second `audio-start` while a capture is already open (mirroring the existing `turnInFlight` busy response), or explicitly flush/transcribe the first buffer before starting a new one.

### F15 — Outer `catch` in the WS message handler silently swallows post-parse exceptions
- **Where:** `agentCheck.ts`'s `ws.on('message', ...)` wraps the entire frame-handling body in one `try { ... } catch { /* Non-JSON text ignored */ }`. The comment describes only the `JSON.parse` failure case, but the catch also silently absorbs any exception thrown *after* a successful parse (e.g. from a future code path, or `ws.send` throwing if socket state changed mid-handler) — unlike every other failure path in this file, which explicitly `logger.error`s.
- **Failure:** Such an exception produces no client-facing `error` frame and no server log line — the connection just appears to hang with nothing to diagnose from.
- **Fix direction:** Narrow the `try` to just `JSON.parse`, and let/wrap other exceptions with `logger.error` + an `error` frame like the rest of the file.

---

### F16 — `onPointerLeave` ends the utterance the instant a finger drifts off the button
- **Where:** `VoiceCheckPage.tsx` (~line 186) wires `onPointerLeave={endHold}` alongside `onPointerUp`/`onPointerCancel`.
- **Failure:** A crew member holding the talk button while walking around a truck — with gloves, wet/gritty hands, or just natural finger movement while gesturing — has their pointer drift a few pixels off the button edge; `onPointerLeave` fires immediately and ends the utterance mid-sentence with no warning. The agent only hears the first half of what was said, and the user doesn't realize recording stopped.
- **Fix direction:** Use pointer capture (`setPointerCapture` on `pointerdown`) so the button keeps receiving events until a genuine `pointerup`/`pointercancel`, regardless of where the pointer physically is.

---

## Conventions (CLAUDE.md violations, quotable)

- **Kiosk touch-target rule.** CLAUDE.md: *"Touch targets ≥ 60px (kiosk)."* `VoiceCheckPage.css`'s `.voice-composer input` and `.voice-composer button` are both `min-height: 48px` — 12px under the stated floor — on the same kiosk-facing page whose talk button correctly uses `min-height: 72px`.
- **Function registry rule.** CLAUDE.md: *"If a backend function/service signature changed → also update `docs/function_register.json`."* The four new services (`agentTools.ts`/`AgentToolExecutor`, `agentLoop.ts`/`runAgentTurn`, `agentSpeech.ts`, `effectiveChecklist.ts`) have no entries, and `createCheckRun`'s new trailing `runDetails` parameter isn't reflected in the existing (unqualified name-only) entry.
- **API registry rule.** CLAUDE.md: *"If an API endpoint was added/changed → also update `docs/api_register.json` and `docs/API_DOCUMENTATION.md`."* The WS endpoint and `GET /api/agent-sessions/:id[/turns]` are not registered. Deliberately deferred in the PR until the WS contract is final — do it when F1–F6/F10 settle the contract.
- **iPad screenshots.** CLAUDE.md: *"UI changes need iPad portrait+landscape screenshots in the PR."* None exist for the new Voice Check page; tied to F8's on-device verification (do both at once).

---

## Reuse / simplification (lower severity — maintenance cost, not correctness)

- **`agentSpeech.ts` duplicates `aiGateway.ts`'s speech-plumbing pattern.** Both independently read `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` and repeat the same try/catch-network-error→`logger.error`→502, `!res.ok`→`logger.warn`→forward-status shape (`aiGateway.ts`'s `issueSpeechToken`/`GatewayError` vs `agentSpeech.ts`'s `recognizeSpeech`/`synthesizeSpeech`). A future change to speech auth (key rotation, AAD, a new region format) applied to one will silently miss the other.
- **Hand-rolled JWT verification in the WS upgrade handler** (`agentCheck.ts`) duplicates `middleware/auth.ts`'s `extractToken`/`authMiddleware` (including redefining the same `JWT_SECRET` fallback constant). A JWT policy change (algorithm allowlist, secret rotation, expiry handling) applied to the middleware won't reach the WS handshake.
- **Completion detection via string-sniffing.** `agentLoop.ts` (~line 116) detects a finished check with `output.includes('"completed":true')` on the JSON-stringified tool output, instead of reading a structured field from `AgentToolExecutor.execute`'s already-typed result before it's stringified away. Any change to `completeRun`'s output shape (key reordering, a new similarly-named field) silently breaks or falsely triggers completion with no type error.
- **The 16 kHz/16-bit/mono PCM contract is hardcoded independently in 3+ places** with no shared constant crossing the frontend/backend boundary: `agentSpeech.ts`'s STT `Content-Type` header literal `samplerate=16000` doesn't even reference the `PCM_SAMPLE_RATE` constant defined 51 lines above **in the same file**; `audioEncoding.ts`'s `TARGET_SAMPLE_RATE`; and `MAX_UTTERANCE_BYTES`'s sizing comment. Changing the rate requires finding and updating all of them; missing one produces a rate-mismatched WAV header that Azure STT silently misinterprets.
- **Manual `record_result`-is-idempotent semantics have no DB-layer equivalent.** The agent's "update, don't duplicate" behavior is implemented by scanning `getResultsByRunId` inside the tool layer; the manual REST path (`POST /api/truck-checks/results`) has no such check at all, so a double-submit/retry there can create a genuine duplicate `CheckResult` for the same item — an inconsistency between the two entry paths (adjacent to F12) that any report/export code assuming one result per item per run will double-count.
- **`MicCapture.isActive`** is a public getter that's never read anywhere outside its own test mock — dead API that looks load-bearing.
- **`VoiceCheckPage.tsx`'s `statusLabel`** is a 5-level nested ternary; an ordered array of `(condition, label)` pairs or a small lookup would be less error-prone to extend (e.g. a future "reconnecting" state).
- **Canned-reply frame construction** (`{type:'agent-text', text, completed:false, runId: session.runId}`) is written out by hand three times in `agentCheck.ts` (the general case plus both silence-fallback cases) instead of a one-line helper.
- **`🎙 Voice Check` button visibility on kiosk/demo/single-tenant.** `hasFeature()` returns `true` when no entitlements are loaded, so the button shows on single-tenant/demo deployments where Azure may be unconfigured; tapping it degrades to 503-style error frames rather than being hidden. Cosmetic; decide intended behaviour alongside F3.

---

## Minor / watch-list (not worth a fix on their own, but cheap to fold in alongside F10)

- **`escapeXml` doesn't strip XML-illegal control characters** (`0x00-0x08`, `0x0B-0x0C`, `0x0E-0x1F`). It escapes the five XML metacharacters correctly, but if an LLM reply ever contains a stray control byte, Azure TTS will reject the SSML outright — `synthesizeSpeech` returns an error, `speakReply` (`agentCheck.ts`) silently sends no `agent-audio` frame, and the member gets no spoken reply for that turn with only a `logger.warn`. Cheap fix: strip those code points alongside the existing escaping.
- **`ensureRun` mutates `this.session.runId` before its DB persist awaits.** `agentTools.ts:209-210` sets the in-memory field, *then* awaits `updateSession(...)`. If that specific await throws (e.g. a transient Table Storage error) while `createCheckRun` already succeeded, the executor keeps working correctly against the right run for the rest of the connection, but the *persisted* `AgentSession` row never gets `runId` — a later `GET /api/agent-sessions/:id` or a future reconnect (once F9 adds one) would report a session with no linked run even though the run and its results exist. Worth a try/catch with a retry or at least a log line when this specific write fails.

## Verified-not-a-bug (checked, no action)

- **Table-twin `completeCheckRun` preserving `source`/`agentSessionId`:** re-fetches the full entity via `getEntity` and `updateEntity(..., 'Replace')`, so the new columns survive round-trip. OK.
- **SSML injection via TTS:** `escapeXml` encodes `& < > " '` before interpolating LLM text into `<voice>`; voice/language come from server env. Not exploitable (see the control-character note above for a related-but-different concern).
- **`resolveEffectiveChecklist` extraction:** byte-for-byte move into `services/effectiveChecklist.ts`; route behaviour unchanged.
