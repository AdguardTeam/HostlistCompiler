#!/usr/bin/env bash
# quickstart.sh — Bootstrap local PostgreSQL for adblock-compiler development
#
# Usage: bash docs/database-setup/quickstart.sh
#
# Prerequisites: Docker installed and running, or native PostgreSQL 18+

set -euo pipefail

DB_USER="adblock"
DB_PASS="adblock"
DB_NAME="adblock_dev"
DB_PORT="5432"
CONTAINER_NAME="adblock-postgres"

echo "=== Adblock Compiler — Local Database Setup ==="
echo ""

# Check if Docker is available
if command -v docker &>/dev/null; then
    echo "[1/4] Starting PostgreSQL 18 via Docker..."

    # Stop existing container if running
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        echo "  Container '$CONTAINER_NAME' already running. Reusing it."
    elif docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
        echo "  Restarting stopped container '$CONTAINER_NAME'..."
        docker start "$CONTAINER_NAME"
    else
        docker run -d \
            --name "$CONTAINER_NAME" \
            -e POSTGRES_USER="$DB_USER" \
            -e POSTGRES_PASSWORD="$DB_PASS" \
            -e POSTGRES_DB="$DB_NAME" \
            -p "$DB_PORT:5432" \
            postgres:18-alpine
        echo "  Container '$CONTAINER_NAME' started."
    fi

    # Wait for PostgreSQL to be ready
    echo "  Waiting for PostgreSQL to accept connections..."
    POSTGRES_READY=0
    for i in {1..30}; do
        if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" &>/dev/null; then
            POSTGRES_READY=1
            break
        fi
        sleep 1
    done

    if [ "$POSTGRES_READY" -ne 1 ]; then
        echo "ERROR: PostgreSQL in container '$CONTAINER_NAME' did not become ready within 30 seconds."
        echo "       Check container logs with: docker logs \"$CONTAINER_NAME\""
        exit 1
    fi
else
    echo "[1/4] Docker not found. Checking for native PostgreSQL..."
    if ! command -v psql &>/dev/null; then
        echo "ERROR: Neither Docker nor PostgreSQL found. Install one of them."
        echo "  Docker: https://docs.docker.com/get-docker/"
        echo "  PostgreSQL: brew install postgresql@18"
        exit 1
    fi

    echo "  Using native PostgreSQL."
    if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo "  Creating database '$DB_NAME'..."
        createdb "$DB_NAME" 2>/dev/null || true
    fi
fi

CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}"

# Write .env.local if it doesn't have DATABASE_URL
echo "[2/4] Configuring .env.local..."
ENV_LOCAL=".env.local"
if [ -f "$ENV_LOCAL" ] && grep -q "^DATABASE_URL=" "$ENV_LOCAL"; then
    echo "  DATABASE_URL already set in $ENV_LOCAL. Skipping."
else
    {
        echo ""
        echo "# Local PostgreSQL (added by quickstart.sh)"
        echo "DATABASE_URL=\"$CONNECTION_STRING\""
        echo "DIRECT_DATABASE_URL=\"$CONNECTION_STRING\""
    } >> "$ENV_LOCAL"
    echo "  Added DATABASE_URL to $ENV_LOCAL"
fi

# Apply Prisma migrations
echo "[3/4] Applying Prisma migrations..."
if command -v npx &>/dev/null; then
    npx prisma migrate dev --name init_postgresql 2>/dev/null || npx prisma migrate deploy
    echo "  Migrations applied."
else
    echo "  WARNING: npx not found. Run 'npx prisma migrate dev' manually."
fi

# Generate Prisma client
echo "[4/4] Generating Prisma client..."
if command -v npx &>/dev/null; then
    npx prisma generate
    echo "  Prisma client generated."
else
    echo "  WARNING: npx not found. Run 'npx prisma generate' manually."
fi

echo ""
echo "=== Setup Complete ==="
echo "Connection string: $CONNECTION_STRING"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start wrangler dev server"
echo "  2. Run 'npx prisma studio' to browse data"
echo "  3. See docs/database-setup/plan.md for architecture details"
