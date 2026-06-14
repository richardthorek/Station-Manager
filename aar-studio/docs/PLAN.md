# AAR Studio — Plan

**Status:** Living document — update when scope or priorities change.
**Last updated:** June 2026 (Stages 1–4 + 6 delivered; Stage 5 polish remaining)

## Vision

AAR Studio is a standalone static web app (plain HTML/CSS/ES modules, **no build
step**) that helps a fire brigade facilitator run an After Action Review end to
end:

1. **Set up** the session (incident, AAR meeting details, attending units, phases).
2. **Capture** the discussion — room microphone, shared Teams tab audio, an
   uploaded recording, or a pasted Teams transcript.
3. **Analyse live** — AI extracts discrete findings into the four AAR
   categories (*what happened / what went well / what didn't go well / what
   would we do next time*), tagged with the incident phase, shown on a live
   board with a projector-friendly Present mode.
4. **Review & edit** — fix transcripts, rename speakers, curate findings.
5. **Report** — AI drafts a structured report; every field is editable; export
   a one-page executive snapshot (HTML), a combined HTML report, a Markdown
   summary, and a JSON session file.

Everything runs in the browser. Azure AI Speech and Azure OpenAI (Azure AI
Foundry deployments) are called directly from the client; keys live in
`localStorage` only. The AAR app has **no server-side logic of its own**; it
ships as a no-build static bundle served by the Station Manager backend at
`/aar` within the single Azure App Service deployment.

The Wamboin structure fire AAR (June 2026) is the reference example: its
summary, one-page snapshot and session data are bundled as
`data/sample-session.json` so Review and Report are demoable without a live
session.

## Relationship to Station Manager

AAR Studio lives in `aar-studio/` inside the Station-Manager repo. It shares no
application code with Station Manager (its own vanilla ES modules, its own
`node --test` suite), but it is **not deployed separately**: the Express backend
serves it at `/aar` as part of the one Azure App Service deployment, and the app
picker on the landing page links to it. The backend applies the security
headers it needs, scoped to `/aar` (see `backend/src/index.ts`); the folder is
located via `AAR_STUDIO_PATH` (default `../aar-studio` from the repo root) and
must be included in the deployment package.

## Delivery stages

### Stage 1 — Foundation ✅ (delivered)

- App shell: `index.html`, hash routing, nav, toasts, dark RFS-adjacent theme.
- Session model + `localStorage` persistence (one key per session), autosave,
  session list / create / open / delete / JSON import & export.
- Session setup view: incident title/date/location/type, AAR date/location,
  facilitator, attending units (unit + role rows), configurable phases
  (default Arrival, Rescue, Suppression, Overhaul + implicit General bucket).
- Settings dialog: Azure OpenAI endpoint / deployment / report deployment /
  api-version / key, Azure Speech key / region / language (en-AU default) /
  diarization toggle; **Test connection** button; stored in `localStorage`.
- Sample Wamboin session JSON; load-sample button on Home.
- README, node test runner (`node --test`, zero dependencies). (Security
  headers for `/aar` now live in the Station Manager backend; see Stage 6.)

### Stage 2 — Transcript ingest, extraction & live board ✅ (delivered)

- Transcript parser (pure module): Teams DOCX copy format
  (`Name␠␠␠m:ss` header line + text lines), `Name: text` lines, WEBVTT
  (incl. `<v Speaker>` voice tags), plain-paragraph fallback.
- Paste-a-transcript ingest in the Capture view; segments stored with speaker,
  timestamp, phase, source.
- LLM client (pure-ish module): Azure OpenAI chat completions with structured
  outputs — `response_format: json_schema (strict)` with graceful fallback to
  `json_object`, then plain-JSON parsing; no `temperature`/`max_tokens`
  (reasoning-model compatible); CORS/auth/deployment error hints.
- Extraction engine: chunked extraction over segments, AAR-specific prompt
  (single-room-mic garble correction, "(unclear)" marking, Australian fire
  service terminology, ignore facilitation chatter, verbatim quote + source
  segment ids per finding), JSON schema per session phases.
- Auto-trigger policy helper (~45 s / 70+ words, plus phase change / on
  demand) — wired to manual "Analyse" now, reused by live audio in Stage 4.
- Near-duplicate finding dedupe (token-set similarity + containment).
- Live board: 4 category columns with counts, phase chips + phase filter,
  manual quick-add, edit/delete, fullscreen high-contrast **Present mode**.
- Review view: edit/recategorise/rephase/delete findings; edit segment text,
  phase and speaker; rename diarised speakers (map applied everywhere).

### Stage 3 — Report studio ✅ (delivered)

- Report data model `{headline, contextBar, stats[], snapshot[], phases[],
  themes[], recommendations[], actions[3], assessment, caveat}`; blank
  template creation pre-filled from session metadata.
- **AI report generation** from the curated findings (`lib/reportGen.js`):
  strict JSON schema aligned to the session's phases, style rules matching
  the snapshot artwork ("Bold lead. Detail." bullets, Australian fire-service
  terminology, no invented facts, "(unclear)" markers preserved); uses the
  optional report deployment with fallback to the chat deployment;
  regenerate-with-confirm once a report exists.
- Report editor with live preview (iframe), every field editable.
- Exports: one-page executive snapshot HTML (dark header, red context bar,
  stats row, who attended, What worked / Lessons columns, Top three actions
  footer), **combined HTML report** (snapshot page + full summary + findings
  register + optional transcript appendix, print-paginated), Markdown summary
  + findings register, JSON session export, print-to-PDF via the preview.

### Stage 4 — Live audio capture ✅ (delivered)

- One shared audio pipeline: source (mic `getUserMedia` / tab or system audio
  `getDisplayMedia` / decoded uploaded file) → `AudioWorklet` tap → resample →
  16 kHz mono PCM16 → Azure Speech **push stream**; RMS level meter from the
  same tap.
- Azure AI Speech JS SDK (`microsoft-cognitiveservices-speech-sdk` from
  jsDelivr, lazy-loaded on first use), `ConversationTranscriber` with the
  diarization toggle (plain `SpeechRecognizer` when off), en-AU default; live
  interim results and elapsed/level display in the Capture view; diarised ids
  mapped to stable "Speaker N" labels (renameable in Review).
- Optional local `MediaRecorder` backup recording (mic/tab sources) offered
  as a download after stop.
- Phase clicker tags live segments; auto-extraction loop runs the Stage 2
  trigger policy (45 s / 70 words, plus phase change / on demand / on stop),
  so the board maintains itself as the discussion progresses.

### Stage 6 — App Service integration ✅ (delivered)

- AAR Studio is now part of the **single Station Manager application** rather
  than a separate Azure Static Web App. The Express backend serves it at `/aar`
  (`backend/src/index.ts`), and the landing-page app picker has an **AAR Studio**
  card linking to it.
- The CSP and `Permissions-Policy` AAR Studio needs (jsDelivr scripts, Azure
  OpenAI/Speech connect targets, `frame-src` for the report preview, microphone
  and display-capture) are applied by the backend, scoped to `/aar`, overriding
  Helmet's stricter global policy for that path only.
- The mount is guarded by `existsSync`, located via `AAR_STUDIO_PATH` (default
  `../aar-studio` from the repo root), so a deployment that omits the bundle
  still boots cleanly. The obsolete `staticwebapp.config.json` has been removed.

### Stage 5 — Polish ⬜

- Dedupe threshold tuning with real transcripts; merge-suggestion UI.
- Accessibility pass (keyboard-only board operation, ARIA live regions for the
  Present mode), print stylesheet refinements.
- Combined-report appendix options; per-unit finding attribution.
- Optional: ship a `?demo` deep link that auto-loads the sample session.

## Architecture decisions (log)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No build step, plain ES modules | Served as static files by the Station Manager backend at `/aar` by copying the folder into the deploy package; trivially debuggable at an incident-review timescale; no toolchain rot. |
| 2 | Browser → Azure direct, keys in localStorage | No AAR-specific server logic to run or secure; acceptable because keys are the operator's own and scoped resources; clearly documented trade-off. |
| 3 | Structured outputs w/ fallback chain | `json_schema` strict where supported; older api-versions/models fall back to `json_object`, then fenced-JSON parsing. |
| 4 | One audio pipeline for mic/tab/file | Uniform 16 kHz PCM16 push stream means STT code has a single input path; the level meter and backup recorder tap the same graph. |
| 5 | Pure logic modules (parser, dedupe, exports, extraction policy) | Testable with `node --test` and no browser; views stay thin. |
| 6 | One localStorage key per session | Sessions are independent, listable by key prefix, and exportable/importable as single JSON files. |

## Data model (summary)

See `docs/ARCHITECTURE.md` for the full schema. A session is one JSON object:
`{ id, schemaVersion, incident, aar, units[], phases[], currentPhase,
segments[], findings[], speakers{}, report|null, createdAt, updatedAt }`.
Findings carry `category` (`happened|well|didnt|next`), `phase`, `text`,
`quote`, `segmentIds[]`, `source` (`ai|manual`).
