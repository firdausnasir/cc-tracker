# Statement Tracker

A personal credit-card statement tracker. Add your cards, log each monthly
statement — how much is due and by when — and see what you still owe this cycle.
v1 is fully manual entry.

Multi-user: anyone can sign up, and every account is isolated by `userId` at
every query. Self-hosted via Docker Compose, backed by a SQLite database on a
host volume.

## Stack

- **Next.js 16** (App Router, standalone output) + React 19 + TypeScript
- **Docker Compose** — single Alpine container with Next standalone output
- **Auth.js v5** (NextAuth) — email/password (Credentials), JWT sessions
- **Prisma 6** → **SQLite** (file on a mounted volume)
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

Presentation timezone is MYT (`Asia/Kuala_Lumpur`); the server clock is UTC.

## Deploy (Docker Compose)

The fastest path — one command pulls the published image, applies migrations,
and serves on port 3000.

1. **Configure env**
   ```bash
   cp .env.example .env
   ```
   Set at least `AUTH_SECRET` (generate with `openssl rand -base64 32`). For PDF
   import, also set `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
   `DATABASE_URL` is overridden by compose to the volume path — leave it.

2. **Up**
   ```bash
   docker compose pull
   docker compose up -d
   ```
   Open <http://localhost:3000> → you'll be sent to `/signup`. Create an account
   and you're in.

The SQLite database is a **host bind mount** at `./data/cc.db`. It persists
across `docker compose down` and image rebuilds — your data lives on this
machine, not inside the container. Back it up by copying `./data`; reset by
deleting `./data/cc.db`. Migrations run automatically on every container start
(`prisma migrate deploy`, a no-op when already current).

### Prebuilt images / Raspberry Pi notes

Use a 64-bit Raspberry Pi OS. Next.js 16's native build tooling supports Linux
ARM64, but not 32-bit ARM. The GitHub Actions workflow publishes multi-arch
images for `linux/amd64` and `linux/arm64` to GitHub Container Registry:

```bash
docker pull ghcr.io/firdausnasir/cc-tracker:latest
```

Compose uses that image by default, so low-spec machines do not need to compile
Next.js locally:

```bash
docker compose pull
docker compose up -d
```

If the GHCR package is private, authenticate once on the target machine:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
```

For local image development, build directly with Docker and tag the image you
want Compose to run:

```bash
DOCKER_BUILDKIT=1 docker build -t ghcr.io/firdausnasir/cc-tracker:latest .
```

## Local development

1. **Install**
   ```bash
   npm install
   ```

2. **Configure env** — copy `.env.example` to `.env`; the default
   `DATABASE_URL` (`file:./data/cc.db`) matches the path docker bind-mounts,
   so local dev and container share the same file. Also set `AUTH_SECRET`.

3. **Apply migrations and run**
   ```bash
   npm run db:migrate:dev     # prisma migrate dev — creates/updates the local DB
   npm run dev                # next dev
   ```

## Database & migrations (Prisma + SQLite)

`prisma/schema.prisma` is the source of truth; migrations live in
`prisma/migrations/` and use **Prisma Migrate**.

> **No transactions:** the app avoids Prisma `$transaction` (a constraint carried
> over from the original D1 backend); writes do not depend on it.

```bash
# add/alter the schema in prisma/schema.prisma, then:
npm run db:migrate:dev        # creates a new migration + applies it locally
# in containers, migrations are applied on startup via:
npm run db:migrate            # prisma migrate deploy
```

## Verify

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
DOCKER_BUILDKIT=1 docker build -t cc-tracker:verify .  # prove the production image builds
```

## Roadmap (deferred from v1)

- Partial payments + remaining-balance tracking
- Minimum-due vs full-statement-balance
- Auto-generate upcoming cycles from each card's schedule
- Email / push due-date reminders
- CSV / statement import
