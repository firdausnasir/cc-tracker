# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Agent docs sync

Keep `AGENTS.md` and `CLAUDE.md` aligned. When changing persistent agent
instructions, update both files in the same change or explicitly document why
one file does not need the update.

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
npm run dev              # next dev
npm run build            # prisma generate && next build
npm run start            # next start (production server)
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
docker compose up -d     # pull image, run migrations, serve on :3000
DOCKER_BUILDKIT=1 docker build -t cc-tracker:verify .  # build the production image
```

**Verification (no test framework configured):** the proving command is
`npm run typecheck && npm run lint`. For deployment behavior, `docker build`
proves the production image; `docker compose up -d` then exercises the real
runtime (boot-time migrations + `next start`) using the published GHCR image.

### Database (Prisma + SQLite)

```bash
npm run db:migrate:dev       # prisma migrate dev — create + apply a migration locally
npm run db:migrate           # prisma migrate deploy — apply committed migrations (used on container start)
npm run db:generate          # prisma generate
```

Migrations live in `prisma/migrations/` and use **Prisma Migrate**.
`prisma/schema.prisma` is the source of truth: edit it, then run
`npm run db:migrate:dev` to generate the migration. In Docker, the container
entrypoint runs `prisma migrate deploy` on every start (idempotent).

## Architecture

A personal credit-card statement tracker. Multi-user, isolated by `userId` at
every query. Self-hosted via **Docker Compose** — a single container running the
Next.js **standalone** server (`output: "standalone"`, served via
`node server.js`), backed by **SQLite** at `./data/cc.db` (a host bind mount, so
the DB persists across container removal and rebuilds). Migrations apply on
startup via `docker-entrypoint.sh`, using an isolated Prisma CLI copied from the
dedicated `prisma-cli` Docker stage and kept out of the standalone server
bundle.

**Runtime data access — shared Prisma client.** Obtain Prisma via
`await getPrisma()` (`src/lib/prisma.ts`), which returns a process-wide
`PrismaClient` singleton reading `DATABASE_URL` (a `file:` SQLite path). The
`getPrisma()` accessor is kept `async` for historical call-site compatibility;
there is no per-request binding. `DATABASE_URL` is set by compose to the volume
path (`file:/data/cc.db`).

**No transactions.** The app avoids Prisma `$transaction` (a constraint carried
over from the original D1 backend). Write logic that does not depend on it.

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
Presentation timezone is MYT (`Asia/Kuala_Lumpur`); the server clock is UTC.

**UI.** Tailwind CSS v4 + shadcn (`base-nova` style, components in
`src/components/ui/`, base-ui primitives). Pages are React Server Components that
load data through `getPrisma()`; interactive pieces (dialogs, forms, toggles)
are client components under `src/components/`. Aliases: `@/*` → `src/*`.
