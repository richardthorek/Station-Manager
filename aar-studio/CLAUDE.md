# aar-studio/ — no-build vanilla ES modules, served at `/aar`

AI-facilitated After Action Reviews. **Shares no code with the SPA** — its own
stack, tests, and docs. See root `CLAUDE.md` for the cross-app seams (they bite
here most). This file loads when you work in `aar-studio/`.

## Commands (from `aar-studio/`)

```bash
npm test               # node --test (the CI gate for this app)
npm run dev            # python3 -m http.server 8080
```

No build step, no bundler, no npm dependencies — plain HTML/CSS/ES modules the
backend mounts statically at `/aar`. Ships as-is in the deploy zip.

## Layout

- `index.html`, `css/app.css`, `css/rfs-tokens.css` (**canonical brand tokens** —
  the SPA's `index.css` mirrors these).
- `js/` — `main.js`, `analyse.js`, `store.js`, `ui.js`, `settings.js`,
  `views/`, `audio/`, `lib/`.
- `test/` — `node --test` suites (one per concern). `data/sample-session.json`.
- `docs/ARCHITECTURE.md` — this app's architecture of record.

## Gotchas

- **The `/aar` seams** (root `CLAUDE.md`): a blank `/aar` = the service worker
  served the React shell (`navigateFallbackDenylist` regression); AAR-only hosts
  (jsDelivr, Azure OpenAI/Speech, mic/display-capture) belong in the **scoped
  `/aar` CSP override** in `backend/src/index.ts`, not the global policy — and
  `connect-src` there also governs SW `fetch()`.
- Adding a new external resource here means updating that scoped CSP override,
  never the global one.
- No `any`/TS here — it's plain JS with `node --test`. Keep it dependency-free.
