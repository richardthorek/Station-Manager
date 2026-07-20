# RFS Station Manager Wiki

Wiki-style documentation for the RFS Station Manager (StationKit suite).

## Sections

- **[User Guide](user-guide/README.md)** — how to use the app, written for
  brigade members, kiosk operators, and administrators. Start here if you run a
  station. Served live inside the app itself (the (?) help button and
  `/wiki`) by `GET /api/wiki/user-guide/*` — see `backend/src/routes/wiki.ts`.
  Edit these files directly; there's no separate CMS or build step.
- **[Platform Admin Guide](platform-admin/README.md)** — operator-only
  documentation for the `/admin/platform` console (organizations,
  claim conflicts, orphaned stations, audit log). Served live only inside that
  console, gated the same way the console itself is
  (`PLATFORM_ADMIN_USERNAMES`) — never linked from the regular user-guide help
  button. Not for brigade members or brigade admins.
- **[Developer Documentation](developer/README.md)** — architecture, setup,
  development guides, deployment, CI, security, the shipped-work changelog, and
  historical reference material. Start here if you work on the code. Internal
  only — never served through the in-app wiki.

## Related documents (outside the wiki)

- [`docs/MASTER_PLAN.md`](../MASTER_PLAN.md) — the single forward-looking plan:
  status board, prioritised next steps, open decisions.
- [`docs/registers/`](../registers/) — machine-readable registers describing
  the backend: `api_register.json` (REST + WebSocket surface),
  `function_register.json` (services and functions), `openapi.yaml`.
