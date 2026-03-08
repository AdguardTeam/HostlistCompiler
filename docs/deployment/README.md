# Deployment

Guides for deploying the Adblock Compiler to various platforms.

## Contents

- [Docker Deployment](DOCKER.md) - Complete Docker guide with Kubernetes examples
- [Docker Configuration](DOCKER.md) - Docker Compose with layered environment configuration
- [Cloudflare Containers](cloudflare-containers.md) - Deploy to Cloudflare edge network
- [Cloudflare Pages](cloudflare-pages.md) - Deploy to Cloudflare Pages
- [Cloudflare Workers Architecture](CLOUDFLARE_WORKERS_ARCHITECTURE.md) - Backend vs frontend workers, deployment modes, and their relationship
- [Deployment Versioning](DEPLOYMENT_VERSIONING.md) - Automated deployment tracking and versioning
- [Production Readiness](PRODUCTION_READINESS.md) - Production readiness assessment and recommendations

## Quick Start

```bash
# Using Docker Compose (recommended)
docker compose up -d
```

Access the web UI at http://localhost:8787

## Related

- [Quick Start Guide](../guides/quick-start.md) - Get up and running quickly
- [Environment Configuration](../reference/ENV_CONFIGURATION.md) - Environment variables
- [GitHub Actions Environment Setup](../workflows/ENV_SETUP.md) - CI/CD environment configuration
