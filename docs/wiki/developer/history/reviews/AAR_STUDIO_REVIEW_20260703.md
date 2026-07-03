# AAR Studio — hero-feature review (2026-07-03)

**Directive (owner):** AAR Studio is the headline feature of Bushie Tools — it
is what sells the app. This review examines its user experience and function
with that bar: not "does it work" but "would a brigade facilitator show this to
another brigade". Findings are documented for later agents to implement; no
fixes are made in this review.

**Status: Q1 (AAR-6, AAR-8, AAR-1, AAR-7), AAR-19, AAR-9, AAR-23, AAR-3,
AAR-10 and AAR-2 fixed 2026-07-03** (see the changelog entries) — the four
findings the master plan grouped as "what stands between AAR Studio and a
confident live demo", plus five more Q2 items:
- **AAR-6/AAR-8** (`js/audio/live.js`, `js/audio/speech.js`): the gateway
  speech token now refreshes proactively every 8 minutes, and the transcriber
  reconnects automatically (up to 4 backed-off attempts) on failure without
  tearing down the audio graph or backup recording — a `reconnecting` status
  replaces the old silent fall-back to idle.
- **AAR-1** (`js/store.js`, `js/views/home.js`): review deletion is now split
  into "Remove from this device" vs. a signed-in-only "Delete for everyone",
  each with its own explicit confirm.
- **AAR-7** (`js/lib/collab.js`): the facilitator/participant now re-announce
  themselves to the room on every Socket.io reconnect, so room notes survive
  a network blip instead of silently vanishing.
- **AAR-19** (`js/lib/exports.js`): every export (snapshot HTML, combined
  report, Markdown summary) now carries a "Produced with AAR Studio · Bushie
  Tools" attribution line — the report's colour palette turned out to already
  match the current brand tokens exactly, so no palette change was needed
  (see the corrected finding text below).
- **AAR-9/AAR-23** (`js/audio/speech.js`, `js/views/report.js`): speech and
  report-generation error/empty-state copy now checks gateway vs BYO-Azure
  mode before mentioning Settings, so a bushie on the built-in AI is never
  told to go check an Azure key they don't have.
- **AAR-3** (`js/lib/model.js`, `js/store.js`, `js/lib/extraction.js`,
  `js/analyse.js`, `js/views/setup.js`): quick-start's GPS-fallback location is
  now flagged `locationIsAuto` so the AI's real place name (or manual typing)
  always replaces it instead of the coordinates sticking in the report header.
- **AAR-10** (`js/lib/llm.js`, `js/analyse.js`, `js/views/capture.js`,
  `js/views/board.js`): a 401/402/403 during auto-extraction now latches into
  a single dismissible banner instead of repeating as a toast every 45s for
  the rest of the meeting, and auto-extraction pauses until it's resolved or
  dismissed.
- **AAR-2** (`js/ui.js`, `index.html`, `js/views/home.js`,
  `js/views/capture.js`, `js/views/report.js`): every native `window.prompt`/
  `window.confirm` is replaced by a `<dialog>`-based `confirmDanger()`/
  `promptDialog()` pair in `ui.js`, matching the settings dialog's existing
  pattern.

Note left for whoever picks up **AAR-11**: the AAR-6 token-refresh timer and
each reconnect attempt call `/api/ai/speech/token` again, and the backend
currently counts every vend as a separate metered session
(`backend/src/routes/ai.ts`'s `countUsage` sums raw usage rows, not distinct
sessions) — a long meeting will now consume several sessions' worth of
allowance. Deliberately *not* fixed here (billing semantics, not a
reliability bug) — flagged for AAR-11's own pass, which the review already
scoped as coordinating with this fix.

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

- ~~**AAR-2 · Medium · UX — Native `prompt()` / `confirm()` throughout.**~~
  **Fixed 2026-07-03.** Rename used `window.prompt` (`views/home.js:66`),
  destructive confirms used `window.confirm` (`ui.js:58-60`, also
  `views/capture.js:195`, `views/report.js` regenerate/discard). Native
  dialogs are unstylable, break the brand, and are suppressed in some
  kiosk/webview contexts. `ui.js` now exports a `<dialog>`-based
  `confirmDanger()`/`promptDialog()` pair (Promise-returning, reusing a new
  `#confirm-dialog` element alongside the existing `#settings-dialog`
  pattern); every call site (`home.js` rename + both deletes, `capture.js`
  clear transcript, `report.js` regenerate + discard) now awaits it.

- ~~**AAR-3 · Medium · UX — Quick-start writes raw GPS coordinates into the
  incident location, and they stick.**~~ **Fixed 2026-07-03.** `startRecordingNow`
  (`views/home.js:14-19`) stores `"-35.1234, 149.5678"` in
  `incident.location`; `mergeMetadata` only fills **blank** fields
  (`lib/extraction.js:163`), so the AI's proper place name ("Macs Reef Road,
  Bywong") can never replace the coordinates — and the raw lat/long leaks
  into the report header and review cards. A new `incident.locationIsAuto`
  flag (`lib/model.js`) marks a GPS-fallback value; `store.js`'s
  `setIncidentLocation` sets it, `mergeMetadata` treats a still-auto location
  as fillable (and clears the flag once replaced), and typing a location
  manually (`views/setup.js`) clears it too.

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

- ~~**AAR-9 · Medium · UX — Wrong-audience error copy in gateway mode.**~~
  **Fixed 2026-07-03.** The speech `canceled` handler always said "Check the
  Speech key/region in Settings" (`audio/speech.js:54`) — advice that only
  applies to BYO-Azure developers. A bushie on the built-in AI has no key and
  would be sent spelunking through the (deliberately developer-only) settings
  dialog. `createTranscriber` now branches on a local `gatewayMode` check
  (`Boolean(settings.authToken)`), same signal used elsewhere in the AAR
  audio stack.

- ~~**AAR-10 · Medium · UX — Persistent AI failures toast every ~45 seconds
  for the rest of the meeting.**~~ **Fixed 2026-07-03.** The auto-extract
  timer retries on the 45 s / 70-word policy; every failing pass raised an
  8-second error toast (`analyse.js:116-119`). If the org's AI allowance ran
  out mid-debrief (402), the facilitator got an identical toast every 45 s
  for an hour. A new `isPersistentAiError()` (`lib/llm.js`) flags 401/402/403
  (sign-in/allowance/plan — none of which resolve by waiting) as persistent;
  `analyseNow` latches one into a module-level `persistentError` instead of
  toasting again, `maybeAutoExtract` pauses while it's set, and a dismissible
  `.ai-error-banner` (Capture + Board views) shows the message/hint with a
  Dismiss button that lets the next auto-extract pass retry. A clean pass
  clears the latch automatically. Transient statuses (429, 503, network
  errors) keep the old toast-per-pass behaviour, since those can self-resolve.

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

## 3. AI analysis, dedupe & cloud sync

The AI layer is the strongest part of the app: prompts encode AU fire-service
vocabulary and transcript-reality handling, extraction is chunked with schema
fallbacks (`json_schema` → `json_object` → free-form), metadata back-fill is
strictly non-destructive, and the two-band dedupe (auto-skip ≥0.72, human
merge suggestions 0.5–0.72) is a genuinely good design. Findings here are
mostly about what happens when things *don't* go right.

- **AAR-15 · Medium-High · FN — Cloud-sync conflicts are detected and then
  thrown away while editing.** `pushSession` correctly reports
  `{ conflict: true }` on a 409 (`lib/serverSync.js:74-75`), but the only
  live caller is the debounced backup which fire-and-forgets it
  (`store.js:21-26`). Two facilitators editing the same review: the loser's
  edits stay local-only for the whole session with zero indication — the
  "☁ Newer version" flag only appears later, on the home screen, if they
  look. **Direction:** when a backup push returns `conflict`, surface a
  persistent in-session banner ("A newer team copy exists — your edits are
  saving to this device only · Load latest / Keep mine as a copy"), where
  "keep mine" forks to a new id.

- **AAR-16 · Low · FN — Dead station scoping in sync.** `toServerBody` sends
  `session.stationId` (`lib/serverSync.js:37`) but nothing ever sets a
  `stationId` on a session (`lib/model.js:createSession`) — the field is
  always undefined. Either wire it (roster is already loaded when signed in)
  or drop it.

- **AAR-17 · Low · FN — Merging findings can drop a unit attribution.**
  `mergeFindings` keeps `keep`'s identity wholesale (`lib/dedupe.js:102-112`);
  if `keep` has no `unit` but `drop` does, the attribution is lost.
  `unit: keep.unit || drop.unit` matches the quote-handling already there.

- **AAR-18 · Low · UX — Finding deletion is instant and unrecoverable; blank
  saves allowed.** The board's ✕ removes a finding with no confirm or undo
  (`views/board.js:81`; same in `views/review.js:67`), while deleting a whole
  review gets a confirm — inverted weight. Inline edit Save accepts empty
  text, leaving a blank card. **Direction:** an "Undo" action on the deletion
  toast (hero-grade, no confirm friction), and ignore empty-text saves.

## 4. Board, report & exports

The board (four columns, phase filter, present mode, merge panel) and the
report studio (every field editable, live preview) are well conceived. The
exported report is where the hero lens bites hardest — it is the artifact
brigades will forward to district staff and other brigades.

- **AAR-19 · High · UX/brand — The exported report carries no product
  attribution.** *(Correction from the initial pass: `SNAPSHOT_CSS`/
  `COMBINED_CSS`'s hardcoded `#c8102e` red (`lib/exports.js:37-77,253-270`)
  actually **matches** the current `--rfs-core-red` token exactly — it is not
  a pre-rebrand colour, and no palette fix is needed. `#e8b84b` gold is a
  bespoke print-document accent, distinct from the UI's `--ui-amber`, and is a
  legitimate standalone design choice for an "official report" look.)* The
  real gap: nothing on the exported document says where it came from — for
  the feature that sells the app, a discreet "Produced with AAR Studio ·
  Bushie Tools" footer on every export is the organic growth hook, and it's
  currently missing. **Direction:** add the attribution footer to
  `renderSnapshotHtml`/`renderCombinedHtml` (and the Markdown export).

- **AAR-20 · Medium · UX — Print/PDF path is the known-fragile iframe print.**
  `preview.contentWindow?.print()` (`views/report.js:109`) prints a `srcdoc`
  iframe — unreliable on iOS Safari (can print the parent page) and the
  long-open P1 "print-stylesheet refinements" item. **Direction:** open the
  rendered HTML in a dedicated window/tab for printing, add proper `@page`
  margins, and verify on iPad + desktop Chrome/Safari.

- **AAR-21 · Medium · UX — Room-note contributors never see their notes in the
  record.** Notes feed the AI as evidence, but no export includes them: the
  combined report offers a transcript appendix only
  (`lib/exports.js:328-340`), and report generation works from findings
  alone (by design). Someone who typed five notes from the floor finds no
  trace of them in the output — which undercuts the collab feature's promise.
  **Direction:** an optional "Room notes" appendix (label + time + text) in
  the combined report, and consider feeding un-analysed notes to report
  generation as supporting evidence.

- **AAR-22 · Low · UX — Report preview re-renders the whole iframe per
  keystroke.** Every input event rebuilds the full snapshot HTML into
  `srcdoc` (`views/report.js:64-76`) — perceptible jank on iPad with a real
  report. Debounce ~300 ms.

- ~~**AAR-23 · Low · UX — Developer-mode wording shown to gateway users.**~~
  **Fixed 2026-07-03.** The report empty-state said "Generation uses the
  report deployment from ⚙ Settings" (`views/report.js:57`) — meaningless to
  a bushie on the built-in AI (same audience mismatch as AAR-9). Now branches
  on `usesGateway(getSettings())`. The stale header comment ("AI report
  generation arrives in Stage 3") is also corrected.

- **AAR-24 · Low · UX — Untitled exports produce anonymous filenames.**
  `sessionFilename` slugs to `aar-…` with no date when the title is blank
  (`lib/exports.js:23-25`), so downloads collide as `aar-snapshot.html`.
  Reuse `displayTitle`'s friendly fallback + the incident/created date.

---

## What is already hero-grade (don't break it)

- **The friendly flow:** "Start recording now" → AI fills title/location/
  units from the talk → findings appear while people speak. This *is* the
  demo; everything above protects it.
- **The prompt engineering:** AU fire-service vocabulary preservation,
  "(unclear)" honesty markers, garbled-speech repair, findings-only report
  grounding with an explicit no-invention rule.
- **Local-first with additive cloud:** signed-out capture works fully; sync
  never blocks the room.
- **Two-band dedupe + merge suggestions**, present mode, per-unit
  attribution, and the report studio's everything-editable design.

## Priority order for implementation

Work top-down. The top four are what stands between AAR Studio and a
confident live demo in front of a brigade.

| Rank | Finding | Why first |
|---|---|---|
| 1 | ~~**AAR-6** token refresh (Critical)~~ **Fixed 2026-07-03** | Live transcription dying at ~10 min kills the hero demo in every real meeting |
| 2 | ~~**AAR-8** error teardown keeps recording~~ **Fixed 2026-07-03** | The safety net (backup recording) must survive transcriber failures |
| 3 | ~~**AAR-1** team-wide delete~~ **Fixed 2026-07-03** | Silent brigade-wide data loss from a "tidy up" tap |
| 4 | ~~**AAR-7** collab reconnect~~ **Fixed 2026-07-03** | Room notes silently vanishing mid-meeting betrays contributors |
| 5 | ~~**AAR-19** report attribution~~ **Fixed 2026-07-03** | The shared artifact is the growth hook — it should say where it came from |
| 6 | **AAR-15** conflict surfaced while editing | Two-facilitator divergence is otherwise invisible for hours |
| 7 | ~~**AAR-10** latch persistent AI failures~~ **Fixed 2026-07-03** | Toast-every-45s during a live meeting is demo-lethal |
| 8 | ~~**AAR-3** GPS coords block real location~~ **Fixed 2026-07-03** | Ugly report headers from the flagship quick-start path |
| 9 | **AAR-11** metering per token vend | Fix alongside AAR-6/8 so reliability work doesn't burn allowance |
| 10 | ~~**AAR-9 + AAR-23** audience-correct error copy~~ **Fixed 2026-07-03** | One sweep: gateway users must never be told to check Azure keys |
| 11 | ~~**AAR-2** replace native prompt/confirm~~ **Fixed 2026-07-03** | Brand-consistent dialogs; unlocks AAR-1's better confirm |
| 12 | **AAR-21** room notes in exports | Completes the collab promise |
| 13 | **AAR-20** print path | Long-open P1; verify on iPad |
| 14 | AAR-4, AAR-5, AAR-12, AAR-13, AAR-14, AAR-16, AAR-17, AAR-18, AAR-22, AAR-24 | Low-severity batch; fold into the sessions above where files overlap |
