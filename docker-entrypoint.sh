#!/bin/sh
set -e

echo "🚀 Starting PPT Builders application..."

# Run Prisma migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "✅ Migrations complete. Starting server on port ${PORT:-7784}..."
exec node server.js
