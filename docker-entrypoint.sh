#!/bin/sh
set -e

echo "🚀 Starting PPT Builders application..."

# Run Prisma migrations using the bundled CLI (v5.14.0) — NOT npx which downloads latest
echo "📦 Running database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "✅ Migrations complete. Starting server on port ${PORT:-7784}..."
exec node server.js
