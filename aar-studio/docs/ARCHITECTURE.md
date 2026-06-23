# AAR Studio — Architecture

Static web app. No build step, no backend, no dependencies at runtime other
than CDN-loaded Azure SDKs (lazy). Everything below is plain ES modules served
as-is.

## Module map

```
aar-studio/
├── index.html                  # shell: nav, view container, settings <dialog>
├── css/app.css                 # theme (CSS vars), board, present mode, print
├── js/
│   ├── main.js                 # boot (entitlement gate), hash router, nav state, re-render policy
│   ├── store.js                # current session + localStorage persistence, pub/sub
│   ├── settings.js             # Azure config (localStorage), settings dialog, test connection
│   ├── ui.js                   # DOM helpers (h, toasts, download, dialogs) — browser only
│   ├── views/
│   │   ├── home.js             # session list, new/import/sample
│   │   ├── setup.js            # incident/AAR/units/phases form
│   │   ├── capture.js          # phase clicker, paste-transcript ingest, segments, analyse
│   │   ├── board.js            # live findings board + Present mode + quick add
│   │   ├── review.js           # transcript + speaker + findings editing
│   │   └── report.js           # report editor, live preview, exports
│   └── lib/                    # PURE modules — no DOM, covered by node --test
│       ├── model.js            # session/finding/segment factories, categories, validation
│       ├── text.js             # escapeHtml, word counts, slugs, time formatting
│       ├── transcriptParser.js # Teams DOCX paste / "Name: text" / WEBVTT / plain
│       ├── dedupe.js           # near-duplicate finding detection
│       ├── llm.js              # Azure OpenAI chat completions + fallback chain
│       ├── extraction.js       # prompts, schema, chunking, trigger policy
│       ├── serverSync.js       # best-effort mirror of reviews to /api/aar-sessions (SM JWT)
│       ├── entitlement.js      # plan gate: probe /api/auth/entitlements, fail-open decision
│       └── exports.js          # snapshot HTML, Markdown summary, report template
├── data/sample-session.json    # Wamboin structure fire example session
├── test/                       # node:test suites for js/lib (zero deps)
├── package.json                # {"type":"module"} + npm test (node --test)
└── docs/ (ARCHITECTURE.md — the forward plan lives in root docs/MASTER_PLAN.md)
```

Served by the Station Manager Express backend at `/aar` (see "Security /
deployment" below); the security headers it needs are applied there rather than
in a static-host config file.

Views import `store` + `lib`; `lib` never imports views or `ui.js`. `llm.js`
uses only `fetch`, so it is loadable under node for tests.

## Data model (schemaVersion 1)

```jsonc
{
  "id": "uuid", "schemaVersion": 1,
  "createdAt": "ISO", "updatedAt": "ISO",
  "incident": { "title": "", "date": "", "location": "", "type": "" },
  "aar": { "date": "", "location": "", "facilitator": "" },
  "units": [ { "unit": "", "role": "" } ],
  "phases": ["Arrival", "Rescue", "Suppression", "Overhaul"], // General is implicit
  "currentPhase": "General",          // live phase clicker state
  "segments": [ {
    "id": "uuid", "t": 125,            // seconds from start, or null
    "speaker": "Speaker 1",            // raw (diarised) name; display via speakers map
    "text": "", "phase": "Arrival",
    "source": "live" | "paste" | "file",
    "analysed": false                   // consumed by an extraction pass
  } ],
  "findings": [ {
    "id": "uuid",
    "category": "happened" | "well" | "didnt" | "next",
    "phase": "Suppression",            // any session phase or "General"
    "unit": "",                        // optional attending-unit attribution (sessionUnitNames)
    "text": "", "quote": "",          // short verbatim quote
    "segmentIds": ["..."],
    "source": "ai" | "manual" | "merged",
    "createdAt": "ISO"
  } ],
  "speakers": { "Speaker 1": "Dave (Wamboin captain)" },  // rename map
  "report": null | { /* see exports.js emptyReport() */ }
}
```

Persistence: `localStorage["aarstudio.session.<id>"]` per session (autosaved
on every mutation), `aarstudio.settings` for Azure config, `aarstudio.lastSession`
for resume. Import/export is the same JSON via `model.normaliseSession()`.

## LLM integration (Azure OpenAI on Azure AI Foundry)

`POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...`
with `api-key` header, browser → Azure directly.

- Attempt 1: `response_format: { type: "json_schema", json_schema: { strict: true, … } }`
- On HTTP 400 (unsupported): retry with `{ type: "json_object" }`
- On a second 400: retry with no response_format and parse the first JSON
  object out of the reply (``` fences tolerated).
- `temperature`/`max_tokens` are never sent (reasoning-model compatibility).
- Errors map to actionable hints: network/`TypeError` → CORS + endpoint hint;
  401/403 → key; 404 → deployment name / api-version; 429 → rate limit.

Two deployments are configurable: a fast one for live extraction (e.g.
`gpt-4.1-mini`/`gpt-4o`) and an optional larger one for report generation.

### Extraction

Segments are chunked (~450 words, consecutive, phase boundaries respected) and
each chunk sent with: session context (incident, units, phases), the four
category definitions, and prompt rules — fix obvious single-mic mis-hearings
from context, mark uncertain names/figures "(unclear)", keep Australian fire
service terminology (BA, BACO, Cat 1, 38/65 mm, OCC, FRNSW, appliance), skip
small talk and facilitation chatter, every finding carries a short verbatim
quote and its source segment ids. Returned findings pass through
`dedupe.dedupeFindings()` before being added to the board (auto-skip at
similarity ≥ 0.72, same category).

Pairs that fall *below* the auto-skip line but are still plausibly the same
finding (the "soft band", similarity in [0.5, 0.72)) are surfaced on the board
by `dedupe.findMergeSuggestions()` as a "Possible duplicates" panel. The
facilitator can **Merge** them (`dedupe.mergeFindings()` — longer text wins,
quote/segment ids unioned, identity kept) or **Keep both** (dismissed for the
session). Both helpers are pure and covered by `test/dedupe.test.js`.

Live trigger policy (`extraction.shouldAutoExtract`): run when ≥45 s elapsed
since the last pass **and** ≥70 new words are pending, plus immediately on
phase change and on demand. (Wired to the manual Analyse button until Stage 4
adds live audio.)

## Audio pipeline (live listen)

```
mic (getUserMedia) ─┐
tab/system audio    ├─► MediaStream ─► AudioContext ─► AudioWorklet tap
(getDisplayMedia) ──┘                                   │        │
uploaded file ─► decodeAudioData ─► buffer source ──────┘        ├─► RMS level meter
                                                                 ├─► resample → 16 kHz mono PCM16
                                                                 │     └─► Speech SDK push stream
                                                                 └─► MediaRecorder (optional local backup)
```

Speech: `microsoft-cognitiveservices-speech-sdk` from jsDelivr, lazily
injected on first use, `ConversationTranscriber` (diarization toggle, plain
`SpeechRecognizer` when off) with `en-AU` default. All three sources feed the
same push stream, so transcription code has one input path.

Modules: `js/audio/worklet.js` (AudioWorklet PCM tap), `js/audio/speech.js`
(SDK loader + transcriber wrapper), `js/audio/live.js` (singleton controller —
survives view re-renders; final results become session segments tagged with
the current phase; segment timestamps come from the recogniser offset).
`js/analyse.js` owns the shared extraction runner and the live trigger
counters; the controller polls `maybeAutoExtract()` every 5 s and runs a final
pass on stop. Pure helpers (resampling, RMS, speaker labels) live in
`js/lib/audioUtils.js` under test.

## Security / deployment

- Served by the Station Manager Express backend at `/aar` as part of the single
  Azure App Service deployment (no separate hosting resource). The backend
  applies a CSP scoped to `/aar` (`script-src 'self' cdn.jsdelivr.net blob:`;
  `connect-src` limited to `*.openai.azure.com`, `*.cognitiveservices.azure.com`,
  `*.services.ai.azure.com`, `*.api.cognitive.microsoft.com`,
  `wss://*.stt.speech.microsoft.com`; `style-src 'self' 'unsafe-inline'`;
  `frame-src 'self' blob:` for the report preview) plus
  `Permissions-Policy: microphone=(self), display-capture=(self)` — see the AAR
  Studio mount in `backend/src/index.ts`. The main app keeps Helmet's stricter
  global policy.
- Keys are entered by the operator and stay in `localStorage`; the AAR app has
  no server-side logic of its own — calls go browser → Azure directly, nothing
  is proxied or logged. Use scoped, rotatable keys; see README for the
  trade-offs.
- **Plan gate (entitlements).** AAR Studio is part of the AI plan. On boot,
  `main.js` runs `lib/entitlement.js#checkAccess`: if a Station Manager JWT is
  present (`auth_token` in same-origin `localStorage`), it probes
  `GET /api/auth/entitlements` and, on a positive "org lacks `aarStudioEnabled`"
  signal, replaces the app with an upgrade screen linking to
  `/admin/organization`. The check is deliberately **fail-open** — signed-out
  visitors (local-first use), orgs with no entitlement context, and transient
  probe failures all proceed. This is a UX gate only; the security boundary is
  the backend `requireFeature('aarStudioEnabled')` already on `/api/aar-sessions`
  and the AI-gateway routes, which 403/503 an unentitled org regardless.
