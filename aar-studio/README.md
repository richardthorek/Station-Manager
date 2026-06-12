# AAR Studio

AI-facilitated After Action Reviews for fire brigade incidents — run the
session, capture the room, watch findings appear on a live board, then package
a one-page executive snapshot and full summary.

Static web app: plain HTML/CSS/ES modules, **no build step, no backend**.
Speech-to-text and AI analysis call your own Azure resources directly from the
browser; nothing leaves the machine except those calls, and all session data
lives in `localStorage`.

> Status: Stages 1–2 complete (setup, transcript paste ingest, AI extraction,
> live board, review, report editing + exports). Live audio capture and AI
> report generation are next — see [`docs/PLAN.md`](docs/PLAN.md).

## The workflow

1. **Setup** — incident title/date/location/type, AAR date/location,
   facilitator, attending units, configurable phases (default Arrival, Rescue,
   Suppression, Overhaul, plus an implicit General bucket).
2. **Capture** — paste a Teams transcript today (the DOCX copy format,
   `Name: text` lines, or WEBVTT); live audio (room mic / shared Teams tab /
   uploaded file via Azure AI Speech with diarization) arrives in Stage 4.
   Click the current phase as the room moves through it.
3. **Board** — AI extracts discrete findings into four columns (*what
   happened / went well / didn't go well / next time*) with phase chips,
   dedupe, manual quick-add, and a fullscreen high-contrast **Present** mode
   for the projector.
4. **Review** — edit findings and transcript, rename diarised speakers.
5. **Report** — structured report (headline, context bar, key stats, snapshot,
   per-phase detail, themes, recommendations, top three actions, assessment),
   every field editable with live preview. Export a one-page snapshot HTML,
   Markdown summary, session JSON, or print to PDF.

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

### Azure AI Speech (live audio — Stage 4)

Create a Speech resource (e.g. `australiaeast`), and put its key/region in
Settings. Language defaults to `en-AU`; diarization is a toggle. The SDK is
loaded lazily from jsDelivr only when capture starts.

### Key handling — read this

- Keys are stored in **this browser's `localStorage` only** and sent directly
  to your Azure endpoints. There is no server, proxy, or telemetry.
- Treat the browser profile as the security boundary: use a dedicated,
  rotatable key; don't enter keys on shared kiosks; rotate keys after use on
  borrowed machines. For a shared deployment, put the resources behind your
  own subscription and hand out scoped keys per facilitator.

## Deployment (Azure Static Web Apps)

1. Create a **Static Web App** (Free tier is fine), deployment source
   *Other*.
2. Copy the deployment token (Overview → *Manage deployment token*) into the
   repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN_AAR_STUDIO`.
3. Pushes to `main` touching `aar-studio/**` run
   [`.github/workflows/aar-studio.yml`](../.github/workflows/aar-studio.yml):
   tests, then an upload of this directory as-is (`skip_app_build: true`).

`staticwebapp.config.json` ships a CSP (self + `cdn.jsdelivr.net` scripts;
connections limited to Azure OpenAI/Speech domains) and a
`Permissions-Policy` allowing microphone and display capture for this origin
only.

## Repository layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module map and data
model, and [`docs/PLAN.md`](docs/PLAN.md) for the staged roadmap.
