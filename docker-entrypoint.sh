#!/bin/sh
set -e

# Apply committed Prisma migrations against the SQLite volume before serving,
# using the isolated prisma CLI (kept out of the standalone server bundle).
# Idempotent: `migrate deploy` is a no-op when the DB is already up to date.
echo "Running database migrations..."
node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma

echo "Starting server..."
exec node server.js
