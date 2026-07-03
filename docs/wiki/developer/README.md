# Developer Documentation

Documentation for developers working on RFS Station Manager. The repo-level
conventions AI agents must follow live in `CLAUDE.md`; this wiki holds the
longer-form material.

## Start here

| Page | What it covers |
|---|---|
| [getting-started.md](getting-started.md) | Local setup, commands, first run |
| [architecture.md](architecture.md) | Architecture of record (the former AS_BUILT) — apps, data flow, DB twins, seams |
| [feature-development.md](feature-development.md) | How to add a feature end-to-end (routes, twins, gating, tests) |
| [testing.md](testing.md) | Test conventions and best practices |
| [changelog.md](changelog.md) | Dated history of everything shipped |

## Reference

| Page | What it covers |
|---|---|
| [api-reference.md](api-reference.md) | Human-readable REST/WebSocket API reference (machine version: [`docs/registers/`](../../registers/)) |
| [registers-guide.md](registers-guide.md) | How the machine-readable registers work and how to keep them current |
| [authentication.md](authentication.md) | Auth configuration: JWT, admin accounts, brigade tokens, demo bypass |
| [security.md](security.md) | Security deployment guide |
| [security-advisory-xlsx.md](security-advisory-xlsx.md) | XLSX dependency advisory |
| [logging.md](logging.md) | Structured logging (winston) |
| [suite-token-validation.md](suite-token-validation.md) | Contract for sibling Bushie Tools apps validating the SM JWT |
| [accessibility-checklist.md](accessibility-checklist.md) | Developer accessibility checklist (WCAG 2.1 AA) |

## Operations

| Page | What it covers |
|---|---|
| [deployment.md](deployment.md) | Azure deployment guide |
| [deployment-optimization.md](deployment-optimization.md) | Deploy performance notes *(some pre-Linux-migration framing is stale — see plan Q7)* |
| [ci-pipeline.md](ci-pipeline.md) | CI/CD pipeline gates and behaviour *(same staleness caveat)* |
| [app-insights.md](app-insights.md) | Azure Application Insights setup |
| [post-deployment-testing.md](post-deployment-testing.md) | Post-deploy smoke tests against production |
| [qa-walkthrough.md](qa-walkthrough.md) | Browser-driven manual QA script |

## History

[`history/`](history/) holds material kept for reference, not maintained:

- `history/archive/` — completed design spikes (SaaS commercialization, AI
  maintenance agent, suite integration, consolidation review, AAR Studio plan)
  and old implementation summaries. Design detail in the spikes may still be
  cited; their forward work is tracked only in the master plan.
- `history/reviews/` — dated audits, UAT passes, code reviews, UI reviews, and
  their screenshots.
- `history/implementation-notes/` — deep dives written alongside past features.
- `history/MASTER_PLAN_v4_2026-07.md` — the pre-restructure master plan.

AAR Studio's own architecture doc lives with its code:
`aar-studio/docs/ARCHITECTURE.md`.
