# Suchi

Lists of the things you love — YouTube channels, songs, movies, places, people — ranked
when you want them to be.

Each list has a mode, and you can switch any time without losing anything:

- **Ranked** — numbered 1…N, drag to reorder.
- **Tiered** — S/A/B/C/D rows (rename, add, delete tiers), drag items between them.
- **Unranked** — a plain collection, sorted by newest / oldest / A–Z, with ✓ done.

Items have a title and optional note, link, image URL and tags. Every user sees only their
own lists. Only emails in `ALLOWED_EMAILS` can sign up or sign in, and it is re-checked on
every request, so removing an email cuts off existing sessions.

## Stack

Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui (Base UI), dnd-kit, Convex + Convex Auth
(password), Vitest + convex-test.

## Develop

```sh
npm install
npx convex dev            # first run: choose a local deployment; keep it running
npm run setup:auth        # once per deployment: JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL http://localhost:5173
npx convex env set ALLOWED_EMAILS you@example.com
npm run dev               # http://localhost:5173
```

| Script | |
| --- | --- |
| `npm run check` | Typecheck, lint, tests |
| `npm test` | Vitest (Convex functions + reorder helpers) |

## Ordering

Ranked order and tier order are stored separately as plain integers (`position`, and
`tier` + `tierPosition`), so switching modes keeps both. A move renumbers the affected
items 0…N-1 in one mutation; the client applies the same move optimistically so drops
don't snap back.
