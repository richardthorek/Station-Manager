# Cross-App Consolidation Review & Plan

**Status:** Approved direction — implementation not yet started.
**Date:** 14 June 2026.
**Scope:** Identify and sequence opportunities to consolidate and share
resources across the three codebases that now ship as one Azure App Service
deployment: the main backend (`backend/`), the main frontend (`frontend/`), and
AAR Studio (`aar-studio/`, served at `/aar`).

This document is the source of truth for the consolidation roadmap. Update
`docs/MASTER_PLAN.md` when these items are scheduled into a release.

---

## 1. The landscape

The repo is effectively three codebases under one deployment:

| | Main backend | Main frontend | AAR Studio |
|---|---|---|---|
| Stack | Express 5 + Socket.io + TS | React 19 + Vite + TS | Vanilla HTML/CSS/ES modules, no build |
| Served at | `/api/*` | `/` (SPA) | `/aar` (static mount in `backend/src/index.ts`) |
| Auth | JWT/admin + entitlements | `ProtectedRoute` / feature gates | none |
| Persistence | Table Storage / in-memory (factories) | — | browser `localStorage` only |
| AI today | none | — | Azure OpenAI + Azure Speech, **browser-direct** |
| Brand | red `#e5281B`, lime `#cbdb2a`, Public Sans | (same) | red `#c8102e`, gold `#e8b84b`, system-ui |

The recent integration work makes them **deploy** as one app. They are not yet
**coherent** as one app: they have diverged on brand, AI architecture, identity,
and data. The five opportunities below are ranked by leverage.

---

## 2. Key decision (approved)

**AI is part of the metered paid product.** All AI runs through a single
**server-side gateway**; no production AI feature calls a model provider directly
from the browser.

Rationale: browser-direct calls cannot be entitlement-gated, metered, or
audited, which is incompatible with the SaaS billing model in
`docs/SAAS_COMMERCIALIZATION_DESIGN.md`. Routing through the backend gives one
metering point, one audit trail, per-org entitlement enforcement, and the
freedom to swap providers without touching clients.

**We will manage provider complexity ourselves**, explicitly. The gateway is
**capability-oriented** — separate models, keys, and endpoints per capability
(text, voice/STT+TTS, image) and, where needed, per organisation. There is no
attempt to auto-detect or magically route; configuration is an explicit registry
we own.

**Transition:** AAR Studio keeps its current browser-direct path **only until**
entitlements/metering go live, then migrates behind the gateway in the same wave
as its identity/persistence work (opportunity #3). At that point its `/aar` CSP
can drop the `*.openai.azure.com` / `*.cognitiveservices.azure.com` /
`wss://*.stt.speech.microsoft.com` `connect-src` entries, since the browser will
only talk to our own origin.

---

## 3. Consolidation opportunities (ranked)

### #1 — Server-side AI gateway *(strategic; foundation for all AI)*

**Now:** AAR Studio calls Azure directly (`aar-studio/js/lib/llm.js`,
`reportGen.js`, `extraction.js`, `audio/speech.js`); keys in `localStorage`;
Azure OpenAI `api-version 2024-10-21`; a hand-rolled structured-output fallback
chain (`json_schema → json_object → free-form`). The main app has **no** AI
today. The designed AI Maintenance Agent
(`docs/AI_MAINTENANCE_AGENT_DESIGN.md`) assumes a server gateway with Claude +
Azure Speech behind adapters — i.e. the opposite architecture to AAR's.

**Target design:**

- A `backend/src/services/aiGateway*` module selected via a factory, mirroring
  the existing `dbFactory` pattern (provider-agnostic, swappable, testable).
- **Capability-routed configuration registry.** Each capability resolves to its
  own provider + model/deployment + endpoint + key:

  | Capability | Example providers | Config (env, per-capability) |
  |---|---|---|
  | `text` (chat/extraction/report) | Azure OpenAI, Anthropic | endpoint, key, deployment(s), api-version |
  | `voice` (STT + TTS) | Azure AI Speech | key, region, language, diarization |
  | `image` (future: vision diff, reference-photo compare) | Azure OpenAI vision, others | endpoint, key, deployment |

  Config is explicit and ours to manage; multiple models/keys/endpoints per
  capability are first-class, and a per-organisation override layer is allowed
  for tenancy.
- **Provider adapters** behind one interface so Azure OpenAI and Anthropic (and
  future providers) are interchangeable per capability.
- **Structured-output handling** lifted from `aar-studio/js/lib/llm.js` into the
  gateway (the `json_schema → json_object → free-form extraction` chain), so
  every caller inherits the same resilience.
- **Entitlement gate**: AI routes guarded by `requireFeature('aiEnabled')`
  (extend the existing entitlements middleware).
- **Metering + audit**: a new `AiUsageLog` entity (both DB twins — in-memory and
  Table Storage) recording org, session, capability, provider, model, tokens (or
  duration for voice), cost estimate, and status. This feeds the SaaS
  `UsageRecord` counters.
- **Client contract**: REST for text (e.g. `POST /api/ai/text`); WebSocket relay
  for streaming voice. Clients send intent + payload, never credentials.

**Effort:** M for the gateway + text capability; voice/image added incrementally.
**Risk:** medium. **Dependencies:** none to start; unblocks the maintenance agent
and the AAR migration.

### #2 — Unify the design system *(highest visible impact, lowest risk — do first)*

**Now:** Two brands. Red `#e5281B` vs `#c8102e`; lime `#cbdb2a` vs gold
`#e8b84b`; Public Sans vs system-ui. AAR **fails the kiosk ≥60px touch-target
rule** (buttons 40px, small 30px), has no dark mode, and animates `.live__dot`
ignoring `prefers-reduced-motion`.

**Target:** Extract the canonical RFS tokens (palette, Public Sans, spacing,
radii, the 60px touch-target scale) into a single plain-CSS `:root`
custom-property file consumed by **both** apps — the React app via its existing
import, AAR Studio via a plain `<link>` (no build step needed on either side).
Realign AAR's red/lime/font to canonical, raise touch targets to ≥60px, add
`prefers-reduced-motion` guards. Fold the shared RFS HTML/print report template
in here too (see #5).

**Effort:** S–M. **Risk:** low. **Dependencies:** none — safe to start
immediately and independent of the AI decision.

### #3 — AAR identity & server-side persistence *(unlocks "app picker after login")*

**Now:** `/aar` is open (`backend/src/index.ts:233` applies CSP only, no auth).
Note this is **not** a regression — the main landing page is open too; only
`/admin/*` is `ProtectedRoute`-gated. But AAR sessions live solely in browser
`localStorage` with free-text incident/units/facilitator, so they can't belong
to a brigade or follow a user across devices.

**Target:** Pass the logged-in token into AAR; add `/api/aar-sessions` CRUD
backed by the existing storage factories (new `AARSessions` table, partition by
org/brigade); replace AAR's free-text setup with a station/member picker drawing
on data the main app already holds (also a data-quality win — speaker names
auto-fill from the roster). Migrate AAR's AI behind the gateway (#1) in the same
wave and shrink its CSP.

**Effort:** L. **Risk:** medium. **Dependencies:** rides on #1 (server-side AI
and server-side sessions travel together) and the SaaS/entitlements work.

### #4 — Shared domain types *(pre-existing debt, modest win)*

**Now:** `Station` and `Member` defined twice (`backend/src/types/index.ts` ↔
`frontend/src/types/index.ts`) with drift (Date vs string). AAR's `model.js` is
genuinely disjoint (findings/phases).

**Target:** A `shared/` types module consumed by backend and frontend to stop the
drift. Leave AAR's model alone until #3.

**Effort:** M. **Risk:** low. **Dependencies:** opportunistic — fold into any
backend type churn.

### #5 — Export / report templating *(lower priority than it looks)*

**Now:** Three export paths (`backend/src/services/csvExportService.ts`,
`frontend/src/utils/exportUtils.ts`, `aar-studio/js/lib/exports.js`). Overlap is
smaller than the count suggests — AAR's outputs are a bespoke AAR report format.

**Target:** Share only the RFS-branded HTML/print **template** (header, red
context bar, section styling) that all three reinvent. Piggyback this on the #2
token work rather than running it as a separate project.

**Effort:** S if bundled with #2. **Risk:** low.

---

## 4. Recommended sequence

1. **Design tokens (#2)** — quick, visible, decision-independent; unblocks shared
   report templating (#5). Start now.
2. **Build the AI gateway (#1)** — text capability first, then voice and image;
   entitlement gate + `AiUsageLog` from the outset. The maintenance agent is
   built on it.
3. **AAR identity + server persistence (#3)** — when SaaS/entitlements land;
   migrate AAR behind the gateway and shrink its CSP in the same wave.
4. **Shared types (#4)** — opportunistically, alongside backend type churn.

---

## 5. Follow-ups / open items

- Decide the initial provider per capability (text: Azure OpenAI vs Anthropic;
  voice: Azure Speech) and the per-org override mechanism.
- Define the `AiUsageLog` schema and its mapping to SaaS `UsageRecord` metering.
- Specify the streaming-voice WebSocket contract for the maintenance agent.
- When #3 ships, update `aar-studio/docs/ARCHITECTURE.md` and the `/aar` CSP in
  `backend/src/index.ts` to reflect the gateway-only connect targets.
