#!/usr/bin/env bash
# Design-token discipline gate: blocks hardcoded brand-color hex outside the
# one canonical token file (aar-studio/css/rfs-tokens.css, imported by
# frontend/src/index.css — see that file's header comment).
#
# This exists because brand colors have drifted to a hand-copied stale value
# (the old #e5281B/#cbdb2a palette) multiple times across both apps even
# after a rebrand shipped the current #D8232A/#F6A609 values — see
# docs/wiki/developer/changelog.md. Catching *both* the old and the current
# canonical hex here means the next rebrand can't silently drift the same
# way: any hardcoded brand hex, old or new, should be a var() reference
# instead.
#
# Usage: bash scripts/check-brand-colors.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Old retired palette (still shows up when someone copies from an old
# component instead of using the token) + the current canonical brand hex
# (still wrong to hardcode — it should be var(--rfs-core-red) etc so the
# *next* rebrand only touches the token file).
BANNED_HEX='#(e5281b|cbdb2a|d8232a|b01620|e0555a|f6a609|d98a00)'

# Files allowed to contain these literal values: the canonical token file,
# frontend/src/index.css (the frontend-only extension of the token system —
# semantic/dark-theme values and documented contrast-ratio comments), and
# files with a documented reason they can't use var() (jsPDF and the AAR
# Studio export HTML both render outside the page that loads rfs-tokens.css,
# so a var() reference wouldn't resolve; Confetti's test asserts the
# rendered rgb() via jsdom's getComputedStyle, which doesn't resolve CSS
# custom properties).
ALLOWLIST=(
  'aar-studio/css/rfs-tokens.css'
  'frontend/src/index.css'
  'frontend/src/utils/exportUtils.pdf.ts'
  'frontend/src/components/Confetti.tsx'
  'frontend/src/components/Confetti.test.tsx'
  'aar-studio/js/lib/exports.js'
)

is_allowlisted() {
  local file="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    [[ "$file" == "$allowed" ]] && return 0
  done
  return 1
}

matches="$(grep -rniE "$BANNED_HEX" \
  --include='*.ts' --include='*.tsx' --include='*.css' --include='*.js' \
  frontend/src aar-studio/js aar-studio/css || true)"

violations=""
if [ -n "$matches" ]; then
  while IFS= read -r line; do
    file="${line%%:*}"
    if ! is_allowlisted "$file"; then
      violations+="$line"$'\n'
    fi
  done <<< "$matches"
fi

if [ -n "$violations" ]; then
  echo "❌ Hardcoded brand-color hex found outside the canonical token file:"
  echo ""
  echo "$violations"
  echo "Use a var() reference instead (e.g. var(--rfs-core-red), var(--accent-amber))."
  echo "The canonical token file is aar-studio/css/rfs-tokens.css — add a new"
  echo "token there if the value doesn't have one yet, don't hardcode the hex."
  exit 1
fi

echo "✅ No hardcoded brand-color hex outside the canonical token file."
