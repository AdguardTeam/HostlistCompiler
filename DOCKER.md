# Docker Configuration

This project uses Docker and Docker Compose with the layered environment configuration system.

## Quick Start

### Development

```bash
# Build and run with development configuration
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Production

```bash
# Set production secrets as environment variables
export ADMIN_KEY="your_admin_key"
export TURNSTILE_SECRET_KEY="your_secret_key"
export DIRECT_DATABASE_URL="your_database_url"
export PRISMA_DATABASE_URL="your_prisma_url"
export OPTIMIZE_API_KEY="your_optimize_key"

# Build and run with production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Configuration

The Docker setup integrates with the layered `.env` file system:

### File Loading Order

1. **`.env`** - Base configuration (loaded by docker-compose)
2. **`.env.${ENV}`** - Environment-specific (development or production)
3. **Environment variables** - Passed via `docker-compose.override.yml` or `-e` flags

### Environment Selection

Set the `ENV` variable to control which environment file is loaded:

```bash
# Development (default)
docker compose up

# Production
ENV=production docker compose up

# Or use the production compose file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Configuration Files

### docker-compose.yml (Base)

The base configuration that works for all environments:

- Defines service structure
- Loads `.env` and `.env.${ENV}` files
- Sets up volumes and networks
- Configures health checks

### docker-compose.override.yml (Development)

Automatically merged in development, adds:

- Source code volume mounts for live reloading
- Development-specific settings
- Template for local secrets

### docker-compose.prod.yml (Production)

Production-specific configuration:

- Uses `.env.production`
- Expects secrets from environment variables
- Resource limits and constraints
- Always-restart policy

## Secrets Management

### Development

Option 1 - Use `.env.local` (recommended):

```bash
# Create .env.local with your secrets
cp .env.example .env.local
# Edit .env.local with actual values

# Note: .env.local is excluded from Docker builds via .dockerignore
# You need to pass secrets explicitly
```

Option 2 - Add to `docker-compose.override.yml`:

```yaml
services:
    adblock-compiler:
        environment:
            - ADMIN_KEY=your_dev_key
            - TURNSTILE_SECRET_KEY=your_dev_secret
```

### Production

**Always use environment variables, never hardcode secrets:**

```bash
# Method 1: Export before running
export ADMIN_KEY="production_key"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Method 2: Pass inline
ADMIN_KEY="production_key" docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Method 3: Use a secrets file (not committed)
echo "ADMIN_KEY=production_key" > .env.secrets
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.secrets up
```

## Available Environment Variables

### From `.env` (all environments)

- `COMPILER_VERSION` - Compiler version
- `PORT` - Server port (default: 8787)
- `DENO_DIR` - Deno cache directory

### From `.env.development`

- `DATABASE_URL` - Local SQLite database
- `TURNSTILE_SITE_KEY` - Test Turnstile key
- `TURNSTILE_SECRET_KEY` - Test Turnstile secret

### From `.env.production`

- `DATABASE_URL` - Production database (placeholder)
- `TURNSTILE_SITE_KEY` - Production site key (placeholder)
- `TURNSTILE_SECRET_KEY` - Production secret (placeholder)

### Required Secrets (production)

- `ADMIN_KEY` - Admin API key
- `TURNSTILE_SECRET_KEY` - Real Turnstile secret
- `DIRECT_DATABASE_URL` - Postgres connection
- `PRISMA_DATABASE_URL` - Prisma Accelerate connection
- `OPTIMIZE_API_KEY` - Optimize API key
- `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` - Hyperdrive connection

## Docker Build

### Build Arguments

```bash
# Build with specific Deno version
docker build --build-arg DENO_VERSION=2.6.7 .

# Build for specific architecture
docker buildx build --platform linux/amd64,linux/arm64 .
```

### Multi-stage Build

The Dockerfile uses multi-stage builds:

1. **node-base** - Base image with Deno and Node.js
2. **builder** - Installs dependencies and prepares files
3. **runtime** - Minimal production image

## Volume Mounts

### Development (docker-compose.override.yml)

```yaml
volumes:
    - ./src:/app/src # Source code
    - ./worker:/app/worker # Worker code
    - ./public:/app/public # Static files
```

### Production

```yaml
volumes:
    - deno-cache:/app/.deno # Only Deno cache
```

## Health Checks

The service includes a health check:

```yaml
healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:8787/api']
    interval: 30s
    timeout: 3s
    retries: 3
    start_period: 5s
```

Check health status:

```bash
docker compose ps
docker inspect adblock-compiler --format='{{.State.Health.Status}}'
```

## Troubleshooting

### View logs

```bash
docker compose logs -f adblock-compiler
```

### Rebuild after changes

```bash
docker compose build --no-cache
docker compose up -d
```

### Check environment variables

```bash
docker compose exec adblock-compiler env | grep -E 'COMPILER_VERSION|PORT|DATABASE_URL'
```

### Access container shell

```bash
docker compose exec adblock-compiler sh
```

### Remove all containers and volumes

```bash
docker compose down -v
```

## Security Best Practices

1. ✅ **DO** use `.dockerignore` to exclude sensitive files
2. ✅ **DO** pass secrets via environment variables in production
3. ✅ **DO** use `.env.local` for local development secrets
4. ❌ **DON'T** commit secrets to any Docker Compose file
5. ❌ **DON'T** hardcode credentials in Dockerfile
6. ❌ **DON'T** include `.env.local` in Docker builds

## Example: Complete Production Deployment

```bash
#!/bin/bash
# production-deploy.sh

# Load secrets from secure storage (e.g., AWS Secrets Manager, Vault)
export ADMIN_KEY=$(aws secretsmanager get-secret-value --secret-id prod/admin-key --query SecretString --output text)
export TURNSTILE_SECRET_KEY=$(aws secretsmanager get-secret-value --secret-id prod/turnstile --query SecretString --output text)

# Pull latest code
git pull origin main

# Build and deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify health
sleep 10
curl -f http://localhost:8787/api || exit 1

echo "Deployment successful!"
```

## See Also

- [Environment Configuration](.env.README.md)
- [GitHub Actions Integration](.github/ENV_SETUP.md)
- [Main README](README.md)
