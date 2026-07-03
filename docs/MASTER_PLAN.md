# RFS Station Manager — Master Plan

**Last updated:** 2026-07-03 (AAR hero reliability + report attribution shipped — AAR-6/8/1/7/19; queue renumbered, AAR polish now leads as Q1)
**Status:** Living document — **the single plan** for all three apps (`backend/`, `frontend/`, `aar-studio/`) and the Bushie Tools suite.

---

## What this document is (and isn't)

- **This is the only plan.** All planning and forward intent lives here. No other planning, roadmap, design-spike, or "future work" document may exist anywhere in the repo. To capture future work or a change of direction, edit this file.
- **This document looks forward.** Shipped work is recorded once — as a dated entry in the [changelog](wiki/developer/changelog.md) — and then only its *consequence* stays here (a status flip on the board below, an item removed from the queue). Do not accumulate per-session shipping narratives in this file.
- **The `docs/` folder holds exactly three things:**
  1. `docs/MASTER_PLAN.md` — this plan.
  2. `docs/registers/` — the machine-readable technical registers describing the backend (`api_register.json`, `function_register.json`, `openapi.yaml`).
  3. `docs/wiki/` — wiki-style documentation: `wiki/developer/` (architecture, guides, changelog, historical reference) and `wiki/user-guide/` (the end-user guide).

  Nothing else goes under `docs/`. See `CLAUDE.md` for the enforcement rules.

---

## Product snapshot (July 2026)

**RFS Station Manager** is a real-time digital sign-in and station-management system for NSW Rural Fire Service brigades, in production at `bungrfs-linux.azurewebsites.net` as one Azure App Service deployment containing three apps:

| App | Serves | Stack |
|---|---|---|
| `backend/` | `/api/*`, Socket.io, `/ws/agent-check` | Express 5 + TypeScript, Azure Table Storage (in-memory twin for dev/tests) |
| `frontend/` | `/` (SPA, PWA) | React 19 + Vite 7 + TypeScript |
| `aar-studio/` | `/aar` | No-build vanilla ES modules |

**Version:** v1.1 in production. Sign-in, events, member profiles, truck checks (manual + voice agent), reports/export, multi-station, AAR Studio, SaaS tenancy + Stripe billing are all live. Features are gated per-organization by plan entitlements (Community / Basic / AI Pro).

**Guiding ethos — "for the average bushie."** Design for the older, less tech-savvy firefighter as much as the young guns: plain language, minimum friction, big touch targets, "just talk / just tap" flows. If a bushie can't use it cold, it's not done.

---

## Feature status board

One row per function/feature of the product. Status: ✅ shipped & stable · 🟡 shipped with known gaps · 🔵 blocked on a decision · ⬜ not started. "Remaining" points into the queue below.

| # | Feature / function | Status | Remaining |
|---|---|---|---|
| 1 | **Sign-in & check-in/out** (kiosk, mobile, QR, real-time sync) | ✅ | Minor perf polish (Q11) |
| 2 | **Events & activities** (create/end events, participants, audit trail) | ✅ | — |
| 3 | **Member profiles & achievements** (QR codes, stats, 20 achievements) | ✅ | — |
| 4 | **Member management** (search/filter/sort, CSV import, invite/activation) | ✅ | — |
| 5 | **Truck check — manual** (vehicle types, locked standard checklists, zones/equipment, issue lifecycle, member attribution) | ✅ | Cross-brigade comparative reporting (Q6); vehicle mgmt surfacing (Q11) |
| 6 | **Truck check — voice agent (A3)** (hold-to-talk PWA → server-side STT → tool loop → TTS; hardened per F1–F16 review) | 🟡 | iPad on-device verification (Q4); pilot rollout (Q5); VAD/continuous listening (Q15); vision + offline = A4 (Q16) |
| 7 | **Reports & analytics** (dashboard, cross-station, CSV/PDF export) | ✅ | Advanced analytics dashboard #123 (Q14) |
| 8 | **AAR Studio — THE HERO** (AI-facilitated After Action Reviews, cloud sync, collab notes, dedupe/merge) | 🟡 | Reliability hardening (AAR-6/8/1/7) + report attribution (AAR-19) shipped 2026-07-03; remaining polish + collab/export batch per [AAR review](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md) (Q1, Q3); CSP shrink (Q10) |
| 9 | **Multi-station** (isolation, station mgmt UI, national RFS dataset lookup, demo station) | ✅ | Migration scripts deferred until a real multi-brigade migration needs one |
| 10 | **SaaS tenancy & entitlements** (Organization, plans, `requireFeature` both-sides gating, limits) | ✅ | `maxDevices` unenforced by design (devices dropped from pricing) |
| 11 | **Stripe billing** (Checkout, Portal, webhooks, trial, audit trail, AI top-up packs) | 🟡 | Metered overage needs a Stripe meter + D1 pricing decisions (Q7); device accounts (Q8) |
| 12 | **AI gateway & metering** (`/api/ai/*`, server-side keys, session allowance) | ✅ | Anthropic adapter is a stub (fine until needed) |
| 13 | **Suite federation — Bushie Tools Phase 1** (SM JWT as suite IdP, `/api/auth/entitlements`, app launcher) | ✅ | Phases 2–3: shared packages, monorepo (Q17, Q18) |
| 14 | **PWA / offline** (service worker, install prompt, offline queue) | ✅ | Double SW-registration log (Q12); deeper offline is part of A4 |
| 15 | **Auth & security** (JWT + brigade tokens + demo bypass, `requireSession` read gate, rate limiting, CSP/Helmet) | ✅ | — |
| 16 | **Infra & deploy** (Bicep IaC, GitHub Actions → Linux App Service, run-from-package, post-deploy smoke tests) | ✅ | OIDC bootstrap documented; watch item only |
| 17 | **Notifications (email/SMS)** #120 | ⬜ | Not started (Q13) |
| 18 | **Documentation** (this restructure: plan + registers + wiki) | 🟡 | User-guide screenshots; content refresh of migrated dev pages (Q9) |

---

## Prioritised next steps (the queue)

The single ordered work queue across every track. Work top-down; re-order here when priorities change. Each item says why it's ranked where it is.

> **Hero directive (owner, 2026-07-03):** AAR Studio is the headline feature —
> it is what sells the app. The AAR hero-review findings
> ([AAR_STUDIO_REVIEW_20260703](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md),
> AAR-1…AAR-24 with a full implementation ranking) therefore lead this queue.

### Now

- **Q1 — AAR hero polish: finish the sell.** AAR-6/8/1/7 (reliability) and AAR-19 (report attribution) are shipped — remaining, in rank order: **AAR-15** (sync 409 conflicts detected but invisible while editing), **AAR-10** (persistent AI failures toast every 45 s for the rest of the meeting), **AAR-3** (quick-start GPS coordinates permanently block the AI's real location name), **AAR-11** (metering counts a session per token vend — now more pressing since the AAR-6 refresh timer/reconnects call the vend endpoint more often), **AAR-9/23** (gateway users told to "check Azure keys"), **AAR-2** (native `prompt`/`confirm` still used elsewhere — the AAR-1 fix added *better-labelled* confirms, not different dialogs).
- **Q2 — D1 pricing decisions (owner).** Confirm: trial length (14 vs 30 days, AI included?), AI metering unit (session vs audio-minute; see AAR-11 for why per-vend is wrong), top-up pack size/price, per-org vs per-station billing for district orgs, grant/PO invoicing. *Blocks Q7. Decision, not code.*

### Next

- **Q3 — AAR remaining batch: complete the collab promise + lows.** **AAR-21** (room notes appear in no export — contributors never see their words in the record), **AAR-20** (iframe print path; the long-open P1 print-stylesheet item — verify on iPad), and the low-severity sweep (AAR-4, 5, 12, 13, 14, 16, 17, 18, 22, 24), folded into whichever files Q1 already touches.
- **Q4 — Voice agent: iPad on-device verification.** The F8 audio fixes were built against documented iOS Safari behaviour but have never run on a physical iPad. Run a full voice check on iPad (portrait + landscape), capture the screenshots the PR convention requires, log device-specific breakage. *Blocks Q5; batch with an on-device check of the AAR live-listen reconnect logic shipped 2026-07-03 (AAR-6/8).*
- **Q5 — Voice agent: pilot rollout.** After Q4, enable for 1–2 pilot AI-plan brigades and gather feedback (noise handling, phrasing, turn caps). Hardening (F1–F16) is done; this is product feedback, not engineering.
- **Q6 — Truck check: cross-brigade comparative reporting.** The point of locked standard checklist items with stable `itemCode`s (TC-D1): compare outcomes for the same vehicle type across brigades. Aggregation by `vehicleType` + `itemCode` and a report view.
- **Q7 — Billing: metered AI overage end-to-end.** `meteredUsageReporter.ts` is a safe no-op until a Stripe meter is configured. After Q2: create the meter, map `UsageRecord` → meter events, verify an overage invoice in test mode. Include the AAR-11 session-vs-vend fix.
- **Q8 — C4 remainder: device accounts.** Formalise `BrigadeAccessToken` into first-class `Device` accounts (named kiosk devices, revocation, per-device audit) — the remaining half of SaaS Phase C.
- **Q9 — Wiki content refresh.** Sweep migrated developer pages for staleness (known: deployment-optimization + ci-pipeline pre-Linux framing), and add screenshots to the user guide (combine with Q4's iPad session).

### Later

- **Q10 — AAR Studio: shrink the `/aar` CSP.** Blocked: live transcription still uses the Azure Speech SDK browser-direct (`wss://*.stt.speech.microsoft.com`), so the CSP must keep provider hosts. Unblocks if AAR moves to a backend speech proxy like the voice agent's (`agentSpeech.ts` pattern) — the CSP hosts are unrelated to AAR-6's now-shipped token-refresh/reconnect fix, so this stays blocked on the proxy move itself.
- **Q11 — Truck check: surface vehicle management.** Vehicle CRUD is buried inside the admin dashboard (old TC-6). Small UX task.
- **Q12 — Frontend polish batch.** Known minor UAT leftovers: double service-worker registration log; `/login` and `/profile/:memberId` settle in 3.5–5s vs near-instant elsewhere.
- **Q13 — Notifications (email/SMS) #120.** Event reminders and issue-assignment notifications. Design the provider choice (ACS vs SendGrid vs Twilio) first; the truck-check issue lifecycle (`assignedTo`) is the obvious first consumer.
- **Q14 — Advanced analytics dashboard #123.** Value unproven — validate demand with pilot brigades before building.
- **Q15 — Voice agent: continuous listening (VAD).** Swap push-to-talk for voice-activity detection behind the same WS frames. Gather pilot feedback first.
- **Q16 — A4: vision + offline agent phase.** Camera frames + visual diff against `referencePhotoUrl`; on-device speech for offline sheds. Do not start until the voice agent has pilot mileage.
- **Q17 — T6: suite shared packages.** npm/pnpm workspace, `@rfs/ui` / `@rfs/types` / `@rfs/auth-sdk`; sibling repos consume `/api/auth/entitlements`; SSO redirect for cross-origin apps. (#557)
- **Q18 — T7: suite monorepo consolidation.** Turborepo; Fire Break Calculator embedded; Fire Santa Run seasonal peer; converge backends onto Express; one pipeline. Depends on Q17 and a commercial reason. (#558)
- **Q19 — T1 remainder: shared truck-check types.** Fold `Appliance`/`VehicleType`/`ChecklistItem`/`CheckRun`/`CheckResult` into `shared/domain-types.d.ts` like the sign-in types.

---

## Open decisions

| ID | Decision | State |
|---|---|---|
| **D1** | Pricing details: trial length, AI metering unit, top-up sizes, org- vs station-level billing, grant/PO invoicing, AAR-in-Basic?, Fire Break tier placement, Santa Run seasonal billing | 🔵 **Open — owner.** Blocks Q7; see Q2 |
| **D2** | Suite auth standard: SM JWT vs Entra External ID | ✅ Resolved — keep SM JWT (kiosk brigade-token model needs it). Revisit only if cross-origin SSO becomes real (Q17) |
| **D3** | Streaming-voice architecture | ✅ Resolved 2026-06-29 — backend proxies audio; Azure OpenAI function calling; same App Service, 30-s WS pings |
| **D4** | Real-time transport at scale: Socket.io vs Azure Web PubSub | 🔵 Open, not urgent — current lean: adopt *Web PubSub for Socket.IO* (keeps code) when multi-brigade scale needs a backplane |
| **D5** | Deploy size/time | ✅ Resolved 2026-06-22 — run-from-package cut the deploy step from ~8 min to <1 min |

---

## Pricing & plans (reference)

The live catalog is code (`backend/src/constants/plans.ts`); this is the intended commercial shape. Full rationale: [SAAS_COMMERCIALIZATION_DESIGN](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md) §7.

| Tier | Price (AUD) | Members | Vehicles | Includes |
|---|---|---|---|---|
| **Community** (free) | $0 | up to 10 | 1 | Manual sign-in + 1 vehicle check, single station |
| **Basic** | $10/mo · $100/yr | unlimited | unlimited | Full manual suite + reports & CSV export, multiple stations |
| **AI Pro** | $19/mo · $190/yr | unlimited | unlimited | Basic + AAR Studio (~25 AI sessions/mo) + voice agent |
| **Bushie Suite** *(planned)* | $29/mo · $290/yr | unlimited | unlimited | AI Pro + all Bushie Tools apps (after Q17/Q18) |

Stripe AU ≈ 1.75% + $0.30; AI ≈ $0.60/AAR session; annual = 2 months free. `maxDevices` remains in the model but is deliberately unenforced (devices dropped from pricing in #574).

---

## Risk register

| ID | Risk | P | I | Mitigation |
|---|---|---|---|---|
| R1 | Database outage affects all stations | Low | High | Azure SLA, automated backups, DR plan |
| R2 | Scaling issues as adoption grows | Med | Med | Table Storage auto-scales; D4 backplane decision ready when needed |
| R3 | Data loss / corruption | Low | High | Backups, point-in-time restore, audit logs |
| R4 | Security breach / data leak | Low | High | `requireSession` read gate, entitlement gating both sides, rate limits, periodic reviews (last: A3 F1–F16, 2026-07) |
| R5 | Key-person dependency | Med | Med | This plan + wiki + registers kept current (see CLAUDE.md rules) |
| R6 | Azure cost overrun | Low | Med | Cost monitoring; Table Storage chosen for cost; AI metered per session |
| R7 | Low user adoption | Med | High | "Average bushie" ethos, pilot feedback loops (Q5), station champions |
| R8 | Regressions during refactors | Med | Med | CI gates (typecheck, tests, lint, coverage), post-deploy smoke tests |
| R9 | Dependency vulnerabilities | Med | Med | Dependabot grouped PRs, security scanning |
| R10 | Rural connectivity | High | Med | PWA offline queue; A4 offline agent phase (Q16) |

---

## Where everything else lives

| Content | Location |
|---|---|
| Shipped-work history (dated entries, version log) | [`docs/wiki/developer/changelog.md`](wiki/developer/changelog.md) |
| Architecture of record | [`docs/wiki/developer/architecture.md`](wiki/developer/architecture.md) |
| Machine-readable API/function registers + OpenAPI | [`docs/registers/`](registers/) |
| Human API reference, dev guides, deployment, CI, security, testing | [`docs/wiki/developer/`](wiki/developer/README.md) |
| End-user guide | [`docs/wiki/user-guide/`](wiki/user-guide/README.md) |
| Historical design spikes, reviews, implementation notes | [`docs/wiki/developer/history/`](wiki/developer/history/) |
| AAR Studio internals | `aar-studio/docs/ARCHITECTURE.md` |
| Repo conventions for AI agents | `CLAUDE.md` |

**Maintaining this plan:** at the end of every working session, (1) add a dated entry to the wiki changelog describing what shipped, (2) update the status board and queue here — flip statuses, delete finished queue items, insert new ones in priority order. Keep this file about the future.
