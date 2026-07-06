# BTT Position Card Game — Web (v1)

A mobile-first Angular + Material 3 study/drilling tool that turns the BJJ position
card CSV into a playable positional **state machine**. v1 ships **Free Draw** mode.

- **Framework:** Angular 20 (standalone components + signals)
- **UI kit:** Angular Material (Material 3)
- **Backend:** none — the deck is read from a CSV **provided at runtime** (not
  committed to this repo); all user state (session, notes, progress) lives in the
  browser's `localStorage`.

## Running locally

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

Auth reads `public/data/users.json`, which is **not committed** (it's git-ignored and
supplied at runtime). Create one locally to sign in — an array of `{ username,
password, role }`, where `role` is `instructor` or `student`:

```json
[{ "username": "you", "password": "set-your-own", "role": "instructor" }]
```

> ⚠️ Auth is a client-side convenience gate, **not** real security — credentials
> live in a static JSON file readable by anyone who can load the app. Don't reuse a
> real password here.

## Editing the game content

Everything the game shows comes from **`public/data/cards.csv`** (one row = one card),
which is **git-ignored / provided at runtime** — see the schema in the v3 handoff doc.
Edit that file and reload — no code changes needed. The `Belt Level` column drives the
belt filter; a **blank** `Belt Level` marks a card as supplemental (shown only in
free-for-all, tagged "Supp"). To add/remove users, edit `public/data/users.json`.

## How play works

1. **Choose a level** — a belt (cumulative: e.g. Purple→Brown includes everything up
   to it) or **Free-for-all** (all cards incl. AI-generated).
2. **Pick a starting position** (position + role, e.g. *Closed Guard / Bottom*).
3. **Pick a card** — tap for full detail (goal, controls, execution, failures, safety,
   points/stabilization) and a personal **notes** field. "Play this card" advances the
   game to the card's `leads_to` state.
4. The run continues until a **submission (Finish)**, a **dead-end**, or you **Stop**.
   Generic outcomes like "Top Position" let you continue from a manually-picked node.
5. **Mark Played** consumes every card in that run (deck exhaustion — they won't be
   drawn again until **Reset**) and banks the score; **Restart** re-drills the same run
   without consuming anything.

## Building for production

```bash
npm run build      # outputs to dist/web/browser
```

## Docker

Multi-stage build (Node build → nginx static serve), host-agnostic and k8s-ready:

```bash
docker build -t btt-cards:latest .
docker run --rm -p 8080:80 btt-cards:latest   # → http://localhost:8080
```

`nginx.conf` handles SPA client-side routing and serves `/data/*` with `no-cache` so a
redeploy of the image picks up CSV/user edits immediately.

## Scope

**In v1:** Free Draw, belt/free-for-all filtering, deck exhaustion, per-card notes,
running score, config-file auth.

**Deferred to v2+:** Random Draw · Scored Sequence · Callout / Attack-Defense modes ·
in-app CSV editing · note & CSV **export** · CSV upload. Notes are already stored in a
flat, per-user `localStorage` map (`btt.notes.v1.<username>`) so export is easy to add.
