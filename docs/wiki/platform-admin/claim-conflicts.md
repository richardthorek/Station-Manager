# Claim conflicts

When a new organisation tries to sign up and claim a facility from the
national RFS/SES/emergency-services dataset that another organisation has
already claimed, a **claim conflict** is recorded instead of silently
failing. This tab is where those get reviewed.

## What you see

Each open conflict shows:

- The facility name and key.
- Who currently holds it (existing organisation + billing email).
- Who attempted the new claim (organisation name, username, email).
- When it was reported.

## Resolving a conflict

Pick one of three resolutions:

- **Dismiss** — no action; the existing holder keeps the facility. Use this
  when the attempted claim was a mistake or a duplicate signup.
- **Mark as contacted** — records that you've reached out to sort it out
  manually (e.g. by phone/email) without changing anything in the system yet.
- **Reassign** — moves the facility link from the current holder to a
  different organisation (you supply the target organisation's ID). The
  previous holder keeps its name and account but becomes a "custom" (unlinked)
  organisation — it isn't deleted.

Resolved conflicts move to the **Resolved** tab with their resolution and any
notes you added, so there's a record of how each one was settled. Every
resolution is also written to the [audit log](audit-log.md).

## Where conflicts come from

A conflict is created automatically during signup when someone tries to claim
a `facilityKey` another organisation already holds — see the facility search
in the signup flow (documented for brigade admins in the
[getting-started guide](../user-guide/getting-started.md)). This tab is purely
reactive: you don't create conflicts, you resolve the ones the system flags.
