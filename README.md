# Statement Tracker

A personal credit-card statement tracker. Add your cards, log each monthly
statement — how much is due and by when — and see what you still owe this cycle.
v1 is fully manual entry.

Multi-user: anyone can sign up, and every account is isolated by `userId` at
every query. Deployed to Cloudflare Workers with a Cloudflare D1 (SQLite)
database.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Cloudflare Workers** via the **OpenNext** adapter (`@opennextjs/cloudflare`)
- **Auth.js v5** (NextAuth) — email/password (Credentials), JWT sessions
- **Prisma 6** → **Cloudflare D1** via the `@prisma/adapter-d1` driver adapter
- **Tailwind CSS v4** + shadcn (`base-nova`, base-ui primitives)
- Money stored as **bigint minor units** (sen) + ISO-4217 currency — never float.

## Data model

- `User` — an account (email + bcrypt password hash). Registration is open;
  accounts are isolated by `userId`.
- `Card` — a credit card: name, optional issuer/last4, accent color, currency,
  and a billing schedule (`statementDay`/`paymentDay`, day-of-month 1–31).
- `Statement` — one monthly statement: amount due (bigint sen), paid/unpaid,
  and a `statementDate`/`dueDate` **computed** from the card's schedule and the
  cycle month at write time.

## Features

- Per-card billing schedule; concrete statement and due dates are derived from
  it per cycle (`paymentDay < statementDay` rolls the due date into the next
  month; a 31st-of-month card is clamped to a valid day in short months).
- Dashboard view of what's outstanding, with paid/overdue/soon/upcoming state.
- Searchable, bank-prefixed card select when adding statements.
- **Import a statement from a PDF** — upload a statement and an
  OpenAI-compatible model reads the balance, cycle month, currency and best-match
  card into a prefilled form you review before saving. Requires
  `OPENAI_*` env (see setup); the chosen model must accept PDF input.
- Light/dark theme.
- Installable as a PWA (home-screen / desktop install prompt).

Presentation timezone is MYT (`Asia/Kuala_Lumpur`); the worker clock is UTC.

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
     For PDF import, also set `OPENAI_BASE_URL`, `OPENAI_API_KEY` and
     `OPENAI_MODEL` (see `.dev.vars.example`). In production set these via
     `wrangler secret put <NAME>`.

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
   Open the served URL → you'll be sent to `/signup`. Create an account and
   you're in.

## Database & migrations (Cloudflare D1)

D1 has its own migration system (`wrangler d1 migrations`); Prisma generates the
SQL via `prisma migrate diff`. `prisma/schema.prisma` is the source of truth for
the data model; migrations live in `migrations/`.

> **No transactions:** D1 does not support transactions, so Prisma `$transaction`
> is unavailable. This app does not use it.

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
```

## Verify

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run preview     # opennextjs-cloudflare build && preview (Workers runtime)
```

## Roadmap (deferred from v1)

- Partial payments + remaining-balance tracking
- Minimum-due vs full-statement-balance
- Auto-generate upcoming cycles from each card's schedule
- Email / push due-date reminders
- CSV / statement import
