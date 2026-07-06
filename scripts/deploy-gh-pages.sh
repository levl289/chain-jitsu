#!/usr/bin/env bash
# Painless one-command deploy for GitHub Pages.
#
# Builds the app, injects the ENCRYPTED deck + credentials into the build, and
# publishes the result to the `gh-pages` branch. Your plaintext CSV and user
# list never get committed — only the ciphertext does.
#
# Usage:
#   scripts/deploy-gh-pages.sh <cards.csv> <users.input.json>
#
# One-time setup: in the repo's GitHub settings, set Pages to deploy from the
# `gh-pages` branch (root). After that, re-run this whenever the library or
# roster changes. To "wipe" the site back to the unprovisioned state, deploy a
# build without running the provision step (or delete deck.enc/users.json).
set -euo pipefail

CSV="${1:?path to your plaintext cards.csv}"
USERS="${2:?path to your users.input.json}"
cd "$(dirname "$0")/.."

echo "› Encrypting deck + credentials…"
node scripts/provision.mjs "$CSV" "$USERS" web/public/data

echo "› Building the app…"
( cd web && npm ci && npm run build )

echo "› Publishing to gh-pages…"
npx --yes gh-pages@6 -d web/dist/web/browser -b gh-pages -t   # -t includes dotfiles

echo "✓ Deployed. GitHub Pages must be set to serve from the 'gh-pages' branch."
echo "  The published deck.enc is ciphertext; its safety is your password strength."
