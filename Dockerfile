# syntax=docker/dockerfile:1.7

# Multi-stage build producing a slim Next.js standalone image.

# --- base: shared runtime libs ------------------------------------------------
# Alpine for a small footprint. Prisma needs openssl; libc6-compat smooths over
# glibc/musl edge cases for the engine binaries.
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat

# --- deps: full dependency tree (incl. devDeps) for the build -----------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Docker runs `prisma generate` explicitly in the builder. Skipping lifecycle
# scripts here avoids doing the same work during dependency installation.
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# --- builder: compile the standalone output -----------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npm run build:docker

# --- runner: minimal runtime image --------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/data/cc.db"

# Only the volume mount point needs root-time chown; doing it before the COPYs
# keeps it a tiny layer. Each COPY below sets ownership inline via --chown so we
# never rewrite the whole tree in a separate `chown -R` layer (that doubled the
# image size).
RUN mkdir -p /data && chown node:node /data
USER node

# Standalone server: traced node_modules + server.js. static/ and public/ are
# not copied by standalone, so add them explicitly.
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

# Ensure the Prisma query engine + generated client are present for runtime
# (@prisma/client is externalized; this guarantees the .node engine is there).
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Isolated prisma CLI + the schema/migrations for `migrate deploy` on startup.
# Reuse the locked dependency install instead of resolving/downloading Prisma a
# second time. Keep this list aligned with `node_modules/prisma/package.json`.
COPY --chown=node:node --from=deps /app/node_modules/prisma ./prisma-cli/node_modules/prisma
COPY --chown=node:node --from=deps /app/node_modules/@prisma/config ./prisma-cli/node_modules/@prisma/config
COPY --chown=node:node --from=deps /app/node_modules/@prisma/debug ./prisma-cli/node_modules/@prisma/debug
COPY --chown=node:node --from=deps /app/node_modules/@prisma/engines ./prisma-cli/node_modules/@prisma/engines
COPY --chown=node:node --from=deps /app/node_modules/@prisma/engines-version ./prisma-cli/node_modules/@prisma/engines-version
COPY --chown=node:node --from=deps /app/node_modules/@prisma/fetch-engine ./prisma-cli/node_modules/@prisma/fetch-engine
COPY --chown=node:node --from=deps /app/node_modules/@prisma/get-platform ./prisma-cli/node_modules/@prisma/get-platform
COPY --chown=node:node --from=deps /app/node_modules/@standard-schema/spec ./prisma-cli/node_modules/@standard-schema/spec
COPY --chown=node:node --from=deps /app/node_modules/c12 ./prisma-cli/node_modules/c12
COPY --chown=node:node --from=deps /app/node_modules/chokidar ./prisma-cli/node_modules/chokidar
COPY --chown=node:node --from=deps /app/node_modules/citty ./prisma-cli/node_modules/citty
COPY --chown=node:node --from=deps /app/node_modules/consola ./prisma-cli/node_modules/consola
COPY --chown=node:node --from=deps /app/node_modules/confbox ./prisma-cli/node_modules/confbox
COPY --chown=node:node --from=deps /app/node_modules/defu ./prisma-cli/node_modules/defu
COPY --chown=node:node --from=deps /app/node_modules/destr ./prisma-cli/node_modules/destr
COPY --chown=node:node --from=deps /app/node_modules/deepmerge-ts ./prisma-cli/node_modules/deepmerge-ts
COPY --chown=node:node --from=deps /app/node_modules/dotenv ./prisma-cli/node_modules/dotenv
COPY --chown=node:node --from=deps /app/node_modules/effect ./prisma-cli/node_modules/effect
COPY --chown=node:node --from=deps /app/node_modules/empathic ./prisma-cli/node_modules/empathic
COPY --chown=node:node --from=deps /app/node_modules/exsolve ./prisma-cli/node_modules/exsolve
COPY --chown=node:node --from=deps /app/node_modules/fast-check ./prisma-cli/node_modules/fast-check
COPY --chown=node:node --from=deps /app/node_modules/giget ./prisma-cli/node_modules/giget
COPY --chown=node:node --from=deps /app/node_modules/jiti ./prisma-cli/node_modules/jiti
COPY --chown=node:node --from=deps /app/node_modules/node-fetch-native ./prisma-cli/node_modules/node-fetch-native
COPY --chown=node:node --from=deps /app/node_modules/nypm ./prisma-cli/node_modules/nypm
COPY --chown=node:node --from=deps /app/node_modules/ohash ./prisma-cli/node_modules/ohash
COPY --chown=node:node --from=deps /app/node_modules/pathe ./prisma-cli/node_modules/pathe
COPY --chown=node:node --from=deps /app/node_modules/perfect-debounce ./prisma-cli/node_modules/perfect-debounce
COPY --chown=node:node --from=deps /app/node_modules/pkg-types ./prisma-cli/node_modules/pkg-types
COPY --chown=node:node --from=deps /app/node_modules/pure-rand ./prisma-cli/node_modules/pure-rand
COPY --chown=node:node --from=deps /app/node_modules/rc9 ./prisma-cli/node_modules/rc9
COPY --chown=node:node --from=deps /app/node_modules/readdirp ./prisma-cli/node_modules/readdirp
COPY --chown=node:node --from=deps /app/node_modules/tinyexec ./prisma-cli/node_modules/tinyexec
COPY --chown=node:node --from=builder /app/prisma ./prisma

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
