# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

<!-- IA policy §7.3 — mandatory classification -->

- **Tier:** C
- **Data Class:** D4
- **Blast Radius:** B1

> Auth + money surface (stores email + bcrypt password hash; amounts as bigint
> minor units). Customer-facing, material risk if broken → Tier C. Email +
> password hash → D4. Single self-hosted user → B1. Not IP-core (no
> attribution/tracking/fraud/matching).

## Critical: read before writing Next.js code

This repo runs **Next.js 16** (App Router). Per `AGENTS.md`, APIs and
conventions differ from older Next.js — read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code, and heed
deprecation notices. Do not assume Next.js 13/14 patterns.

## Commands

```bash
npm run dev              # next dev — local bindings via initOpenNextCloudflareForDev
npm run build            # prisma generate && next build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run preview          # opennextjs-cloudflare build && preview — runs on the real workerd runtime
npm run deploy           # opennextjs-cloudflare build && deploy to Cloudflare Workers
```

**Verification (no test framework configured):** the proving command is
`npm run typecheck && npm run lint`. For runtime behavior, `npm run preview`
exercises the actual Workers/D1 runtime — `npm run dev` can mask workerd-only
breakage.

### Database (Cloudflare D1)

```bash
npm run db:migrate:local     # wrangler d1 migrations apply cc-tracker --local
npm run db:migrate:remote    # apply to remote D1
npm run cf-typegen           # regenerate cloudflare-env.d.ts from wrangler bindings
```

Migrations live in `migrations/` and use **D1's own migration system**, not
Prisma Migrate. To add one: scaffold with
`npx wrangler d1 migrations create cc-tracker <name>`, then fill it with the SQL
diff from the Prisma schema via
`npx prisma migrate diff --from-local-d1 --to-schema-datamodel prisma/schema.prisma --script`.
`prisma/schema.prisma` is the source of truth for the data model; the generated
SQL is the migration.

## Architecture

A personal credit-card statement tracker. Multi-user, isolated by `userId` at
every query. Deployed to **Cloudflare Workers** via the **OpenNext** adapter
(`@opennextjs/cloudflare`), backed by **Cloudflare D1** (SQLite).

**Runtime data access — per-request Prisma client.** The D1 binding is
request-scoped on Workers, so there is no global client. Always obtain Prisma
via `await getPrisma()` (`src/lib/prisma.ts`), which builds a `PrismaClient`
from the `DB` binding using the `@prisma/adapter-d1` driver adapter. The
`DATABASE_URL` in `.env` is used **only** by the Prisma CLI (`generate`,
`migrate diff`) — never at runtime.

**No transactions.** D1 does not support transactions, so Prisma `$transaction`
is unavailable. Write logic that does not depend on it.

**Auth — Auth.js v5 (NextAuth), Credentials + JWT.** Config in `src/auth.ts`:
email/password via bcrypt (constant-time compare against a throwaway hash when
the email is unknown), stateless JWT sessions, `trustHost: true` for
self-hosting. The user id is threaded through the `jwt`/`session` callbacks so
`session.user.id` is available everywhere. The catch-all route at
`src/app/api/auth/[...nextauth]/route.ts` re-exports the handlers. Registration
is **open** (anyone can sign up); accounts are isolated by `userId`, not locked
to one.

**Route protection.** Two route groups under `src/app/`:
`(auth)/` holds `/signin` + `/signup`; `(app)/` holds the authenticated surface
(`/dashboard`, `/cards`). The guard lives in `(app)/layout.tsx` — it calls
`auth()` and `redirect("/signin")` when there is no session. Pages inside
`(app)/` may therefore assume a session exists. Root `/` redirects to
`/dashboard`.

**Mutations — Server Actions.** All writes go through `"use server"` actions in
`src/app/actions/` (`cards.ts`, `statements.ts`, `auth.ts`). Conventions to
follow when adding actions:
- Form-bound actions return `ActionState = { error: string } | null` and are
  driven by `useActionState` on the client; fire-and-forget actions (delete,
  toggle) return `void`.
- Every action calls `requireUserId()` (throws if unauthenticated) **and**
  scopes the DB query to that user. Mutations by id use
  `updateMany`/`deleteMany` with `where: { id, userId }` (or
  `card: { userId }`) so an id alone can never touch another user's row — a
  non-trivial `where` clause is the ownership boundary, do not drop it.
- Validate `FormData` with the Zod schema from `src/lib/validation.ts` before
  any DB access; return the first issue message on failure.
- Call `revalidatePath()` for affected routes after a successful write.

**Money — bigint minor units, never float.** Amounts are stored as `BigInt`
sen (`Statement.amountDue`) plus an ISO-4217 currency code. All conversion lives
in `src/lib/money.ts` (`parseAmountToMinor`, `formatMinor`, `minorToAmountInput`,
`sumByCurrency`). Never `parseFloat` an amount; never sum across currencies.

**Dates & billing cycles.** `src/lib/dates.ts` is the date authority. A card
stores `statementDay`/`paymentDay` (day-of-month, 1–31); a statement's concrete
`statementDate`/`dueDate` are **computed** from the card schedule + cycle month
via `cycleDates()` at write time and stored. `paymentDay < statementDay` rolls
the due date into the following month; `clampDay` keeps a 31st-of-month card
valid in February. Editing a card's schedule does **not** rewrite existing
statements' stored dates — they stay historically accurate to their cycle.
`dueState()` classifies a row as paid/overdue/soon/upcoming (date-only compare).
Presentation timezone is MYT (`Asia/Kuala_Lumpur`); the worker clock is UTC.

**UI.** Tailwind CSS v4 + shadcn (`base-nova` style, components in
`src/components/ui/`, base-ui primitives). Pages are React Server Components that
load data through `getPrisma()`; interactive pieces (dialogs, forms, toggles)
are client components under `src/components/`. Aliases: `@/*` → `src/*`.
