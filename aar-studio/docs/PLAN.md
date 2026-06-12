# AAR Studio — Plan

**Status:** Living document — update when scope or priorities change.
**Last updated:** June 2026 (initial version, Stages 1–2 delivered, Stage 3 partially delivered)

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
`localStorage` only. There is **no backend**. Deployment target is Azure
Static Web Apps.

The Wamboin structure fire AAR (June 2026) is the reference example: its
summary, one-page snapshot and session data are bundled as
`data/sample-session.json` so Review and Report are demoable without a live
session.

## Relationship to Station Manager

AAR Studio lives in `aar-studio/` inside the Station-Manager repo but is fully
self-contained: no shared code, no shared deploy. The main CI/CD pipeline
ignores it (`paths-ignore`); it has its own workflow
(`.github/workflows/aar-studio.yml`) that runs its node tests and deploys to
Azure Static Web Apps.

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
- `staticwebapp.config.json` (CSP, Permissions-Policy), SWA deploy workflow,
  README, node test runner (`node --test`, zero dependencies).

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

### Stage 3 — Report studio 🔶 (editing + exports delivered; AI generation next)

Delivered:
- Report data model `{headline, contextBar, stats[], snapshot[], phases[],
  themes[], recommendations[], actions[3], assessment, caveat}`; blank
  template creation pre-filled from session metadata.
- Report editor with live preview (iframe), every field editable.
- Exports: one-page executive snapshot HTML (dark header, red context bar,
  stats row, who attended, What worked / Lessons columns, Top three actions
  footer), Markdown summary + findings register, JSON session export,
  print-to-PDF via the preview.

Remaining:
- **AI report generation** from the curated findings + transcript (separate
  optional report deployment, e.g. a larger model than the live-extraction one).
- **Combined HTML report** export (snapshot page + full summary + findings
  register + optional transcript appendix in one file).

### Stage 4 — Live audio capture ⬜

- One shared audio pipeline: source (mic `getUserMedia` / tab or system audio
  `getDisplayMedia` / decoded uploaded file) → `AudioWorklet` tap → resample →
  16 kHz mono PCM16 → Azure Speech **push stream**; RMS level meter from the
  same tap.
- Azure AI Speech JS SDK (`microsoft-cognitiveservices-speech-sdk` from
  jsDelivr, lazy-loaded), `ConversationTranscriber` with diarization toggle,
  en-AU default; live interim results in the Capture view.
- Optional local `MediaRecorder` backup recording offered as a download.
- Phase clicker tags live segments; auto-extraction loop using the Stage 2
  trigger policy (45 s / 70 words / phase change / on demand).

### Stage 5 — Polish ⬜

- Dedupe threshold tuning with real transcripts; merge-suggestion UI.
- Accessibility pass (keyboard-only board operation, ARIA live regions for the
  Present mode), print stylesheet refinements.
- Combined-report appendix options; per-unit finding attribution.
- Optional: ship a `?demo` deep link that auto-loads the sample session.

## Architecture decisions (log)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No build step, plain ES modules | Deployable to SWA by copying files; trivially debuggable at an incident-review timescale; no toolchain rot. |
| 2 | Browser → Azure direct, keys in localStorage | No backend to run or secure; acceptable because keys are the operator's own and scoped resources; clearly documented trade-off. |
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
