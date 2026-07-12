# RFS Station Manager — Master Plan

**Last updated:** 2026-07-11 (#620 — vehicle type templates: 20 pre-provisioned standards across NSW RFS, Fire & Rescue NSW, NSW SES, Marine Rescue NSW, and Generic; seeded idempotently; built-in protection via 403 on edit/delete; completed); 2026-07-10 (#617 — truck-check result-save 400 fixed (blank item description), vehicle roster with cancel/finalise for stuck runs, new `DELETE /api/truck-checks/runs/:id`; partially addresses Q8); 2026-07-06 (AC-2 shipped — ephemeral visitor sign-ins; sign-in book responsive audit — fixed profile-hero mobile stacking + event-tab/New-Event phone collision; AC-1 shipped — personal member link mints a station-scoped read session; AC-5 shipped — first-class Device accounts; sign-in book gated behind a brigade code / account / member-session / demo; Q5 shipped — cross-brigade comparative truck-check reporting)
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
| 1 | **Sign-in & check-in/out** (kiosk, mobile, QR, real-time sync) | ✅ | Access rework in progress (AC-3, AC-4 below; AC-1 personal-link credential + AC-2 visitor sign-ins + AC-5 device accounts shipped); minor perf polish (Q9) |
| 2 | **Events & activities** (create/end events, participants, audit trail) | ✅ | — |
| 3 | **Member profiles & achievements** (QR codes, stats, 20 achievements) | ✅ | — |
| 4 | **Member management** (search/filter/sort, CSV import, invite/activation) | ✅ | — |
| 5 | **Truck check — manual** (vehicle types, locked standard checklists, zones/equipment, issue lifecycle, member attribution, cross-brigade comparative reporting) | ✅ | Vehicle mgmt surfacing (Q8) |
| 6 | **Truck check — voice agent (A3)** (hold-to-talk PWA → server-side STT → tool loop → TTS; hardened per F1–F16 review) | 🟡 | iPad on-device verification (Q3); pilot rollout (Q4); VAD/continuous listening (Q12); vision + offline = A4 (Q13) |
| 7 | **Reports & analytics** (dashboard, cross-station, CSV/PDF export) | ✅ | Advanced analytics dashboard #123 (Q11) |
| 8 | **AAR Studio — THE HERO** (AI-facilitated After Action Reviews, cloud sync, collab notes, dedupe/merge) | 🟡 | Hero-polish batch + insight-quality/session-clarity rework + the whole AAR review remaining batch shipped per [AAR review](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md); remaining: live-validate consolidation quality (Q1), iPad print verify (Q3), CSP shrink (Q7) |
| 9 | **Multi-station** (isolation, station mgmt UI, national RFS dataset lookup, demo station) | ✅ | Migration scripts deferred until a real multi-brigade migration needs one |
| 10 | **SaaS tenancy & entitlements** (Organization, plans, `requireFeature` both-sides gating, limits) | ✅ | `maxDevices` unenforced by design (devices dropped from pricing) |
| 11 | **Stripe billing** (Checkout, Portal, webhooks, trial, audit trail, AI top-up packs) | 🟡 | Metered overage needs a Stripe meter + D1 pricing decisions (Q5); device accounts shipped (AC-5) but unmetered — `maxDevices` still unenforced per #574 |
| 12 | **AI gateway & metering** (`/api/ai/*`, server-side keys, session allowance) | ✅ | Anthropic adapter is a stub (fine until needed) |
| 13 | **Suite federation — Bushie Tools Phase 1** (SM JWT as suite IdP, `/api/auth/entitlements`, app launcher; `fireBreakEnabled` granted on Basic + AI Pro — Fire Break Calculator cloud saved plans authenticate against SM) | ✅ | Run `grant:firebreak` backfill after deploy; add the FBC origin to `FRONTEND_URLS`; Phases 2–3: shared packages, monorepo (Q14, Q15) |
| 14 | **PWA / offline** (service worker, install prompt, offline queue) | ✅ | Double SW-registration log (Q9); deeper offline is part of A4 |
| 15 | **Auth & security** (JWT + brigade tokens + demo bypass, `requireSession` read gate, rate limiting, CSP/Helmet) | ✅ | — |
| 16 | **Infra & deploy** (Bicep IaC, GitHub Actions → Linux App Service, run-from-package, post-deploy smoke tests) | ✅ | OIDC bootstrap documented; watch item only |
| 17 | **Notifications (email/SMS)** #120 | ⬜ | Not started (Q10) |
| 18 | **Documentation** (this restructure: plan + registers + wiki) | 🟡 | User-guide screenshots; content refresh of migrated dev pages (Q6) |

---

## Prioritised next steps (the queue)

The single ordered work queue across every track. Work top-down; re-order here when priorities change. Each item says why it's ranked where it is.

> **Hero directive (owner, 2026-07-03):** AAR Studio is the headline feature —
> it is what sells the app. The AAR hero-review findings
> ([AAR_STUDIO_REVIEW_20260703](wiki/developer/history/reviews/AAR_STUDIO_REVIEW_20260703.md),
> AAR-1…AAR-24 with a full implementation ranking) therefore lead this queue.

### Access & membership rework (owner, 2026-07-04) — in progress

The agreed model for how anonymous access, membership, and subscriptions fit together — a themed initiative tracked here rather than as scattered Q-items. **The principle:** the walk-up apps (sign-in, truck check) are only reachable with a legitimate access credential — a brigade device code, a member's personal link, or the public demo — never by typing the bare URL. *Managing* a brigade (adding members, minting links/QR, reports) always needs a signed-in account; that account can be free within limits (the Community plan, ≤10 members) or paid. A paid brigade's owner can already add helpers as `owner`/`admin`/`viewer` users. Visitors can always sign in at a kiosk/brigade URL but get no history and must retype their name each time — they are not a workaround for the member cap.

- **Shipped (2026-07-04):** `AccessRoute` gate on `/signin` — a bare visit with no brigade code / account / demo now redirects to the front door instead of opening the book on the demo/default station. Explicit "Try the demo" button + session-sticky demo mode. See changelog.
- **AC-1 — Personal member link as a real credential. ✅ Shipped 2026-07-04.** `POST /api/checkins/url-checkin` now mints a short-lived (8h), station-scoped member-session JWT on check-in; `flexibleAuth`/`requireSession` recognise it via `X-Member-Session` (station-wide read, never more); `SignInLinkPage` stores it and now opens `/signin` instead of dead-ending at "Done". See changelog.
- **AC-2 — Visitor sign-ins. ✅ Shipped 2026-07-06.** New ephemeral check-in path: `POST /api/events/:eventId/visitors` records a typed name as an `EventParticipant` (`isVisitor: true`, synthetic `visitor-<uuid>` id) but never persists a `Member` — no history, never counts toward `maxMembers`, no toggle (every submit is a fresh row). `MemberNameGrid` gets a "+ Visitor" affordance that reveals a name input; visitors show a "Visitor" badge in the roster and can be removed like any participant. The member grid still only ever renders real `Member`s as tappable tiles. See changelog.
- **AC-3 — Truck-check join model, then gate `/truckcheck`.** Owner's shape: a brigade device / signed-in user *starts* a check session (per vehicle); a QR/link then lets anyone pick an existing vehicle/session to check or join (like the AAR collab join). Build that start-and-share flow first, then apply the same `AccessRoute` discipline to `/truckcheck` so it can't be opened bare either.
- **AC-4 — Consistency sweep.** Reports and admin are already auth-gated (`ProtectedRoute` + `requireSession`); confirm nothing else exposes a walk-up surface without a credential once AC-1…AC-3 land.
- **AC-5 — Device accounts. ✅ Shipped 2026-07-04.** Formalised the anonymous `BrigadeAccessToken` UUID into a first-class `Device` (in-memory + Table Storage twins, `/api/devices` CRUD, org-scoped, owner/admin gated) per the archived design ([SAAS_COMMERCIALIZATION_DESIGN §4](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md)). `kioskAccessResolver.ts` wires Device tokens into every existing kiosk-gating call site (`kioskModeMiddleware`, `flexibleAuth`'s brigade-token path, `/api/brigade-access/validate`) alongside the legacy store, so a new Device-issued kiosk URL actually works end-to-end (sign in, check in members, run activities) — not just a parallel unused API. Admin UI: a "Devices" section per station (enroll/rename/revoke/reactivate/remove, copy/QR the kiosk URL) alongside the untouched legacy token UI. See changelog. `maxDevices` enforcement remains intentionally off per #574.

### Now

- **Q1 — AAR Studio: validate the insight-quality rework on a live debrief (owner, 2026-07-04; consolidation re-tuned 2026-07-06).** The structural rework shipped 2026-07-04 (see changelog): settle-based trigger (quiet-gap, not fixed timer), chunk range 450 → 1400 words, tap-to-edit finding cards, active-review chip. A live debrief since then showed the prompt had over-corrected the other way — distinct topics (comms, size-up, staging location) raised in one exchange were merged into a single finding. 2026-07-06 reworded the prompt to consolidate **by topic, not by segment** (same-topic restatements still merge; distinct topics stay separate) — see changelog. Also added while touching this area: a Present-mode live status strip (recording + transcript-processing indicators, since the projector view previously gave no sign the pipeline was still running) and density-scaled card typography so a growing findings board still fits one screen. **Remaining — needs another real debrief:** confirm the topic-vs-segment rebalance actually lands in the 3–8-findings sweet spot rather than over- or under-shooting again; tune further if not. Batch with the Q3 on-device session.
- **Q2 — D1 pricing decisions (owner).** Confirm: trial length (14 vs 30 days, AI included?), AI metering unit (session vs audio-minute; see AAR-11 for why per-vend is wrong), top-up pack size/price, per-org vs per-station billing for district orgs, grant/PO invoicing. *Blocks Q5. Decision, not code.*

### Next

- **Q3 — Voice agent: iPad on-device verification.** The F8 audio fixes were built against documented iOS Safari behaviour but have never run on a physical iPad. Run a full voice check on iPad (portrait + landscape), capture the screenshots the PR convention requires, log device-specific breakage. *Blocks Q4; batch with an on-device check of the AAR live-listen reconnect logic (AAR-6/8) and that the AAR-20 print path prints cleanly from its new print window on iPad.*
- **Q4 — Voice agent: pilot rollout.** After Q3, enable for 1–2 pilot AI-plan brigades and gather feedback (noise handling, phrasing, turn caps). Hardening (F1–F16) is done; this is product feedback, not engineering.
- **Q5 — Billing: metered AI overage end-to-end.** `meteredUsageReporter.ts` is a safe no-op until a Stripe meter is configured. After Q2: create the meter, map `UsageRecord` → meter events, verify an overage invoice in test mode. Include the AAR-11 session-vs-vend fix.
- **Q6 — Wiki content refresh.** Sweep migrated developer pages for staleness (known: deployment-optimization + ci-pipeline pre-Linux framing), and add screenshots to the user guide (combine with Q3's iPad session).
- **Q6a — Design system v2.0: finish the emoji → Lucide sweep (#618).** The design system v2.0 rollout (2026-07-10) replaced emoji with `lucide-react` icons on the landing page, sign-in header, vehicle-check flow, auth/marketing/reports pages, and the station/crew-access admin consoles. Still emoji: achievement badges (`AchievementBadge.css`, `AchievementCelebration.tsx`, `types/achievements.ts` — likely intentional, expressive reward icons), `ActivityTag.tsx`'s activity-type map, and several admin modals/pages (`UserManagement.tsx`, `BulkImportModal.tsx`, `StationTokenCard.tsx`, `VehicleManagement.tsx`, `EventCard.tsx`, `ActiveCheckIns.tsx`, `NewEventModal.tsx`, `ConfirmationDialog.tsx`, `OnboardingWizard.tsx`, `DemoModeWarning.tsx`, sibling-app icons in `config/suiteApps.ts` and the marketing page's "coming soon" cards). Decide per-spot whether to map to a Lucide icon or keep the emoji (achievements/sibling-app branding may be a deliberate exception).

### Later

- **Q7 — AAR Studio: shrink the `/aar` CSP.** Blocked: live transcription still uses the Azure Speech SDK browser-direct (`wss://*.stt.speech.microsoft.com`), so the CSP must keep provider hosts. Unblocks if AAR moves to a backend speech proxy like the voice agent's (`agentSpeech.ts` pattern) — the CSP hosts are unrelated to AAR-6's now-shipped token-refresh/reconnect fix, so this stays blocked on the proxy move itself.
- **Q8 — Truck check: surface vehicle management.** Vehicle CRUD is buried inside the admin dashboard (old TC-6). Small UX task. *Partially addressed 2026-07-10 (#617): the `/truckcheck` landing page is now a **vehicle roster** — per-vehicle identity, last-check result (`10/12 OK`), when/who, outstanding issues, and Resume/Finalise/**Cancel** for in-progress runs (backed by the new `DELETE /api/truck-checks/runs/:id`). Remaining: fold add/edit/delete vehicle CRUD into the roster so it isn't admin-only, and reduce duplication between the roster, VehicleManagement, and VehicleTypes/Template screens (single "Templates & Vehicle Types" entry).*
- **Q9 — Frontend polish batch.** Known minor UAT leftovers: double service-worker registration log; `/login` and `/profile/:memberId` settle in 3.5–5s vs near-instant elsewhere.
- **Q10 — Notifications (email/SMS) #120.** Event reminders and issue-assignment notifications. Design the provider choice (ACS vs SendGrid vs Twilio) first; the truck-check issue lifecycle (`assignedTo`) is the obvious first consumer.
- **Q11 — Advanced analytics dashboard #123.** Value unproven — validate demand with pilot brigades before building.
- **Q12 — Voice agent: continuous listening (VAD).** Swap push-to-talk for voice-activity detection behind the same WS frames. Gather pilot feedback first.
- **Q13 — A4: vision + offline agent phase.** Camera frames + visual diff against `referencePhotoUrl`; on-device speech for offline sheds. Do not start until the voice agent has pilot mileage.
- **Q14 — T6: suite shared packages.** npm/pnpm workspace, `@rfs/ui` / `@rfs/types` / `@rfs/auth-sdk`; sibling repos consume `/api/auth/entitlements`; SSO redirect for cross-origin apps. (#557)
- **Q15 — T7: suite monorepo consolidation.** Turborepo; Fire Break Calculator embedded; Fire Santa Run seasonal peer; converge backends onto Express; one pipeline. Depends on Q14 and a commercial reason. (#558)
- **Q16 — T1 remainder: shared truck-check types.** Fold `Appliance`/`VehicleType`/`ChecklistItem`/`CheckRun`/`CheckResult` into `shared/domain-types.d.ts` like the sign-in types.
- **Q17 — aar-studio: adopt a shared responsive-breakpoint convention.** Per [RESPONSIVE_UI_REVIEW_20260704](wiki/developer/history/reviews/RESPONSIVE_UI_REVIEW_20260704.md) (UI-3): aar-studio's stylesheet has only 3 `@media` rules total (vs. 65 responsive CSS files in `frontend/`) and currently passes an automated phone/tablet/desktop overflow + touch-target scan mostly by luck (auto-fit grids happening to degrade gracefully), not by design. Not urgent — nothing else is broken today — but the next time aar-studio gets sustained feature work, add shared breakpoint vars to `rfs-tokens.css` and check new screens against them explicitly rather than relying on incidental wrapping.

---

## Open decisions

| ID | Decision | State |
|---|---|---|
| **D1** | Pricing details: trial length, AI metering unit, top-up sizes, org- vs station-level billing, grant/PO invoicing, AAR-in-Basic?, Santa Run seasonal billing. *Fire Break tier placement provisionally settled 2026-07-12: included in Basic + AI Pro (`fireBreakEnabled`); revisit if a dedicated Bushie Suite tier lands (Q14/Q15)* | 🔵 **Open — owner.** Blocks Q5; see Q2 |
| **D2** | Suite auth standard: SM JWT vs Entra External ID | ✅ Resolved — keep SM JWT (kiosk brigade-token model needs it). Revisit only if cross-origin SSO becomes real (Q14) |
| **D3** | Streaming-voice architecture | ✅ Resolved 2026-06-29 — backend proxies audio; Azure OpenAI function calling; same App Service, 30-s WS pings |
| **D4** | Real-time transport at scale: Socket.io vs Azure Web PubSub | 🔵 Open, not urgent — current lean: adopt *Web PubSub for Socket.IO* (keeps code) when multi-brigade scale needs a backplane |
| **D5** | Deploy size/time | ✅ Resolved 2026-06-22 — run-from-package cut the deploy step from ~8 min to <1 min |

---

## Pricing & plans (reference)

The live catalog is code (`backend/src/constants/plans.ts`); this is the intended commercial shape. Full rationale: [SAAS_COMMERCIALIZATION_DESIGN](wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md) §7.

| Tier | Price (AUD) | Members | Vehicles | Includes |
|---|---|---|---|---|
| **Community** (free) | $0 | up to 10 | 1 | Manual sign-in + 1 vehicle check, single station |
| **Basic** | $10/mo · $100/yr | unlimited | unlimited | Full manual suite + reports & CSV export, multiple stations, Fire Break Calculator (cloud saved plans) |
| **AI Pro** | $19/mo · $190/yr | unlimited | unlimited | Basic + AAR Studio (~25 AI sessions/mo) + voice agent |
| **Bushie Suite** *(planned)* | $29/mo · $290/yr | unlimited | unlimited | AI Pro + all Bushie Tools apps (after Q14/Q15) |

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
| R7 | Low user adoption | Med | High | "Average bushie" ethos, pilot feedback loops (Q4), station champions |
| R8 | Regressions during refactors | Med | Med | CI gates (typecheck, tests, lint, coverage), post-deploy smoke tests |
| R9 | Dependency vulnerabilities | Med | Med | Dependabot grouped PRs, security scanning |
| R10 | Rural connectivity | High | Med | PWA offline queue; A4 offline agent phase (Q13) |

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
