# Suchi

Lists of the things you love — YouTube channels, songs, movies, places, people — ranked
when you want them to be.

## Features

- Sign-in with email + password; only emails in `ALLOWED_EMAILS` can sign up, and each user sees only their own lists.
- Each list has a mode, and you can switch any time without losing anything:
  - **Ranked** — numbered 1…N, drag to reorder.
  - **Tiered** — S/A/B/C/D rows (rename, add, delete tiers), drag items between them.
  - **Unranked** — a plain collection, sorted by newest / oldest / A–Z, with ✓ done.
- Items have a title and optional note, link, image URL and tags.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Base UI) · dnd-kit · Convex + Convex Auth (Password) · Vitest + convex-test.

## Development

Requires Node 22.18+ (`.nvmrc` pins 22). Development runs entirely on a local Convex
backend; nothing is on Convex cloud except production.

```bash
cd backend
npm install
npm run dev                  # starts the local backend and pushes convex/ (keep it running)
npm run setup:auth           # first time only: auth signing keys
npx convex env set SITE_URL http://localhost:5173
npx convex env set ALLOWED_EMAILS you@example.com

cd ../web
npm install
npm run dev                  # web app at http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `backend/`: `npm run dev` | Local Convex backend; pushes `convex/` on every change |
| `backend/`: `npm run deploy` | Push the functions to production (`scripts/deploy.sh` does this for you) |
| `backend/`: `npm run setup:auth` | Auth signing keys (`node scripts/setup-auth-keys.ts --apply --prod` for production) |
| `backend/`: `npm test` | Convex function tests (Vitest + convex-test) |
| `backend/`: `npm run check` | Typecheck, lint and tests for `convex/` and `scripts/` |
| `web/`: `npm run dev` | Dev server at http://localhost:5173 |
| `web/`: `npm run build` | Typecheck and production build into `web/dist/` |
| `web/`: `npm run check` | Typecheck, lint and tests |
| `scripts/check.sh` | Both checks; run before committing |
| `scripts/deploy.sh` | Checks, deploys Convex to production, builds and uploads to the VPS |
| `DRY_RUN=1 scripts/deploy.sh` | Same, but only previews: nothing is deployed or uploaded |

## Deployment

`scripts/deploy.sh` deploys `backend/convex/` to the production deployment, builds the site with
that deployment's URL, and syncs `web/dist/` to the VPS, where Caddy serves
https://suchi.pknspace.com. Settings live in each part's `.env.prod.local` (git-ignored,
see `.env.example`): `backend/.env.prod.local` has `CONVEX_DEPLOY_KEY` (in `backend/`:
`npx convex deployment token create suchi-deploy --deployment
praveen-nirmalkar:suchi:production --save-env .env.prod.local`), and `web/.env.prod.local` has
`DEPLOY_HOST` / `DEPLOY_PORT` / `DEPLOY_DIR`. Because routes are client-side, Caddy needs an
SPA fallback:

```
try_files {path} /index.html
```

## How it works

- Auth is Convex Auth (Password). `ALLOWED_EMAILS` is checked at sign-up/sign-in and again on every
  request (`backend/convex/lib/access.ts`), so removing an email cuts off existing sessions.
- Production env vars: `JWT_PRIVATE_KEY`/`JWKS` (`node scripts/setup-auth-keys.ts --apply --prod`),
  `SITE_URL=https://suchi.pknspace.com` and `ALLOWED_EMAILS`.

- `backend/convex/` holds the schema and functions (`lists`, `items`); `web/` is the Vite app and
  imports them as `@convex/...`.
- Ordering: ranked order and tier order are stored separately as plain integers (`position`,
  and `tier` + `tierPosition`), so switching modes keeps both. A move renumbers the affected
  items 0…N-1 in one mutation (`backend/convex/lib/order.ts`); the client applies the same move
  optimistically (`web/src/lib/reorder.ts`) so drops don't snap back.
