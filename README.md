# Statement Tracker

A small, personal credit-card statement tracker. Log each card's monthly
statement — how much is due and by when — and see what you still owe this cycle.

Built for **one user, deployed to Cloudflare Workers** with a **Cloudflare D1**
(SQLite) database. v1 is fully manual entry.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Cloudflare Workers** via the **OpenNext** adapter (`@opennextjs/cloudflare`)
- **Auth.js v5** (NextAuth) — email/password (Credentials), JWT sessions
- **Prisma 6** → **Cloudflare D1** via the `@prisma/adapter-d1` driver adapter
- **Tailwind CSS v4**
- Money stored as **bigint minor units** (sen) + ISO-4217 currency — never float.

## Data model

- `User` — the single account (registration locks after the first signup).
- `Card` — a credit card; doubles as the "account" you pay into.
- `Statement` — one monthly statement: amount due, statement date, due date,
  currency, paid/unpaid.

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Configure env**
   - `.env` — `DATABASE_URL="file:./prisma/dev.db"` (used only by the Prisma
     CLI for `generate` / `migrate diff`; the running app uses the D1 binding).
   - `.dev.vars` — `NEXTJS_ENV=development` and `AUTH_SECRET=<random>`
     (generate with `openssl rand -base64 32`). This file is gitignored.

3. **Create the local D1 database and apply migrations**
   ```bash
   npm run db:migrate:local   # wrangler d1 migrations apply cc-tracker --local
   ```

4. **Run**
   ```bash
   npm run dev                # next dev (bindings via initOpenNextCloudflareForDev)
   # or, against the real Workers runtime:
   npm run preview            # opennextjs-cloudflare build && preview
   ```
   Open the served URL → you'll be sent to `/signup`. The first account you
   create becomes the owner; signup then closes.

## Database & migrations (Cloudflare D1)

D1 has its own migration system (`wrangler d1 migrations`); Prisma generates the
SQL via `prisma migrate diff`. Migrations live in `migrations/`.

```bash
# 1. scaffold an empty migration file
npx wrangler d1 migrations create cc-tracker <name>
# 2. fill it with the SQL diff from the Prisma schema
#    (first migration uses --from-empty; later ones use --from-local-d1)
npx prisma migrate diff --from-local-d1 \
  --to-schema-datamodel prisma/schema.prisma --script \
  --output migrations/<NNNN>_<name>.sql
# 3. apply
npm run db:migrate:local      # local SQLite (.wrangler/state)
npm run db:migrate:remote     # remote D1
```

> **No transactions:** D1 does not support transactions, so Prisma `$transaction`
> is unavailable. This app does not use it.

## Deploy to Cloudflare Workers

1. **Authenticate** (interactive):
   ```bash
   npx wrangler login
   ```
2. **Create the D1 database** and paste its `database_id` into `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create cc-tracker
   ```
3. **Apply migrations to remote D1:**
   ```bash
   npm run db:migrate:remote
   ```
4. **Set the production auth secret** (Worker secret, not committed):
   ```bash
   npx wrangler secret put AUTH_SECRET
   ```
5. **Deploy:**
   ```bash
   npm run deploy
   ```
6. Open the `*.workers.dev` URL → `/signup` to create the single account.

## Verify

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run preview     # opennextjs-cloudflare build && preview (Workers runtime)
```

## Roadmap (deferred from v1)

- Partial payments + remaining-balance tracking
- Minimum-due vs full-statement-balance
- Auto-generate cycles from each card's statement day
- Email / push due-date reminders
- CSV / statement import
- Multi-user support
