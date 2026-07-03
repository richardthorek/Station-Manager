# AAR Studio — hero-feature review (2026-07-03)

**Directive (owner):** AAR Studio is the headline feature of Bushie Tools — it
is what sells the app. This review examines its user experience and function
with that bar: not "does it work" but "would a brigade facilitator show this to
another brigade". Findings are documented for later agents to implement; no
fixes are made in this review.

**Scope:** the whole `aar-studio/` bundle (views, libs, audio, CSS), its
backend seams (`/api/aar-sessions`, `/api/ai/*`, Socket.io collab relay,
`/aar` CSP), and the paths a new user takes into it (landing card, `?demo`,
join links).

**Method:** full read of all ~4,300 lines of app source + the relevant backend
routes/services, walked in user-journey order: first-run → setup → capture →
analysis → board → report → sharing. Each finding carries severity
(**Critical / High / Medium / Low**), a UX or FN (function) tag, evidence
(file:line), and a suggested direction.

**Finding IDs are `AAR-1 …` in discovery order; the "Priority order for
implementation" section at the end ranks them.**

---

## 1. First-run & home — the sell

The home view is genuinely strong: "Start recording now" with zero setup, AI
back-fill of title/location/units, friendly fallback titles, a "From your
team" cloud section. The findings below are the gaps between *good* and
*hero*.

- **AAR-1 · High · UX+FN — Deleting a review locally silently deletes it for
  the whole brigade.** The card's 🗑 action (`views/home.js:73-78`) calls
  `store.deleteSession`, which also fires `deleteServerSession`
  (`store.js:159-168`) — so a member "tidying up their iPad" removes the
  team's only cloud copy. The confirm is a generic native
  `confirm("Delete …? This can't be undone.")` that never mentions the team.
  There is no undo and no server-side soft delete. **Direction:** split the
  action into "Remove from this device" vs "Delete for everyone" (the latter
  only when signed in, with an explicit team-wide warning), and consider a
  soft-delete window server-side so an accidental team delete is recoverable.

- **AAR-2 · Medium · UX — Native `prompt()` / `confirm()` throughout.**
  Rename uses `window.prompt` (`views/home.js:66`), destructive confirms use
  `window.confirm` (`ui.js:58-60`, also `views/capture.js:195`). The SPA
  already purged `prompt()` (June 2026 resolution-modal work) as sub-par;
  native dialogs are unstylable, break the brand, and are suppressed in some
  kiosk/webview contexts. **Direction:** a small `<dialog>`-based
  confirm/prompt pair in `ui.js` (the settings dialog already shows the
  pattern).

- **AAR-3 · Medium · UX — Quick-start writes raw GPS coordinates into the
  incident location, and they stick.** `startRecordingNow`
  (`views/home.js:14-19`) stores `"-35.1234, 149.5678"` in
  `incident.location`; `mergeMetadata` only fills **blank** fields
  (`lib/extraction.js:163`), so the AI's proper place name ("Macs Reef Road,
  Bywong") can never replace the coordinates — and the raw lat/long leaks
  into the report header and review cards. **Direction:** keep auto-captured
  coords in a separate field (or mark location as `auto`), let
  discussion-derived names overwrite auto values, and only surface coords
  when nothing better exists.

- **AAR-4 · Low · UX — The example review is buried.** "See an example" is a
  footer link (`views/home.js:172-176`), but the worked example *is* the
  sales demo. On a first visit with zero reviews, it deserves a spot in the
  hero section ("See what a finished review looks like"), not the footer.

- **AAR-5 · Low · UX — No affordance explaining that signing in unlocks team
  sync.** Cloud backup/"From your team" simply don't appear when signed out
  (`views/home.js:134-135`). A facilitator who never signs in silently gets
  no backup — one dropped iPad loses the review. **Direction:** a quiet,
  dismissible hint on home when signed out ("Sign in to back up reviews and
  share them with your brigade") — it is also the upgrade hook for the plan
  that sells this app.

## 2. Setup & capture — transcription, room notes, collab

Setup is appropriately optional and the capture view's "just listen"
architecture (worklet → 16 kHz PCM → Azure push stream, 45 s/70-word
auto-extraction, local backup recording) is well built. The reliability gaps
below are exactly the ones that will fire in a real 60-minute debrief, which
is why they rank at the top of this review.

- **AAR-6 · Critical · FN — The Azure Speech auth token is never refreshed, so
  gateway-mode live transcription dies mid-debrief.** Gateway mode vends one
  token at start (`audio/live.js:184-188` → `/api/ai/speech/token`); Azure
  Speech authorization tokens are valid for ~10 minutes, and the SDK does
  **not** auto-refresh a `fromAuthorizationToken` config — the app must
  periodically set `authorizationToken` on the recogniser. A real AAR runs
  30–90 minutes: after expiry, the next service reconnect (network blip,
  silence timeout, service recycle) is rejected and the transcriber cancels —
  in the middle of the meeting, with the error path tearing the whole capture
  down (see AAR-8). This is the single most damaging defect for the hero
  use-case. **Direction:** a refresh timer (~8 min) that re-vends and assigns
  `engine.authorizationToken`; on an auth-flavoured `canceled` event,
  auto-restart the pipeline with a fresh token instead of stopping; verify
  with a >30-minute live session. (Coordinate with AAR-11 so refreshes don't
  double-count metered sessions.)

- **AAR-7 · High · FN — Room notes silently stop after any reconnect.**
  Socket.io room membership dies with the connection. The facilitator hosts
  once per session id (`views/capture.js:14-31` caches `hostedCode`) and
  never re-emits `aar:host` on the socket's `connect` event; participants
  join once (`views/join.js:68`). After a laptop sleep / Wi-Fi blip, the
  server happily relays notes to a room the facilitator is no longer in
  (`backend/src/services/aarCollab.ts:106-120`) and acks the participant
  `ok:true` — so contributors see "Note sent to the review" while the notes
  vanish. **Direction:** re-emit host/join on every socket `connect`;
  consider having the ack reflect whether a host was present, or buffer
  undelivered notes briefly server-side.

- **AAR-8 · High · UX+FN — Any speech-service error kills the whole capture,
  including the backup recording.** `onError` → `stop()`
  (`audio/live.js:206-210`) tears down the mic, the recorder, and the timer.
  A transient service error mid-meeting leaves the facilitator with a dead
  panel and a "start again" button — and the minutes that follow are not even
  captured to the local backup while they scramble. **Direction:** decouple
  the backup recorder from the transcriber (keep recording through
  transcriber failures), attempt automatic transcriber restart (ties into
  AAR-6), and surface a persistent "listening interrupted — reconnecting /
  resume" state rather than a silent fall-back to idle.

- **AAR-9 · Medium · UX — Wrong-audience error copy in gateway mode.** The
  speech `canceled` handler always says "Check the Speech key/region in
  Settings" (`audio/speech.js:54`) — advice that only applies to BYO-Azure
  developers. A bushie on the built-in AI has no key and will be sent
  spelunking through the (deliberately developer-only) settings dialog.
  **Direction:** branch the hint on gateway vs direct mode, mirroring the
  `SPEECH_TOKEN_HINTS` / `GATEWAY_HINTS` pattern that already exists.

- **AAR-10 · Medium · UX — Persistent AI failures toast every ~45 seconds for
  the rest of the meeting.** The auto-extract timer retries on the 45 s /
  70-word policy; every failing pass raises an 8-second error toast
  (`analyse.js:116-119`). If the org's AI allowance runs out mid-debrief
  (402), the facilitator gets an identical toast every 45 s for an hour.
  **Direction:** latch persistent failures (esp. 401/402/403) into a single
  dismissible banner with the relevant action (sign in / top up), and pause
  auto-extraction until it's resolved.

- **AAR-11 · Medium · FN — Metering counts "sessions" per token vend, which
  punishes reconnects.** Each `live.start` vends a speech token, and each
  vend consumes one metered AI session. The fixes for AAR-6/AAR-8 (and plain
  user behaviour: stop for a break, resume after) multiply vends within one
  meeting. **Direction:** server-side, don't count a re-vend for the same
  org within a short window (or meter by meeting via a client-supplied
  session id) — coordinate with the billing track before changing.

- **AAR-12 · Low · FN — Findings extracted from room notes carry note ids in
  `segmentIds`.** Note evidence is fed to the model as pseudo-segments with
  the note's id (`analyse.js:78-87`), and `toFinding` validates ids against
  that same pool — so a finding's `segmentIds` can reference `notes[]`
  entries. Anything that resolves `segmentIds` against `session.segments`
  (quote back-links, future features) will miss them. **Direction:** either
  map note-derived evidence to a distinct `noteIds` field or accept and
  document the mixed id space.

- **AAR-13 · Low · UX — The join page's status is write-once.** "● Connected"
  is set on first join (`views/join.js:68-70`) and never downgraded; a phone
  that slept shows Connected while its socket is gone (and its notes may be
  lost per AAR-7). **Direction:** reflect socket `disconnect`/`connect`
  events in the status line, re-join on reconnect.

- **AAR-14 · Low · UX — "Shared tab / system audio" is offered on devices that
  can't do it.** `getDisplayMedia` with audio is unavailable on iPad Safari;
  the button renders regardless and fails only after the attempt. Minor —
  hide or annotate on unsupported platforms.

## 3. AI analysis — extraction, dedupe, messaging

*(pending)*

## 4. Board, report, exports, sync

*(pending)*

## Priority order for implementation

*(pending — filled once all sections are complete)*
