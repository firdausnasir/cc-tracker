<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- IA policy §7.3 — mandatory classification -->

- **Data Class:** D4
- **Blast Radius:** B1
- **AI Mode:** generate

## Agent docs sync

Keep `AGENTS.md` and `CLAUDE.md` aligned. When changing persistent agent
instructions, update both files in the same change or explicitly document why
one file does not need the update.

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

## Database and Docker

Migrations live in `prisma/migrations/` and use **Prisma Migrate**.
`prisma/schema.prisma` is the source of truth. In Docker, the container
entrypoint runs `prisma migrate deploy` on every start (idempotent).

Self-hosted runtime is Docker Compose pulling the published GHCR image
`ghcr.io/firdausnasir/cc-tracker:latest`. The container runs the Next.js
standalone server (`output: "standalone"`, served via `node server.js`) backed
by SQLite at `./data/cc.db` through a host bind mount. Migrations apply on
startup via `docker-entrypoint.sh`, using an isolated Prisma CLI copied from the
locked build dependency install and kept out of the standalone server bundle.
