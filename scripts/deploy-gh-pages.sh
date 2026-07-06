#!/usr/bin/env bash
# Full deploy to GitHub Pages: build the app, inject the ENCRYPTED deck +
# credentials, and publish to the `gh-pages` branch as a SINGLE, force-pushed
# commit. Keeping it to one commit means old encrypted decks never linger in the
# branch history (an old deck sealed under a weak/revoked password would
# otherwise stay brute-forceable forever). Your plaintext CSV + user list are
# never committed — only ciphertext is.
#
# Usage:
#   scripts/deploy-gh-pages.sh <cards.csv> <users.input.json> [base-href]
#
#   base-href defaults to /chain-jitsu/  — correct for a project site served at
#   https://<user>.github.io/chain-jitsu/. For a custom domain served at the
#   root, pass  /  as the third argument.
#
# One-time: Settings → Pages → Deploy from a branch → gh-pages (root).
# To wipe the site back to "not set up", deploy without data (or delete
# deck.enc/users.json from gh-pages).
set -euo pipefail

CSV="${1:?path to your plaintext cards.csv}"
USERS="${2:?path to your users.input.json}"
BASE_HREF="${3:-/chain-jitsu/}"
cd "$(dirname "$0")/.."
ORIGIN="$(git remote get-url origin)"
PUB="web/dist/web/browser"

echo "› Encrypting deck + credentials…"
node scripts/provision.mjs "$CSV" "$USERS" web/public/data

echo "› Building (base-href $BASE_HREF)…"
( cd web && npm run build -- --base-href "$BASE_HREF" )

cp "$PUB/index.html" "$PUB/404.html"   # SPA fallback for deep links / refresh on Pages
touch "$PUB/.nojekyll"                  # don't let Jekyll touch built assets

echo "› Publishing single commit to gh-pages…"
tmp="$(mktemp -d)"
git -C "$tmp" init -q
git -C "$tmp" config user.email deploy@localhost
git -C "$tmp" config user.name deploy
cp -R "$PUB/." "$tmp/"
git -C "$tmp" add -A
git -C "$tmp" commit -q -m "Deploy $(date -u +%FT%TZ)"
git -C "$tmp" branch -M gh-pages
git -C "$tmp" push -q --force "$ORIGIN" gh-pages
rm -rf "$tmp"

echo "✓ Deployed to gh-pages (single commit, force-pushed)."
echo "  Published deck.enc is ciphertext; its safety is your password strength."
