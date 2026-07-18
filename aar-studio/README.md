# AAR Studio — part of StationKit

AI-facilitated After Action Reviews for volunteer emergency-services crews —
run the session, capture the room, watch findings appear on a live board,
then package a one-page executive snapshot and full summary. AAR Studio is
one of the **StationKit** apps — a suite of simple tools built for the crew.

Static web app: plain HTML/CSS/ES modules, **no build step**. By default,
speech-to-text and AI analysis go through the Station Manager backend's
**AI gateway** (`/api/ai/*`) so credentials stay server-side and usage is
metered against your plan — see the main app's `docs/wiki/developer/architecture.md`. For local
development you can still bring your own Azure resources via the Settings screen
(the browser then calls Azure directly). Session data lives in `localStorage`.

> Status: Stages 1–4 complete — setup, live listen with real-time
> transcription, transcript paste ingest, AI extraction, live board, review,
> AI report generation and all exports. Stage 5 polish remains — tracked in the
> root [`docs/MASTER_PLAN.md`](../docs/MASTER_PLAN.md) (roadmap item P1); stage
> history archived at [`docs/wiki/developer/history/archive/AAR_STUDIO_PLAN.md`](../docs/wiki/developer/history/archive/AAR_STUDIO_PLAN.md).

## The workflow

The app is built for a non-technical facilitator: **just talk, and it does the
heavy lifting.** You can fill in details if you want to, but you never have to.

1. **Start recording now** (quick kick-off) — one tap creates a review with
   today's date/time (and the device's location if allowed), then starts the
   room microphone immediately. No form to fill first. (Prefer to enter the
   incident title/location/units up front? "Set up a review first" is there too,
   but it's optional.)
2. **Capture** — room microphone (one mic, many speakers), a shared Teams tab
   ("Share audio" ticked), or an uploaded recording, transcribed in real time by
   Azure AI Speech with optional diarization, interim results on screen, a level
   meter, and an optional local backup recording. **No phase-clicking and no
   "analyse" button** — findings appear automatically as the discussion goes on,
   and the AI works out which incident phase each one belongs to. On stop, it
   also fills in any blank incident details (title, location, attending crews,
   type) from what was said.
3. **Findings** — discrete findings land in four columns (*what happened / went
   well / didn't go well / next time*) with phase chips, dedupe, manual
   quick-add, and a fullscreen high-contrast **Present** mode for the projector.
4. **Edit** — adjust findings and transcript, rename speakers — only if you want
   to. The defaults are meant to stand on their own.
5. **Report** — AI drafts the structured report from the findings (headline,
   context bar, key stats, snapshot, per-phase detail, themes, recommendations,
   top three actions, assessment, verification caveat); every field stays
   editable with live preview. Export a one-page snapshot HTML, a combined HTML
   report, Markdown summary, a backup file, or print to PDF.

Choose **See an example** on the home screen to explore a finished review
without any Azure setup — or open the app with `?demo` (e.g. `/aar/?demo`) to
jump straight into that example, handy for sharing a walkthrough link.

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
model. The staged roadmap is folded into the root
[`docs/MASTER_PLAN.md`](../docs/MASTER_PLAN.md) (stage history archived at
[`docs/wiki/developer/history/archive/AAR_STUDIO_PLAN.md`](../docs/wiki/developer/history/archive/AAR_STUDIO_PLAN.md)).
