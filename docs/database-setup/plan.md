# Database Architecture Plan

> **Decision: PlanetScale PostgreSQL + Cloudflare Hyperdrive + Prisma ORM**

## Vendor Choice

**PlanetScale** was selected as the primary PostgreSQL provider because:

- Official Cloudflare Workers partnership with dedicated integration tutorial
- Native PostgreSQL v17/v18 (not Vitess/MySQL emulation)
- Zero-downtime schema migrations via deploy requests
- Multi-AZ HA with automatic failover from day one
- High write throughput on NVMe SSD storage
- Standard `pg` wire protocol — works with Hyperdrive and Prisma out of the box

The existing `adblock-db` database on PlanetScale is already linked to the Cloudflare Hyperdrive binding (`HYPERDRIVE`, id: `126a652809674e4abc722e9777ee4140`).

## Architecture

```
                        Cloudflare Worker
                              |
            +--------+--------+--------+--------+
            |        |        |        |        |
         [D1]    [Hyperdrive] [R2]    [KV]    [Queue]
          L1       |          Blobs   Cache   Async
         cache     |
                   |
            PlanetScale PostgreSQL
              (Source of truth)
```

### Storage Tiers

| Tier | Technology | Role | Latency |
|------|-----------|------|---------|
| **L0** | KV (`COMPILATION_CACHE`, `METRICS`) | Hot-path key-value cache | ~1-5ms |
| **L1** | D1 (`DB`) | Edge SQLite for structured cache lookups | ~1-10ms |
| **L2** | Hyperdrive -> PlanetScale | Primary relational store (source of truth) | ~20-80ms |
| **Blob** | R2 (`FILTER_STORAGE`) | Large compiled outputs, raw filter content | ~5-50ms |

### Data Flow

| Operation | L0 (KV) | L1 (D1) | L2 (PlanetScale) | Blob (R2) |
|-----------|---------|---------|-------------------|-----------|
| Compile (cache hit) | Read | -- | -- | -- |
| Compile (cache miss) | Write | -- | Read metadata + Write event | Read blob |
| Store compiled output | Write hash | -- | Write metadata | Write blob |
| Auth (API key check) | -- | -- | Read api_keys | -- |
| Health monitoring | -- | Read/Write | Write snapshots | -- |
| Admin dashboard | -- | -- | Read aggregates | -- |

## Branching Strategy

PlanetScale supports database branches that map to git branches:

| Git Branch | PlanetScale Branch | Purpose |
|------------|-------------------|---------|
| `main` | `main` | Production |
| `dev` / `develop` | `development` | Development/staging |
| Feature branches | Ad-hoc branches | Schema experimentation |

**Schema change workflow:**
1. Create a PlanetScale branch from `main`
2. Apply migration on the branch: `npx prisma migrate dev --name <description>`
3. Open a deploy request on PlanetScale (equivalent to a PR)
4. Review schema diff, then merge
5. Production picks up the change automatically

## Synchronization Strategy

### Schema sync: Prisma -> PlanetScale

Prisma is the single source of truth for schema. The `prisma/schema.prisma` file defines all models, and `npx prisma migrate` generates SQL migrations that are applied to PlanetScale.

```
Developer edits schema.prisma
    -> npx prisma migrate dev (local)
    -> git push (commit migration SQL)
    -> CI applies migration to PlanetScale dev branch
    -> Deploy request merges to main
```

### Data sync: D1 <-> PlanetScale

D1 remains an L1 cache layer. It does NOT need to mirror PlanetScale exactly. Instead:

- **Reads**: Worker checks D1 first. On miss, queries PlanetScale via Hyperdrive, then caches result in D1 with TTL.
- **Writes**: Worker writes to PlanetScale (source of truth), then invalidates or updates D1 cache.
- **Stale data**: D1 entries expire via application-level TTL (60-300s depending on data type).

### Data sync: R2 <-> PlanetScale

R2 stores binary blobs (compiled filter lists, raw downloads). PlanetScale stores metadata + R2 object keys. No bidirectional sync needed — PlanetScale references R2 keys, R2 stores the content.

## Connection Configuration

### Production (Cloudflare Workers)

The worker connects to PlanetScale through Hyperdrive:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function createPrisma(env: Env): PrismaClient {
    const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}
```

### Local Development

Local dev uses a PostgreSQL instance (Docker or native) with a direct connection.
Set credentials in `.env.local` (see `.env.example`):

```
DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:5432/adblock_dev"
```

See [local-dev.md](./local-dev.md) for setup instructions.

### Wrangler Hyperdrive

The `wrangler.toml` Hyperdrive section points to PlanetScale in production.
For local dev, set the real connection string via env var (see `.env.example`):

```bash
# .env.local (gitignored)
WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://<user>:<password>@127.0.0.1:5432/adblock_dev"
```

## Migration Phases

See the [GitHub issue #587](https://github.com/jaypatrick/adblock-compiler/issues/587) for the full phased migration plan. Summary:

1. **Phase 1** (this PR): Schema, config, documentation, local dev setup
2. **Phase 2**: Create `HyperdriveStorageAdapter` implementing `IStorageAdapter` via Prisma + `@prisma/adapter-pg`
3. **Phase 3**: Authentication system (users, API keys, sessions)
4. **Phase 4**: Data migration from D1 to PlanetScale
5. **Phase 5**: Cutover — PlanetScale as source of truth, D1 as L1 cache only

## References

- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) — Mermaid diagrams: storage tiers, data flow, auth, migration, schema relationships
- [DATABASE_EVALUATION.md](../DATABASE_EVALUATION.md) — Full vendor comparison
- [PRISMA_EVALUATION.md](../PRISMA_EVALUATION.md) — Storage adapter patterns
- [PlanetScale Postgres + Workers](https://planetscale.com/docs/postgres/tutorials/planetscale-postgres-cloudflare-workers)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
