# syntax=docker/dockerfile:1

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
# `npm ci` runs the postinstall `prisma generate`, which needs prisma/schema.
RUN npm ci

# --- builder: compile the standalone output -----------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- prisma-cli: isolated prisma CLI + engines for boot-time migrations --------
# The standalone trace deliberately excludes the prisma CLI (it isn't imported
# by the server). Install it alone here so its complete dependency closure
# (@prisma/engines, @prisma/config, effect, ...) comes along — no fragile
# hand-picking of transitive deps.
FROM base AS prisma-cli
WORKDIR /opt/prisma
RUN npm init -y >/dev/null 2>&1 \
    && npm install --no-save --omit=dev prisma@6.19.3

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
COPY --chown=node:node --from=prisma-cli /opt/prisma/node_modules ./prisma-cli/node_modules
COPY --chown=node:node --from=builder /app/prisma ./prisma

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
