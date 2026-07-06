#!/usr/bin/env bash
# Rotate ONLY the encrypted deck + credentials on an already-deployed gh-pages,
# WITHOUT rebuilding the app. The app bundle doesn't change when the data does,
# so this just re-encrypts and swaps the two files, then amends the single
# gh-pages commit and force-pushes — fast, and it leaves no old ciphertext behind.
#
# Usage:
#   scripts/update-data.sh <cards.csv> <users.input.json>
#
# Use this to change the technique list or update credentials. (Re-provisioning
# re-seals the CSV and credentials together under a fresh master key, so both are
# replaced atomically — the "refresh that wipes both".)
set -euo pipefail

CSV="${1:?path to your plaintext cards.csv}"
USERS="${2:?path to your users.input.json}"
cd "$(dirname "$0")/.."

echo "› Re-encrypting deck + credentials…"
node scripts/provision.mjs "$CSV" "$USERS" web/public/data

echo "› Amending gh-pages with the new data files…"
git fetch -q origin gh-pages
tmp="$(mktemp -d)"
git worktree add -q --force "$tmp" origin/gh-pages
mkdir -p "$tmp/data"
cp web/public/data/deck.enc web/public/data/users.json "$tmp/data/"
git -C "$tmp" add -A
git -C "$tmp" commit -q --amend --no-edit
git -C "$tmp" push -q --force origin HEAD:gh-pages
git worktree remove --force "$tmp"

echo "✓ Rotated deck.enc + users.json on gh-pages (amended, force-pushed). No rebuild."
