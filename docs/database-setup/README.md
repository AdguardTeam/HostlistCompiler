# Database Setup

Documentation for database architecture, setup, and backend evaluation.

## Contents

- [Database Architecture](DATABASE_ARCHITECTURE.md) - Schema design and storage layer overview
- [Local Development Setup](local-dev.md) - Setting up a local PostgreSQL development environment
- [PostgreSQL Modern](postgres-modern.md) - Modern PostgreSQL features and configuration
- [Database Evaluation](DATABASE_EVALUATION.md) - PlanetScale vs Neon vs Cloudflare vs Prisma comparison
- [Prisma Evaluation](PRISMA_EVALUATION.md) - Storage backend and ORM comparison
- [Migration Plan](plan.md) - Database migration planning and execution

## Quick Start

```bash
# Start local PostgreSQL with Docker
bash quickstart.sh
```

## Related

- [Cloudflare D1](../cloudflare/CLOUDFLARE_D1.md) - Edge database integration
- [Storage Module](../../src/storage/README.md) - Storage source code
- [Prisma Backend](../../prisma/README.md) - Prisma configuration and schema
