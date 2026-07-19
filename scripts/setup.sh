#!/usr/bin/env bash
# Idempotent dependency install for backend + frontend.
# Fast no-op when deps are already present (safe to run on every session start).
# Usage: npm run setup   (or bash scripts/setup.sh [--force])
set -euo pipefail
cd "$(dirname "$0")/.."

FORCE="${1:-}"
installed_any=0

install_if_needed() {
  local dir="$1"
  if [[ "$FORCE" == "--force" || ! -d "$dir/node_modules" ]]; then
    echo "→ Installing $dir dependencies…"
    ( cd "$dir" && npm install --no-audit --no-fund )
    installed_any=1
  fi
}

install_if_needed backend
install_if_needed frontend
# aar-studio has no dependencies (node --test only) — nothing to install.

if [[ "$installed_any" == "0" ]]; then
  echo "✓ Dependencies already installed (backend, frontend). Nothing to do."
fi
