# Design: Self-Service Sign-up, Multi-Tenant Billing & Commercialization

**Status:** Draft / future release (design only — not implemented)
**Author:** Design spike, June 2026
**Related:** `docs/AI_MAINTENANCE_AGENT_DESIGN.md`, `docs/AS_BUILT.md` (Multi-Station,
Auth), `docs/MASTER_PLAN.md`

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

## 7. Pricing — assessment & recommendation

### Cost model (per brigade / month)

- **Infra (Basic):** shared scale-to-zero Container Apps + Table/Blob + capped App
  Insights → **well under A$1/brigade**. Storage and compute are effectively free per
  tenant at this scale.
- **Stripe fee:** AU domestic card ≈ 1.75% + A$0.30; on A$10 that's ≈ **A$0.48 (≈5%)**.
  Annual billing amortises the fixed A$0.30 (one charge vs twelve).
- **Email/SMS** (verification, invites): cents.
- **AI per voice session (~12 min):** STT ≈ A$0.20 + TTS ≈ A$0.08 + LLM (with prompt
  caching) ≈ A$0.15–0.60 → **≈ A$0.40–0.90, call it ~A$0.60/session**.
- **AI per brigade/month:** light use (weekly, 2–3 trucks ≈ 8–12 sessions) ≈ **A$5–7**;
  heavy use (30–60 sessions) ≈ **A$18–36**.

### What this means

- **Basic at A$10/mo is very healthy** (≈90%+ margin) — infra is near-zero, only Stripe
  fees matter. Your A$10 instinct is right.
- **A flat A$15 AI tier does _not_ safely cover AI** — a light brigade is roughly
  break-even and a heavy brigade is a clear loss. AI cost is **usage-driven**, so flat
  pricing transfers all the risk to us.

### Recommendation

Keep the headline low to drive adoption, but make AI **fair-use metered** so price tracks
cost:

| Tier | Price (rec.) | Includes |
|---|---|---|
| **Community (Free)** | A$0 | 1 station, manual sign-in + truck check, capped members/devices. Adoption funnel + goodwill for volunteer brigades. |
| **Basic** | **A$10/mo** or **A$100/yr** (2 months free) | Full manual suite, unlimited members, multiple devices, reports + CSV export, real-time sync. |
| **AI (Pro)** | **A$19/mo** or **A$190/yr**, *including* a fair-use allowance (~25 voice sessions/mo), then **~A$0.60/session** overage or top-up packs | Everything in Basic + the voice maintenance agent, zone-aware prompting, transcripts. |

- If you want to **honour the A$15 number**, it's viable as the AI tier **with a tighter
  allowance** (~15 sessions/mo) and the same overage — I'd just recommend A$19 with a
  more generous cap as the safer default. Avoid **flat unlimited** AI unless priced ~A$25–29.
- **Annual billing** (2 months free) is the single biggest lever: it cuts Stripe fee drag,
  reduces churn, and suits grant/council-funded brigades who budget yearly.
- Add **Stripe Tax** for GST from day one; show prices inc. GST to brigades.

> Net: **Basic A$10**, **AI A$19 with fair-use metering** (or A$15 with a smaller included
> allowance). Both protect margin while staying very reasonable for volunteer orgs.

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
  planCode: 'community' | 'basic' | 'ai';
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  entitlements: { aiEnabled: boolean; maxStations: number; maxDevices: number; aiIncludedSessions: number };
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

## 12. Open questions

- Free tier limits (members/devices) that drive upgrades without alienating volunteers.
- Trial length (14 vs 30 days) and whether AI is trialable.
- Per-org vs per-brigade billing for multi-brigade groups (e.g., a district running several).
- Do we meter AI by **session** or by **audio-minute**? (Session is simpler to explain.)
- Grant/PO workflow: how many brigades will need Stripe **Invoicing** vs cards.
- Member-login rollout: needed for the AI speaker identity, or keep device-level for now?
