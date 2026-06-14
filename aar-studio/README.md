# AAR Studio

AI-facilitated After Action Reviews for fire brigade incidents — run the
session, capture the room, watch findings appear on a live board, then package
a one-page executive snapshot and full summary.

Static web app: plain HTML/CSS/ES modules, **no build step, no backend**.
Speech-to-text and AI analysis call your own Azure resources directly from the
browser; nothing leaves the machine except those calls, and all session data
lives in `localStorage`.

> Status: Stages 1–4 complete — setup, live listen with real-time
> transcription, transcript paste ingest, AI extraction, live board, review,
> AI report generation and all exports. Stage 5 polish remains — see
> [`docs/PLAN.md`](docs/PLAN.md).

## The workflow

1. **Setup** — incident title/date/location/type, AAR date/location,
   facilitator, attending units, configurable phases (default Arrival, Rescue,
   Suppression, Overhaul, plus an implicit General bucket).
2. **Capture** — **live listen**: room microphone (primary mode — one mic,
   many speakers), a shared Teams tab ("Share audio" ticked), or an uploaded
   recording, transcribed in real time by Azure AI Speech with optional
   diarization, interim results on screen, an input level meter, and an
   optional local backup recording offered as a download. Or paste a Teams
   transcript (the DOCX copy format, `Name: text` lines, or WEBVTT). Click
   the current phase as the room moves through it — findings keep flowing
   onto the board automatically (~every 45 s / 70 words, on phase change,
   and on demand).
3. **Board** — AI extracts discrete findings into four columns (*what
   happened / went well / didn't go well / next time*) with phase chips,
   dedupe, manual quick-add, and a fullscreen high-contrast **Present** mode
   for the projector.
4. **Review** — edit findings and transcript, rename diarised speakers.
5. **Report** — AI drafts the structured report from your curated findings
   (headline, context bar, key stats, snapshot, per-phase detail, themes,
   recommendations, top three actions, assessment, verification caveat);
   every field stays editable with live preview. Export a one-page snapshot
   HTML, a combined HTML report (snapshot + full summary + findings register
   + optional transcript appendix), Markdown summary, session JSON, or print
   to PDF.

Load the **Wamboin sample** from the home screen to see a finished session
without any Azure setup.

## Local development

No toolchain needed — serve the directory and open it:

```bash
cd aar-studio
python3 -m http.server 8080     # or: npx serve .
# open http://localhost:8080
```

(Plain `file://` won't work because ES modules and `fetch` need an origin.)

Run the unit tests (pure modules — parser, dedupe, exports, extraction,
LLM fallback chain; zero dependencies):

```bash
npm test     # node --test, Node 22+
```

## Azure setup

You need two resources (both can live in one Azure AI Foundry project):

### Azure OpenAI (findings extraction + report generation)

1. In [Azure AI Foundry](https://ai.azure.com), deploy a chat model — e.g.
   `gpt-4.1-mini` or `gpt-4o` for live extraction. Optionally deploy a larger
   model for report generation.
2. Note the resource **endpoint** (`https://<resource>.openai.azure.com`), the
   **deployment name(s)**, and a **key**.
3. In AAR Studio, open **⚙ Settings**, fill them in, and click
   **Test connection**.

Calls go browser → Azure with the `api-key` header; structured outputs
(`response_format: json_schema, strict`) are used when the api-version/model
supports them, with automatic fallback to `json_object` and then plain-JSON
parsing. `temperature`/`max_tokens` are never sent, so reasoning models work.

### Azure AI Speech (live listen)

Create a Speech resource (e.g. `australiaeast`), and put its key/region in
Settings. Language defaults to `en-AU`; diarization is a toggle (on = speakers
come out as renameable "Speaker 1/2/…"). The SDK is loaded lazily from
jsDelivr only when live listening starts. Microphone access requires HTTPS
(or `localhost`); for Teams meetings, share the **meeting tab** and tick
**Share audio** in the browser picker.

### Key handling — read this

- Keys are stored in **this browser's `localStorage` only** and sent directly
  to your Azure endpoints. There is no server, proxy, or telemetry.
- Treat the browser profile as the security boundary: use a dedicated,
  rotatable key; don't enter keys on shared kiosks; rotate keys after use on
  borrowed machines. For a shared deployment, put the resources behind your
  own subscription and hand out scoped keys per facilitator.

## Deployment (part of Station Manager on Azure App Service)

AAR Studio is **not deployed on its own**. It ships inside the Station Manager
App Service deployment and is served by the Express backend at **`/aar`**,
reachable from the app picker on the landing page. There is no separate
hosting resource, build step, or deploy token.

The security headers AAR Studio needs (a CSP allowing `cdn.jsdelivr.net`
scripts and the Azure OpenAI/Speech connect targets, plus a
`Permissions-Policy` enabling microphone and display capture) are applied by
the backend, scoped to the `/aar` path — see the AAR Studio mount in
`backend/src/index.ts`. The backend looks for this folder at
`../aar-studio` relative to the repo root, overridable with the
`AAR_STUDIO_PATH` environment variable; the deployment package must include
it. (The infrastructure-as-code and the CI workflow that build that package
are maintained separately.)

You can still run it fully standalone for local development with
`python3 -m http.server` (above) — it has no backend dependency of its own.

## Repository layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module map and data
model, and [`docs/PLAN.md`](docs/PLAN.md) for the staged roadmap.
