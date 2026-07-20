# Audit log

An append-only record of every mutation made from the platform admin console:
plan changes, entitlement toggles, status changes, facility-claim clears,
claim-conflict resolutions, station reassignments, membership adds/role
changes/removals, and account/organisation deactivation or deletion.

Each entry records the action type, the affected organisation and/or user,
the acting platform admin's username, a timestamp, and a short human-readable
detail string (e.g. `planCode: community -> basic`).

## Why it exists

The [privacy wall](README.md#the-privacy-wall) means the platform console
never shows row-level tenant content — no member names, check-ins, or
truck-check results. That's a deliberate trade-off: it protects brigade data,
but it also means there's no "browse the data and see what happened" fallback
if something looks wrong. The audit log is the only accountability trail for
this level of access — every action taken through the console, by whom, and
when.

Use it to answer "who changed this organisation's plan" or "when was this
account deactivated," not as a general activity feed — it only covers actions
taken *through the platform console*, not ordinary tenant activity (sign-ins,
truck checks, etc.), which brigades can see in their own
[reports](../user-guide/reports.md).
