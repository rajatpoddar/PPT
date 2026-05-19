#!/bin/sh
set -e

echo "🚀 Starting PPT Builders application..."

# Run Prisma migrations using the bundled CLI (v5.14.0)
# Call node directly on prisma's build entry — avoids npx downloading latest version
# and avoids the .wasm path issue with the .bin/prisma symlink
echo "📦 Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "✅ Migrations complete. Starting server on port ${PORT:-7784}..."
exec node server.js
