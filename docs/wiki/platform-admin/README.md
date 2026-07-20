# Platform Administration Guide

For the **operator of the whole StationKit deployment** — not a brigade's
organisation owner. This is the console at **`/admin/platform`**, visible only
to usernames listed in the `PLATFORM_ADMIN_USERNAMES` environment variable.
There is normally one or two of these accounts, held by the people who run the
service itself.

This guide is intentionally not part of the regular user guide: it documents
operator-only tools with real blast radius (deactivating an organisation,
deleting an account). It's only ever surfaced inside the Platform console
itself — never linked from anywhere a brigade member or brigade admin would
see it.

## The privacy wall

The platform console can see **every organisation**, but only aggregate
counts and account/billing metadata — member counts, vehicle counts, AI
sessions used, plan and status. It **never** returns row-level tenant content:
no member names, no check-in history, no truck-check results, no event
detail. Every mutation from this console writes a row to the
[audit log](audit-log.md) — the only accountability trail for this level of
access, since the privacy wall means even the platform admin can't casually
browse tenant data instead.

### Console sections

| Page | What it covers |
|---|---|
| [Organizations](organizations.md) | Every organisation on the platform: plan, status, entitlements, members, and the management actions available on each |
| [Claim conflicts](claim-conflicts.md) | Reviewing and resolving disputed facility claims (two organisations trying to claim the same brigade) |
| [Orphaned stations](orphaned-stations.md) | Backfilling `organizationId` on stations created before that link existed, so their members/vehicles count toward the right plan |
| [Audit log](audit-log.md) | The append-only record of every platform-admin mutation |

## Getting access

Access is granted by adding a username to the `PLATFORM_ADMIN_USERNAMES`
environment variable (comma-separated, case-insensitive) on the backend
deployment — see `backend/src/middleware/platformAdmin.ts`. There's no in-app
way to grant it; it's infrastructure configuration, not a role you can assign
from the UI. The `/admin/platform` link only appears in the admin nav for
accounts already on that list — everyone else who visits the URL directly
sees "Not authorised."
