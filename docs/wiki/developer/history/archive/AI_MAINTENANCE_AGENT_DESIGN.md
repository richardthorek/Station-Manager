> **⚠️ ARCHIVED — not a live plan.** Folded into `docs/MASTER_PLAN.md`
> ("Consolidation & Standardisation Roadmap" → AI maintenance agent track A1/A3/A4).
> Retained for its load-bearing design detail — the new entity schemas
> (`ApplianceZone`, `ApplianceEquipment`, `AgentSession`, `AgentTurn`), the additive
> `Appliance`/`ChecklistItem`/`CheckRun`/`CheckResult` extensions, Table Storage
> partitioning, and the agent tool contract — quote these verbatim when building.

# Design: AI Voice (and Vision) Truck-Maintenance Agent

**Status:** Draft / future release (design only — not yet implemented)
**Author:** Design spike, June 2026
**Related:** `docs/MASTER_PLAN.md`, `docs/AS_BUILT.md` (Truck Check), v1.1 cross-brigade schema

---

## 1. Vision

A hands-free assistant that walks a volunteer through a truck check by voice, and
eventually by camera. The member wears headphones (or uses a phone on a lanyard),
says *"I'm starting the Cat 1 tanker,"* then narrates as they work:

> **Member:** "Starting the Cat 1 tanker."
> **Agent:** "Righto — Cat 1 Tanker 7. Last checked 9 days ago, two open issues from
> then: the driver-side locker latch and the secondary pump prime. Want to start at
> the cab or the pump panel?"
> **Member:** "Cab. Oil's good, coolant's good, lights all working."
> **Agent:** "Got it — engine oil OK, coolant OK, lights OK. While you're in the cab:
> radio check and the BA seat brackets? Those two are still on the Cat 1 list."
> **Member:** "Radio's fine. One BA bracket is cracked."
> **Agent:** "Logging a **issue** on BA seat bracket — want a photo? I'll flag it for
> the captain. Moving to the pump panel next…"

The agent:
- knows **this specific truck** (its layout, equipment, age, and known quirks),
- prompts **follow-ups in the same physical area** ("while you're in the cab…"),
- produces a **formal, auditable check record** *and* keeps the **full transcript**,
- adapts tone/among items by **brigade conventions** and **vehicle age/variant**.

This builds directly on the v1.1 truck-check schema (canonical `vehicleType`,
`itemCode`, `section`) — the agent is a new **input method**, not a new source of truth.

## 2. Goals / non-goals

**Goals**
- Hands-free voice check that yields the same `CheckRun`/`CheckResult` records as the
  manual workflow (compliance + reporting unchanged) **plus** a narrative transcript.
- Per-truck uniqueness: every appliance can have its own zones, equipment, and quirks
  while still mapping to standard codes for cross-brigade analytics.
- Follow-up prompting scoped to the current physical **zone**.
- Brigade- and age-aware nuance via a **hybrid** of structured per-truck data + LLM
  inference (not hand-authored decision trees).

**Non-goals (initially)**
- Offline / on-device speech (Phase 3) — **cloud-only to start** per product decision.
- Native apps — web PWA first.
- Vision — schema is future-proofed now, feature comes in Phase 4.
- Replacing the manual workflow — voice is additive; manual remains.

## 3. Phased delivery

| Phase | Scope | Depends on |
|---|---|---|
| **0 — done (v1.1)** | Canonical `vehicleType`/`itemCode`/`section`, structured CheckRun/CheckResult | shipped |
| **1 — Truck model** | New schema: zones, equipment, vehicle attributes, quirks; admin UI to author them. **No AI.** Independently useful (richer manual checks, sectioned by real zones). | Phase 0 |
| **2 — Voice agent (cloud)** | PWA voice mode → live agent → CheckRun + transcript; hybrid knowledge; readback/confirmation; issue flagging | Phase 1 |
| **3 — Offline + native** | On-device/queued speech, native wrappers | Phase 2 stable |
| **4 — Vision** | Camera frames to a vision model; "show me the gauge"; visual diff vs reference photos | Phase 2 |

Phase 1 is the foundation and is **worth shipping on its own** even before any AI.

## 4. Data schema changes

Design principles (consistent with the existing codebase):
- **Additive & backward-compatible** — every new field is optional; existing
  appliances/templates/runs/results keep working untouched.
- **Two DB twins** — each new entity is implemented in **both** `database.ts`
  (in-memory) and `tableStorageDatabase.ts` (Table Storage), behind the existing
  factory pattern. Shared types in `backend/src/types/index.ts` and mirrored in
  `frontend/src/types/index.ts`.
- **Standardisation *and* uniqueness** — canonical `*Code` slugs (cross-brigade
  analytics) live alongside per-appliance rows (uniqueness). A truck is never forced
  into a shared template; it owns its zones/equipment.
- **Denormalise on write** — like `CheckResult.itemCode`/`section` today, new results
  copy `zoneId`/codes at check time so history stays comparable after later edits.

### 4.1 New entity — `ApplianceZone` (per-truck spatial model)

The core primitive for "every truck is unique" and "prompt in the same area." Replaces
the flat `ChecklistItem.section` string with a real, per-appliance, ordered, optionally
hierarchical set of physical areas.

```typescript
export interface ApplianceZone {
  id: string;
  applianceId: string;          // belongs to exactly ONE truck → uniqueness
  stationId?: string;
  name: string;                 // "Pump Panel", "Driver-side Locker 1", "Cab"
  zoneCode?: string;            // canonical slug for cross-brigade analytics, e.g. 'pump-panel'
  parentZoneId?: string;        // optional hierarchy (Locker 1 under Driver-side lockers)
  side?: 'driver' | 'passenger' | 'front' | 'rear' | 'top' | 'interior' | 'na';
  order: number;                // natural walk-around order (drives agent flow)
  description?: string;
  createdAt: string;
  updatedAt?: string;
}
```

A **standard starter taxonomy** of `zoneCode`s per `vehicleType` (a code-level
vocabulary, like the existing `checklistVocabulary.ts`) seeds a new truck's zones;
the brigade then edits/adds/removes to match the actual vehicle.

### 4.2 New entity — `ApplianceEquipment` (per-truck inventory)

Captures equipment differences between trucks so the agent knows what's actually on
*this* vehicle (and where).

```typescript
export interface ApplianceEquipment {
  id: string;
  applianceId: string;
  stationId?: string;
  name: string;                 // "Holmatro spreader", "BA set #2", "Akron branch"
  equipmentCode?: string;       // canonical slug for analytics
  zoneId?: string;              // where it lives on the truck
  serialNumber?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
```

### 4.3 Extend `Appliance` (vehicle attributes + quirks → age/nuance)

```typescript
export interface Appliance {
  // ...existing: id, name, description?, photoUrl?, stationId?, vehicleType?
  year?: number;                // build year → age-based nuance for the agent
  make?: string;
  model?: string;
  variant?: string;             // e.g. 'Isuzu FTS', 'BTM body'
  registration?: string;
  inServiceDate?: string;
  quirksNotes?: string;         // free-text brigade knowledge: "hatch sticks in cold",
                                // "secondary pump primes slowly" — fed to the LLM
}
```

### 4.4 Extend `ChecklistItem`

```typescript
export interface ChecklistItem {
  // ...existing: id, name, description?, order, referencePhotoUrl?, itemCode?, section?
  zoneId?: string;              // link to ApplianceZone (richer than 'section')
  equipmentId?: string;         // item checks a specific piece of equipment
  expectedResponseType?: 'ok-issue' | 'numeric' | 'level' | 'text';
  unit?: string;                // for numeric, e.g. 'psi', 'L', '%'
  promptHint?: string;          // optional phrasing nudge for the agent
}
```
`section` is retained for backward compatibility; when a `zoneId` is present the zone
name is the source of truth and `section` can be derived.

### 4.5 Extend `CheckRun` (link the session + input source)

```typescript
export interface CheckRun {
  // ...existing fields
  source?: 'manual' | 'voice' | 'voice-vision';   // default 'manual'
  agentSessionId?: string;                         // → AgentSession
}
```

### 4.6 Extend `CheckResult` (voice provenance + values + review)

```typescript
export interface CheckResult {
  // ...existing: id, runId, itemId, itemName, status, comment?, photoUrl?,
  //              completedBy?, stationId?, itemCode?, section?
  zoneId?: string;              // denormalised at check time (like itemCode/section)
  source?: 'manual' | 'voice' | 'voice-vision';
  capturedValue?: string;       // spoken value, e.g. "32 psi", "3/4 tank"
  confidence?: number;          // 0–1 agent confidence in the mapping
  needsReview?: boolean;        // low confidence / ambiguous → human sign-off
}
```

### 4.7 New entities — `AgentSession` + `AgentTurn` (the "both" answer)

The formal `CheckRun` stays the compliance record; the session captures the full
narrative transcript and provenance as supporting evidence.

```typescript
export interface AgentSession {
  id: string;
  runId?: string;               // linked CheckRun (the formal output)
  applianceId: string;
  stationId?: string;
  startedBy: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'abandoned';
  modality: 'voice' | 'voice-vision';
  language?: string;            // e.g. 'en-AU'
  summary?: string;             // LLM end-of-session summary
  models?: string;              // provenance, e.g. "claude-opus-4-8; azure-speech"
  createdAt: string;
  updatedAt?: string;
}

export interface AgentTurn {
  id: string;
  sessionId: string;
  role: 'user' | 'agent' | 'system';
  text: string;                 // transcribed speech or agent utterance
  timestamp: string;
  audioRef?: string;            // optional Blob ref IF audio retention is enabled (privacy-gated)
  imageRef?: string;            // Phase 4: captured camera frame (Blob ref)
  linkedItemId?: string;        // the checklist item this turn resolved
  linkedResultId?: string;      // the CheckResult it produced
  confidence?: number;
}
```

**Storage strategy (Table Storage twin):**
- `ApplianceZones`, `ApplianceEquipment`: PartitionKey = `applianceId` (or `stationId`),
  RowKey = `id`.
- `AgentSessions`: PartitionKey = `applianceId` (or `stationId`), RowKey = `id`.
- `AgentTurns`: PartitionKey = `sessionId`, RowKey = `timestamp`-ordered id — keeps a
  session's transcript in one partition for cheap sequential reads.
- Large/binary artifacts (audio frames, images) go in **Blob Storage** via the existing
  `azureStorage.ts` (new containers `agent-audio`, `agent-frames`), referenced by
  `audioRef`/`imageRef`. Transcript **text** stays in Table Storage.

### 4.8 Standardisation vs uniqueness (how both hold)

| Concern | Standard (cross-brigade) | Unique (per-truck) |
|---|---|---|
| Vehicle class | `Appliance.vehicleType` slug | `make/model/variant/year` |
| Areas | `ApplianceZone.zoneCode` slug | the actual `ApplianceZone` rows per truck |
| Items | `ChecklistItem.itemCode` slug | per-appliance template + `zoneId` |
| Equipment | `ApplianceEquipment.equipmentCode` | per-appliance equipment rows |
| Quirks | — | `Appliance.quirksNotes`, equipment `notes` |

Reporting/analytics join on the canonical `*Code`s; the agent and the check operate on
the per-truck rows. No truck is forced to share another's layout.

## 5. Agent runtime (Phase 2, cloud-only)

```
Headphones ⇄ PWA (mic capture, audio playback)
                 │  audio stream (WebSocket)
                 ▼
        Backend "agent gateway"
        ├─ STT (streaming)            ─┐
        ├─ Agent orchestrator (LLM)    │  provider-agnostic adapters
        └─ TTS (streaming)            ─┘
                 │  tool calls
                 ▼
        Truck-check services (existing factories)
        get_appliance_context · record_result · flag_issue ·
        next_unchecked_in_zone · complete_run
                 │
                 ▼
        CheckRun + CheckResult (formal)  +  AgentSession/AgentTurn (transcript)
```

**Orchestration via tool use.** The LLM drives the dialogue and calls tools to read
context and persist structured results — it never writes the DB directly:
- `get_appliance_context(applianceId)` → zones (ordered), items grouped by zone,
  equipment, vehicle attributes, `quirksNotes`, last check + open issues.
- `record_result(itemId, status, capturedValue?, comment?, confidence)` → `CheckResult`
  with `source:'voice'`.
- `flag_issue(itemId, detail, wantsPhoto)` → issue result + optional photo capture.
- `next_unchecked_in_zone(zoneId)` / `open_issues(applianceId)` → drive "same area"
  follow-ups.
- `complete_run()` → close `CheckRun`, write `AgentSession.summary`.

**Hybrid knowledge (the nuance).** The prompt is grounded in the truck's structured
data (zones/equipment/attributes/quirks/history); the LLM *infers* natural follow-ups
and age/variant adjustments from it (e.g., older `year` + a `quirksNotes` hint →
"check the secondary prime, it's slow on this one"). Brigades author **facts**, not
dialogue trees.

**Compliance safety:**
- **Read-back & confirm** each recorded result; ambiguous/low-confidence →
  `needsReview:true` for human sign-off in the admin dashboard.
- The formal `CheckRun` is the audit record; the transcript is supporting evidence with
  model provenance (`AgentSession.models`).
- Corrections are first-class ("no, that was the other tank") → the agent revises the
  `CheckResult` and logs the correction as a new turn.

**Suggested stack (provider-agnostic behind adapters):** Claude (Anthropic API) for the
agent reasoning/tool-use; Azure AI Speech for streaming STT/TTS (good en-AU support,
fits the Azure footprint). Both sit behind interfaces so either can be swapped, and so a
single realtime voice model could replace the STT+TTS pair later.

## 6. Vision (Phase 4) — already accommodated

- `AgentSession.modality:'voice-vision'`, `AgentTurn.imageRef` (Blob frame).
- The agent can request a frame ("show me the gauge"), send it to a vision-capable model,
  and **diff against `ChecklistItem.referencePhotoUrl`** (already in the schema).
- `ApplianceZone` can later gain optional position metadata for AR overlays without a
  breaking change.

## 7. Privacy, compliance, cost

- **Audio retention OFF by default.** Store transcript **text** + structured results;
  raw audio only if a brigade opts in (consent + retention policy), in Blob with a TTL.
- **Data minimisation / audit:** provenance, confidence, `needsReview`, and correction
  turns give a defensible trail. Aligns with the existing `EventAuditLog` philosophy.
- **Cost:** per-session LLM tokens + speech minutes. Sessions are short and bursty —
  a strong fit for the **scale-to-zero Container Apps** option in `infra/` (pay per
  active session, ~$0 when idle). Add per-brigade usage caps.

## 8. Open questions (for build time, not blocking design)

- Streaming transport: extend the existing Socket.io channel vs a dedicated audio WS.
- STT/TTS provider final pick + en-AU accuracy on fire-service jargon (custom vocab).
- Barge-in / interruption handling and noise robustness in a loud shed.
- How aggressively to auto-complete unspoken items (reuse the "mark remaining as OK"
  pattern, but voice-confirmed).
- Exact canonical zone/equipment vocabularies per `vehicleType` (RFS SMEs to seed).

## 9. Summary of schema deltas

- **New:** `ApplianceZone`, `ApplianceEquipment`, `AgentSession`, `AgentTurn`
  (both DB twins + shared types + factories; new Blob containers for audio/frames).
- **Extended (all optional):** `Appliance` (+year/make/model/variant/registration/
  inServiceDate/quirksNotes), `ChecklistItem` (+zoneId/equipmentId/expectedResponseType/
  unit/promptHint), `CheckRun` (+source/agentSessionId), `CheckResult` (+zoneId/source/
  capturedValue/confidence/needsReview).
- **Vocabulary (code-level, not DB):** canonical `zoneCode`/`equipmentCode` starter
  taxonomies per `vehicleType`, mirroring `checklistVocabulary.ts`.

Nothing here breaks existing data: a truck with no zones/equipment/attributes behaves
exactly as today, and the voice layer is purely additive.
