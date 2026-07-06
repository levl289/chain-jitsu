# Chain Jitsu — Web (v1)

A mobile-first Angular + Material 3 study/drilling tool that turns a BJJ position
CSV into a playable positional **state machine**. v1 ships **Free Draw** mode.

- **Framework:** Angular 20 (standalone components + signals)
- **UI kit:** Angular Material (Material 3)
- **Backend:** none. The technique library and credentials are **not committed**
  and are **encrypted** — the app decrypts the deck in the browser after login.
  All user state (session, notes, progress) lives in `localStorage`.

## How the data stays private on a public, static host

This repo is meant to be **public**, but the academy's technique list is not. The
site is static (GitHub Pages / Cloudflare Pages), so there's no server to hide
data behind — anything published is fetchable. So instead we publish only
**ciphertext**:

- `data/deck.enc` — the CSV encrypted with a random AES-GCM master key. A scraper
  or `curl` gets noise.
- `data/users.json` — for each user, the master key **wrapped** by a key derived
  from their password (PBKDF2). No plaintext passwords, no hashes.

**Login = unwrapping the master key with your password.** A correct password both
authenticates you *and* yields the key to decrypt the deck; a wrong one fails the
AES-GCM check. Honest limits: a logged-in user can still read/extract the
decrypted deck (unavoidable for a client-rendered app), and the published files
can be **brute-forced offline**, so their safety is exactly your password
strength — use a strong instructor passphrase and decent student passwords.

## Provisioning (turning your CSV into publishable artifacts)

Keep your plaintext inputs in a local, git-ignored `secrets/` folder:

```
secrets/cards.csv          # the technique library (never committed)
secrets/users.input.json   # [{ "username", "password", "role", "displayName" }]
```

`role` is `instructor` or `student`. Then:

```bash
node scripts/provision.mjs secrets/cards.csv secrets/users.input.json
# → web/public/data/deck.enc  +  web/public/data/users.json  (both git-ignored)
```

Changing the CSV means re-running this, which mints a new master key and
re-wraps it for every user — i.e. the deck and credentials are sealed together.

## Running locally

```bash
cd web
npm install
npm start          # ng serve → http://localhost:4200
```

With no `deck.enc`/`users.json` present the app shows a **"not set up yet"**
screen; run the provision step above (dev passwords are fine locally) and it
works normally.

## Deploying to GitHub Pages

GitHub Pages serves files from a branch — there's no runtime upload, and (on the
free tier) a Pages site is world-public even from a private repo. So the encrypted
artifacts must live in what Pages serves. Keep `main` clean and publish the built
app + ciphertext to a `gh-pages` branch:

```bash
scripts/deploy-gh-pages.sh secrets/cards.csv secrets/users.input.json
```

One-time: set **Settings → Pages → deploy from `gh-pages` branch (root)**. Re-run
the script whenever the library or roster changes — that's your "refresh": it
replaces both files at once. To take the site back to the unprovisioned state,
deploy without the data (or delete `deck.enc`/`users.json` from `gh-pages`).

## How play works

1. **Choose a level** — a belt (cumulative) or **Free-for-all** (all cards incl.
   supplemental).
2. **Pick a starting position** (position + role, e.g. *Closed Guard / Bottom*).
3. **Pick a card** — tap for detail + a personal **notes** field. "Play this card"
   advances to the card's End Position.
4. The run continues until a **submission (Finish)**, a **dead-end**, or you
   **Stop**. Generic outcomes ("Top Position", etc.) let you continue from a
   manually-picked node, restricted to the realistic side.
5. **Mark Played** consumes every card in that run (deck exhaustion) until
   **Reset**; **Restart** re-drills the same run without consuming anything.

## Building for production

```bash
cd web
npm run build      # outputs to dist/web/browser
```

## Scope

**In v1:** Free Draw, belt/free-for-all filtering, deck exhaustion, per-card notes,
per-play score, encrypted deck + login.

**Deferred to v2+:** Random Draw · Scored Sequence · Callout / Attack-Defense modes
· in-app CSV editing · note & CSV **export**. Notes are stored in a flat, per-user
`localStorage` map (`btt.notes.v1.<username>`) so export is easy to add.
