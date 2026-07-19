#!/usr/bin/env bash
# Local mirror of the CI quality gate (.github/workflows/ci-cd.yml), in the same
# order, fail-fast. Run this before every push — green here means green in CI.
# Usage: npm run check   (or bash scripts/check.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

# Ensure deps exist so the gates can actually run.
bash scripts/setup.sh >/dev/null

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "1/6 backend typecheck"
( cd backend && npx tsc --noEmit )

step "2/6 backend tests"
( cd backend && npm test )

step "3/6 frontend lint (zero-warning gate)"
( cd frontend && npm run lint )

step "4/6 frontend typecheck"
( cd frontend && npx tsc -b --noEmit )

step "5/6 frontend tests"
( cd frontend && npm test )

step "6/6 AAR Studio tests"
( cd aar-studio && npm test )

printf '\n\033[1;32m✅ All CI gates passed locally — safe to push.\033[0m\n'
