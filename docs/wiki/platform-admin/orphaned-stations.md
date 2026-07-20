# Orphaned stations

Stations created before organisation-level tenancy existed (or created
through a path that didn't set it) have no `organizationId`. That's a
fail-**open** state — the station keeps working normally, but its members and
vehicles don't count toward any organisation's plan limits, which
under-enforces those limits rather than breaking anything. This tool is the
manual fix.

## What you see

A list of active stations with no `organizationId`, each showing its name,
brigade name/ID, member count, and vehicle count — enough context to tell
which organisation it should belong to.

## Assigning a station

Pick the correct organisation and assign it. From that point on, the
station's members and vehicles count toward that organisation's plan ceiling
(e.g. Community plan's 10-member limit). This is a one-way tool: it patches
`organizationId` on the station record. There's no automatic matching —
there's no reliable signal to infer the right organisation, so every
assignment here is a manual, operator-reviewed decision, not a bulk
operation.

Assignments are written to the [audit log](audit-log.md).
