# Design: Self-Service Sign-up, Multi-Tenant Billing & Commercialization

**Status:** Partially shipped — see Implementation status below. The full
self-service vision remains a mix of shipped and design-only pieces.
**Author:** Design spike, June 2026
**Related:** `docs/AI_MAINTENANCE_AGENT_DESIGN.md`, `docs/AS_BUILT.md` (Multi-Station,
Auth), `docs/MASTER_PLAN.md`

---

## Implementation status (as of 2026-06-20)

This section is the quick truth-check; the rest of the document is the original
design and may describe pieces not yet built. Verify against
`backend/src/routes/` and `backend/src/services/` if in doubt.

### ✅ Shipped

- **Organizations + plans + entitlements.** `Organization` is the billing tenant
  (`organizationDatabase` + Table Storage twin). `planCode`
  (`community|basic|ai`) maps to entitlements via `constants/plans.ts`, which
  clamps owner overrides to the plan ceiling.
- **Per-feature + per-app entitlement flags.** `signInEnabled`,
  `truckCheckEnabled`, `reportsEnabled`, `aiEnabled`, plus the suite/app flags
  `aarStudioEnabled`, `santaRunEnabled`, `fireBreakEnabled`, and limits
  (`maxStations`, `maxDevices`, `aiIncludedSessions`). Gated on both sides
  (`requireFeature` backend, `FeatureRoute` frontend).
- **Stripe billing.** Checkout, Customer Portal, and webhook are live
  (`routes/billing.ts`, `services/stripeClient.ts`): `POST /api/billing/checkout`
  and `/portal` (owner-only), `POST /api/billing/webhook` (signature-verified,
  raw body), `GET /api/billing/status`.
- **Server-side AI gateway with session-based usage metering.** `routes/ai.ts` +
  `services/aiGateway.ts` proxy Azure OpenAI/Speech; one Speech-token vend == one
  AAR session. Usage is recorded (`usageDatabase` + Table Storage twin via
  `usageDbFactory`) and the monthly `aiIncludedSessions` allowance is enforced at
  the speech-token gate. Metered usage can be reported to Stripe
  (`services/meteredUsageReporter.ts`, gated by `STRIPE_METERED_USAGE_ENABLED`).
- **Entitlements probe.** `GET /api/auth/entitlements` returns the org's
  entitlements + plan code for sibling apps (see `SUITE_TOKEN_VALIDATION.md`);
  `GET /api/auth/me` returns the full identity + org payload.
- **Owner role.** First org user is an `owner`; billing routes are `requireOwner`.

### 🚧 Design-only / future

- **First-class `Device` accounts** (§4). Today this is still the existing
  `BrigadeAccessToken` / kiosk-token model; there is no `Device` entity, no
  per-type device caps enforced, and `maxDevices` is not yet enforced on
  enrolment.
- **Member account activation / personal logins** (§5). `Member` records have no
  login; the email/SMS claim-link invite flow is not built.
- **Full self-service onboarding wizard** (§3) — Stripe Checkout exists, but the
  guided sign-up → station → plan → device-enrol → member-invite flow is not the
  shipped UX end-to-end.
- **Usage-overage billing** beyond the monthly session allowance — overage
  charging is designed but not fully wired; the current behaviour hard-gates new
  sessions at the allowance rather than billing overage.
- **`UsageRecord`-driven overage caps / station & device limit enforcement** on
  every route — partially present (`maxStations` is enforced on station
  creation); other limits remain to be enforced.

---

## 1. Goal

Turn Station Manager from a single hand-provisioned deployment into a **self-service
SaaS**: a brigade signs up online, picks a plan, pays (Stripe), enrols their devices,
and activates their members — with the **AI maintenance agent** sold as a paid add-on.
Pricing must be **reasonable for volunteer brigades** while safely covering costs
(especially AI).

## 2. How this maps onto what already exists

| SaaS concept | Today | Change needed |
|---|---|---|
| Billing tenant | — (none) | **New `Organization`** entity (owns the Stripe relationship) |
| Brigade / Station | `Station` with `brigadeId`, `brigadeName`, `hierarchy` | add `organizationId` link |
| Device / kiosk | `BrigadeAccessToken` (UUID, → brigade+station) | **formalise into `Device` accounts** with a type |
| Admin login | `AdminUser` (JWT, global) | scope to an `Organization`; add an **owner** role |
| Member | `Member` (record, no login) | optional **member activation** (email invite → login) |
| Data isolation | by `stationId` | add `organizationId` as the outer tenant boundary |

The tenancy hierarchy becomes:

```
Organization (billing tenant, Stripe customer)
 └─ Brigade(s) / Station(s)        (existing brigadeId/stationId)
     ├─ Device accounts            (kiosk / tablet / phone / wearable)
     └─ Members                    (optionally activated to a login)
```

A single-station brigade is just an Organization with one Station — the common case.

## 3. Self-service onboarding flow

1. **Sign up** (email + org name) → create `Organization` in `trialing`, plus the first
   `AdminUser` as **owner**. Email verification.
2. **Create the brigade/station** — reuse existing station creation + the RFS facilities
   lookup (`rfsFacilitiesParser`) so they find their real brigade.
3. **Choose a plan** → **Stripe Checkout** (hosted) → on success, a webhook flips the
   org to `active` and writes entitlements.
4. **Enrol devices** — generate `Device` accounts (extends today's brigade tokens); show
   a QR to enrol each kiosk/tablet/phone.
5. **Add members** — bulk import already exists; optionally **invite** members to activate
   a personal login (email/SMS claim link).
6. **Go live.** Trial → paid handled by Stripe; entitlements gate features.

## 4. Device-type accounts

Formalise `BrigadeAccessToken` into a first-class **`Device`**:

```typescript
export interface Device {
  id: string;
  organizationId: string;
  stationId: string;
  type: 'kiosk' | 'tablet' | 'phone' | 'wearable';  // wearable = headset for the AI agent
  name: string;                 // "Main shed kiosk", "Captain's phone"
  token: string;                // unguessable credential (UUID; same model as today)
  status: 'active' | 'revoked';
  lastSeenAt?: string;
  createdAt: string;
  expiresAt?: string;
}
```

- Backward compatible: existing `kioskToken`/`BrigadeAccessToken` map onto `Device` rows
  of type `kiosk`.
- Plans cap device **count by type** (see pricing). The AI voice agent runs on a
  `phone`/`wearable` device account.
- Reuses the existing kiosk-mode middleware and token validation.

## 5. Member account activation

Members stay free and unlimited; "activation" gives a member their own login (for
profile, self sign-in, and — later — to be the speaker identity on an AI session):

```typescript
export interface Member {            // additive fields
  // ...existing
  email?: string;
  authStatus?: 'none' | 'invited' | 'active';
  userId?: string;                   // → a credential record once activated
  invitedAt?: string;
}
```

Activation = send a claim link → member sets a password / passwordless → `authStatus`
becomes `active`. No plan seat cost (keeps brigades' volunteer rosters frictionless);
member **logins** can be a Basic+ feature if we ever need to gate it.

## 6. Billing & e-commerce (Stripe)

**Stripe is the right choice.** Recommended surface:

| Need | Stripe product |
|---|---|
| Take payment at signup | **Checkout** (hosted; PCI scope = SAQ-A, no card data on our servers) |
| Subscriptions, plans, proration, trials | **Billing** |
| Let brigades manage/cancel/upgrade + see invoices | **Customer Portal** |
| Entitlement sync | **Webhooks** (`checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.paid`, `invoice.payment_failed`) |
| GST | **Stripe Tax** (AU GST handled automatically) |
| AI overage / packs | **Metered billing** (usage records) + one-off **Payment Links** |
| Grant-funded brigades who can't use cards | **Invoicing** (annual invoice, pay by transfer) |

**We store only** `stripeCustomerId` / `stripeSubscriptionId` / status on the
`Organization`; Stripe is the source of truth. Webhooks are **signature-verified**; a
`BillingEvent` audit row is written for each.

**E-commerce beyond subscriptions** (later): a small storefront for one-off purchases —
**AI session top-up packs** and optional **hardware bundles** (tablet + stand + headset).
Stripe Checkout/Payment Links cover this without a separate cart.

## 7. Pricing — assessment, recommendation & open questions

### Cost model (per brigade / month)

- **Infra (Basic):** shared scale-to-zero Container Apps + Table/Blob + capped App
  Insights → **well under A$1/brigade**. Storage and compute are effectively free per
  tenant at this scale.
- **Stripe fee:** AU domestic card ≈ 1.75% + A$0.30; on A$10 that's ≈ **A$0.48 (≈5%)**.
  Annual billing amortises the fixed A$0.30 (one charge vs twelve).
- **Email/SMS** (verification, invites): cents.
- **AI per AAR session (~12 min):** STT ≈ A$0.20 + TTS ≈ A$0.08 + LLM (with prompt
  caching) ≈ A$0.15–0.60 → **≈ A$0.40–0.90, call it ~A$0.60/session**.
- **AI per brigade/month:** light use (weekly, 2–3 trucks ≈ 8–12 sessions) ≈ **A$5–7**;
  heavy use (30–60 sessions) ≈ **A$18–36**.

### What this means

- **Basic at A$10/mo is very healthy** (≈90%+ margin) — infra is near-zero, only Stripe
  fees matter.
- **Flat AI pricing does _not_ safely cover AI** — a heavy brigade at 30–60 sessions/mo
  costs us A$18–36 vs whatever flat fee we charge. AI cost is **usage-driven**, so flat
  pricing transfers all the risk to us.

### Recommended tiers

Keep the headline low to drive adoption, but make AI **fair-use metered** so price tracks
cost:

| Tier | Price (rec.) | Includes |
|---|---|---|
| **Community (Free)** | A$0 | 1 station, manual sign-in + truck check, capped members/devices. Adoption funnel + goodwill for volunteer brigades. |
| **Basic** | **A$10/mo** or **A$100/yr** (2 months free) | Full Station Manager suite: unlimited members, multiple devices, reports + CSV export, real-time sync. AAR Studio (no AI — export only). |
| **AI Pro** | **A$19/mo** or **A$190/yr**, *including* ~25 AAR sessions/mo, then **~A$0.60/session** overage or top-up packs | Everything in Basic + AI-powered AAR Studio (live transcription, auto-findings, AI report), voice maintenance agent, transcripts. |
| **Bushie Suite** | **A$29/mo** or **A$290/yr** | Everything in AI Pro + all Bushie Tools apps (Fire Break Calculator + Fire Santa Run) once the suite integration (issues #556–558) ships. |

> Net: **Community → Basic A$10 → AI Pro A$19 → Bushie Suite A$29**. Each step adds
> clear value. Annual billing (2 months free) is the biggest adoption lever.

### 7a. Pricing model options — discussion

These are the main structural choices we need to make before locking Stripe products.

---

#### Option 1 (recommended): Flat per-station, tiered by capability

**How it works:** one price per station per month, regardless of roster size. Members
are unlimited (they're records, not logins). Price gates *what you can do*, not *how
many people* you have.

**Why:** Volunteer brigades can have 100+ members on the roster but only 5–10 active
at any time. Charging per member penalises large rural brigades and creates "is adding
a new member going to cost us money?" friction — the last thing a bushie should have to
think about. A flat per-station fee is predictable (they can budget it), aligns with
how brigades think of themselves ("we're Wamboin station"), and is dead simple to explain.

**Station caps by tier:**
- Community: 1 station
- Basic: up to 3 stations (covers a small group/district)
- AI Pro: up to 5 stations + unlimited AAR sessions within allowance
- Bushie Suite: unlimited stations

---

#### Option 2: Per-user (active member logins)

**How it works:** charge per activated member login per month (e.g. A$2/user/mo on
Basic, A$4/user/mo on AI Pro).

**Why not (for now):** Today members don't have logins — they're just records. Member
activation (email invite → personal login) is a Phase C feature. Introducing per-user
pricing before that exists creates complexity with no product backing it. Revisit when
member logins ship. If adopted, it would work as a *per-seat* add-on on top of a base
station fee (like the "seat + base" model common in ops tools).

---

#### Option 3: Per-brigade-size bands

**How it works:** tiered bands — "under 25 members," "25–75," "75+" — with a higher
flat rate per band.

**Why not:** brigade size is noisy data (honorary/inactive members inflate rosters),
hard to audit, and creates an incentive to not enter members. Flat per-station is
cleaner and equally monetisable once multi-station orgs are common.

---

#### Option 4: Per-app pricing (à la carte)

**How it works:** Station Manager as the base (A$10/mo), AAR Studio as an add-on
(+A$5/mo), Fire Break Calculator and Fire Santa Run as further add-ons.

**Trade-off:** gives flexibility but fragments the selling story. The "Bushie Suite"
bundle at a slight discount to à la carte achieves the same flexibility with a stronger
value perception. Recommended approach: publish the Bundle tier prominently; à la carte
is the fallback for brigades who only want one app.

---

### 7b. AI usage, metering, and cost protection

This is the most important pricing decision because AI is the only cost that scales
with usage.

**The problem:** a brigade running 30 post-incident AARs/month with 4 trucks each
could generate 120 AI sessions. At A$0.60/session that's A$72 of cost to us — nearly 4×
the AI Pro subscription revenue. Flat unlimited AI is not viable.

**The solution: fair-use allowance + metered overage**

- AI Pro includes **~25 AAR sessions/month** (covers light-to-moderate use: weekly
  reviews, 2–3 trucks per incident).
- Above the allowance: **~A$0.60/session** overage, billed via Stripe metered billing
  at month end, OR pre-purchased **top-up packs** (e.g. 20 sessions for A$10).
- Overage is shown clearly in the app ("12 sessions remaining this month").
- `UsageRecord` table tracks consumption; the AI gateway (issue #555) checks before
  each call.

**Why top-up packs are better than pure overage for volunteer orgs:**
- Brigades on grant funding can't absorb an unexpected bill
- A pre-paid pack ("buy 20 more sessions") is a single predictable charge they can
  seek approval for
- Stripe Checkout / Payment Links support one-off purchases without a separate cart

**Metering unit: session vs audio-minute**
- **Session (recommended):** one "session" = one AAR from start to stop. Simple to
  explain, easy to predict. A 12-minute session and a 90-minute session both count as
  one. This is the right abstraction for brigades who think "we ran an AAR today."
- **Audio-minute:** fine-grained but confusing ("wait, does it count if I paused?").
  Possible for future voice-maintenance-agent use where session length varies wildly.

**Recommendation:** meter by session for AAR Studio; meter by minute for the voice
maintenance agent (AI_MAINTENANCE_AGENT_DESIGN.md).

---

### 7c. GST & grant-funded brigades

- Enable **Stripe Tax** from day one; show prices inc. GST to AU customers.
- Many brigades are grant or council funded and need **invoicing** (annual invoice,
  pay by bank transfer). Stripe Invoicing covers this — flag it on the sign-up form
  ("Need to pay by invoice? Contact us").
- **Annual billing** (2 months free) is the biggest tool for grant-funded brigades who
  budget yearly: one invoice, no monthly card charge, no churn risk mid-grant.

---

> **Summary of decisions needed** (also captured in §12):
> 1. Confirm tier names and prices before Stripe products are created.
> 2. Confirm per-station (recommended) vs per-user pricing.
> 3. Confirm AI metering unit: session (recommended) vs audio-minute.
> 4. Confirm top-up pack sizes and prices.
> 5. Bushie Suite pricing: A$29/mo confirmed, or adjusted once suite integration scope is clearer.
> 6. Free trial: 14 days (recommended) vs 30 days; AI included in trial or gated?

## 8. Entitlements & feature gating

- `Organization.entitlements` is a derived snapshot (from plan + subscription status),
  refreshed by Stripe webhooks: `{ aiEnabled, maxStations, maxDevices, aiIncludedSessions }`.
- A gate (extends the existing `flexibleAuth`/middleware) blocks AI endpoints when
  `aiEnabled` is false or the monthly allowance is exhausted (→ prompt to top up).
- Degrades gracefully: `past_due` keeps read access but suspends AI; `canceled` reverts to
  the Community feature set rather than locking data out.

## 9. Schema deltas (additive, both DB twins)

**New entities**
```typescript
interface Organization {
  id: string; name: string; billingEmail: string;
  stripeCustomerId?: string; stripeSubscriptionId?: string;
  planCode: 'community' | 'basic' | 'ai' | 'suite';  // 'suite' = Bushie Suite (all apps)
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  entitlements: {
    aiEnabled: boolean; maxStations: number; maxDevices: number;
    aiIncludedSessions: number;
    aarStudioEnabled: boolean;       // true on ai + suite
    santaRunEnabled: boolean;        // true on suite
    fireBreakEnabled: boolean;       // true on suite
  };
  createdAt: string; updatedAt?: string;
}
interface Device { /* §4 */ }
interface UsageRecord {            // AI metering / fair-use accounting
  id: string; organizationId: string; type: 'ai-voice-session';
  quantity: number; sessionId?: string; occurredAt: string;
}
interface BillingEvent {           // webhook audit trail
  id: string; organizationId: string; stripeEventId: string;
  type: string; payloadSummary: string; receivedAt: string;
}
```

**Extensions (all optional / backward-compatible)**
- `Station` += `organizationId`
- `AdminUser` += `organizationId`, role `'owner'`
- `Member` += `email`, `authStatus`, `userId`, `invitedAt` (§5)

**Plans** are a small code-level catalog (like `checklistVocabulary.ts`) mapped to Stripe
Price IDs via config — not a DB table.

**Isolation:** `organizationId` becomes the outer tenant boundary; all queries already
scoped by `stationId` gain an org check at the station→org link. Existing single-tenant
data migrates under one default Organization (mirrors the `default-station` pattern).

## 10. Security & compliance

- **PCI:** card data never touches our servers (Checkout/Portal) → SAQ-A.
- **Webhooks:** verify Stripe signatures; idempotent by `stripeEventId`.
- **Tenant isolation:** enforce `organizationId` on every cross-station/admin query;
  add tests mirroring the existing multi-station isolation suite.
- **Data on cancel:** retain (don't delete) per a documented retention policy; downgrade
  features, keep the brigade's records exportable.

## 11. Phased delivery

| Phase | Scope | Notes |
|---|---|---|
| **A — Tenant model** | `Organization`, link Stations, scope AdminUsers, default-org migration | foundation; no billing yet |
| **B — Billing + signup** | Stripe Checkout/Billing/Portal, webhooks, entitlements, feature gating, self-service signup + email verify | the commercial core |
| **C — Devices + members** | `Device` accounts (formalise tokens) + member activation/invites | |
| **D — AI metering + storefront** | `UsageRecord` metering, fair-use/overage, top-up packs, optional hardware store | depends on the AI agent (Phase 2 of that design) |

## 12. Open questions (decisions needed before Stripe products are created)

**Pricing model** (see §7a–7c for full discussion):
- [ ] **Pricing unit:** confirm flat per-station (recommended) vs per-user vs brigade-size bands.
- [ ] **Tier names & prices:** Community/Basic (A$10)/AI Pro (A$19)/Bushie Suite (A$29) — or adjust.
- [ ] **AI metering unit:** session (recommended) vs audio-minute. Apply to AAR Studio only first.
- [ ] **Top-up pack sizes:** e.g. 20 sessions / A$10 — confirm before Stripe products created.
- [ ] **Free tier limits:** member/device caps that drive upgrade without alienating volunteers.
- [ ] **Trial:** 14 days (recommended) vs 30 days; AI included in trial, or gated?
- [ ] **Annual discount:** 2 months free (≈17% — standard SaaS) confirmed?

**Billing mechanics:**
- [ ] **Grant/PO workflow:** proportion of brigades needing Stripe Invoicing vs card? (Affects onboarding UX.)
- [ ] **Per-org vs per-station billing:** a district org with 5 stations — one subscription or five?
- [ ] **Bushie Suite pricing:** A$29/mo locked in, or wait until suite integration scope is clearer?

**Product scope:**
- [ ] **Member-login rollout:** needed for AI speaker identity — is this Phase C, or post-suite?
- [ ] **AAR Studio in Basic tier:** include AAR Studio (no AI) in Basic, or keep it AI-only?
- [ ] **Fire Break Calculator:** free standalone (public calculator) even on Community? Or suite-only?
- [ ] **Fire Santa Run seasonality:** entitlement flag shows/hides it; confirm seasonal billing (pause/resume) is handled.

**Suite integration decisions** (see also `docs/SUITE_INTEGRATION_PLAN.md §8`):
- [ ] **Auth:** Entra External ID for authN + SM entitlements for authZ, OR keep SM JWT as IdP?
- [ ] **Real-time transport:** Socket.io (SM) vs Azure Web PubSub (Santa Run) for unified backend?
- [ ] **Backend runtime:** port Hono/Functions → Express (Phase 3 bulk effort — budget explicitly).
