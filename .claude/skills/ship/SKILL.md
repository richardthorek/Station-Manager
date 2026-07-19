---
name: ship
description: End-of-session progress-tracking checklist for Station Manager. Records what shipped (changelog + MASTER_PLAN), updates the right registers/docs, runs the local CI gate, then commits, pushes, and opens a draft PR. Invoke before the final commit of any session that changed code or docs.
---

# /ship — record progress, then commit/push/PR

Run this before the **final commit of every session**. Recording progress is part
of "done," not optional. Work top-down; skip a step only if it genuinely doesn't
apply.

## 1. Verify green before shipping code

- Run **`npm run check`** (local mirror of the CI gate). Do not push red.
- For a behaviour change, also drive the real flow (the `/verify` skill) — tests
  passing isn't proof the feature works.

## 2. Changelog entry (mandatory for any shipped change)

Add a dated entry at the **top of the matching month section** of
`docs/wiki/developer/changelog.md`:

```
- 2026-MM-DD: **Short title (#PR).** One-sentence summary of the problem solved.
  **What shipped:** concrete changes. *N tests; suites green.*
```

Say what broke/what problem was solved, the concrete changes, the PR number, and
any caveats. This file is the *shipped-work* record — dated narratives go here,
**not** in `MASTER_PLAN.md`.

## 3. Sync the plan

Update `docs/MASTER_PLAN.md` to match reality: flip statuses on the feature board,
remove finished queue items, insert newly discovered work in priority order,
record/resolve open decisions, and bump "Last updated." **No dated narrative
here** — that's the changelog's job. Never create a separate plan/design doc; all
forward intent lives in this one file.

## 4. Update the "how it works now" sources — only if the change touched them

- **API endpoint added/changed** → `docs/registers/api_register.json` +
  `docs/registers/openapi.yaml` + `docs/wiki/developer/api-reference.md`. Validate
  with `bash scripts/validate-registries.sh`.
- **Backend function/service signature changed** → `docs/registers/function_register.json`.
- **Architecture changed** → `docs/wiki/developer/architecture.md`.
- **CI pipeline changed** → `docs/wiki/developer/ci-pipeline.md`.
- **User-visible behaviour changed** → the matching `docs/wiki/user-guide/` page.
- **UI changed** → attach iPad portrait + landscape screenshots to the PR.

## 5. Commit, push, PR

- Commit with a clear, descriptive message.
- Push to the session's designated branch: `git push -u origin <branch>`.
- If no **open** PR exists for the branch, open a **draft** PR. Mirror
  `.github/PULL_REQUEST_TEMPLATE.md`'s headings and fill them from the diff.

Divide of labour to keep straight: the **plan** captures what's next and why; the
**changelog** captures what shipped; the **registers + architecture** capture how
it works now. Keep them in sync.
