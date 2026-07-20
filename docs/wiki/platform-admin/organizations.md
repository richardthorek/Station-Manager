# Organizations

The **Organizations** tab lists every organisation on the platform — name,
plan, status, and rollup counts (members, stations, vehicles, AI sessions used
this month). Click one to open its detail view.

## What you can do from the detail view

- **Change plan** — move an organisation between Community, Basic, and AI Pro.
  Changing plan resets entitlements to that plan's defaults (module toggles
  you'd set can be re-applied via `moduleToggles`).
- **Toggle modules** — turn `signInEnabled`, `truckCheckEnabled`,
  `reportsEnabled`, or `aiEnabled` on or off independently, clamped to what
  the current plan allows.
- **Change status** — `trialing`, `active`, `past_due`, `canceled`. Unlike the
  org owner's own billing page, the platform console can set status directly
  (e.g. reinstating an organisation that was wrongly canceled).
- **Clear a facility claim** — unlinks the organisation from the national
  facilities dataset (it becomes a "custom" org, keeps its name). Use this
  before reassigning a facility to a different organisation via
  [claim conflicts](claim-conflicts.md).
- **Members** — add a new account directly into the org (username + password
  + role), change a member's role, or remove a member. An organisation always
  keeps at least one owner — the API rejects a change that would leave it
  without one.
- **Deactivate** (default delete) — sets status to `canceled`. Reversible by
  changing status back to `active`.
- **Hard delete** — permanently removes the organisation record. Requires
  passing the organisation's slug as an explicit confirmation. This does
  **not** cascade to the org's stations, members, or events — those records
  are simply orphaned from the deleted org, not deleted themselves. Use with
  real care; this is the one action here that isn't easily undone.

## Accounts vs memberships

Deleting or deactivating an **account** (`DELETE /api/platform/accounts/:userId`)
is a different action from removing a **membership** — an account can belong
to more than one organisation. Deactivating an account locks that person out
of every organisation they belong to; removing a membership only removes them
from one.

Every change made here is written to the [audit log](audit-log.md).
