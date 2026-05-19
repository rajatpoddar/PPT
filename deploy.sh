#!/bin/bash
set -e

# ─── PPT Builders — Production Deploy Script ──────────────────────────────────
# Usage: ./deploy.sh
# Steps:
#   1. Git pull latest changes
#   2. Build new Docker image
#   3. Stop running containers
#   4. Start updated containers

APP_NAME="ppt-builders"
IMAGE_NAME="ppt-builders:latest"
COMPOSE_FILE="docker-compose.yml"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     PPT Builders — Production Deploy     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Step 1: Pull latest code ─────────────────────────────────────────────────
echo "📥 [1/4] Pulling latest code from git..."
git pull origin main
echo "✅ Git pull complete."
echo ""

# ─── Step 2: Build Docker image ───────────────────────────────────────────────
echo "🔨 [2/4] Building Docker image..."
docker build -t "$IMAGE_NAME" .
echo "✅ Docker image built: $IMAGE_NAME"
echo ""

# ─── Step 3: Stop running containers ──────────────────────────────────────────
echo "🛑 [3/4] Stopping running containers..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans
echo "✅ Containers stopped."
echo ""

# ─── Step 4: Start updated containers ─────────────────────────────────────────
echo "🚀 [4/4] Starting updated containers..."
docker compose -f "$COMPOSE_FILE" up -d
echo "✅ Containers started."
echo ""

# ─── Health check ─────────────────────────────────────────────────────────────
echo "⏳ Waiting for app to be ready..."
sleep 5

MAX_RETRIES=12
COUNT=0
until curl -sf http://localhost:7784 > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  echo "   Waiting... ($((COUNT+1))/$MAX_RETRIES)"
  sleep 5
  COUNT=$((COUNT+1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️  App may still be starting. Check logs with:"
  echo "   docker compose logs -f"
else
  echo "✅ App is live at http://localhost:7784"
fi

echo ""
echo "📋 Container status:"
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "📝 To view logs: docker compose logs -f"
echo "🔴 To stop:      docker compose down"
echo ""
