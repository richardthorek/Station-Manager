---
description: Run the full local CI gate (typecheck → test → lint, CI order, fail-fast) before pushing.
allowed-tools: Bash(npm run check), Bash(bash scripts/check.sh)
---

Run `npm run check` — the local mirror of the CI quality gate
(`.github/workflows/ci-cd.yml`), in the same order, fail-fast: backend typecheck →
backend tests → frontend lint → frontend typecheck → frontend tests → AAR Studio
tests. It installs dependencies first if missing.

If it fails, fix the first failing gate and re-run before doing anything else —
green here means green in CI. Never push with this red.
