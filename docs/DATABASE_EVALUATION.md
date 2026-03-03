# Database Evaluation: PlanetScale vs Neon vs Cloudflare vs Prisma

> **Goal**: Evaluate PostgreSQL-compatible database vendors and design a relational schema to replace/complement the current Cloudflare R2 + D1 storage system.

---

## Table of Contents

1. [Current State](#current-state)
2. [What a Better Backend Could Unlock](#what-a-better-backend-could-unlock)
3. [Vendor Evaluation](#vendor-evaluation)
   - [Cloudflare D1 (current edge database)](#cloudflare-d1-current-edge-database)
   - [Cloudflare R2 (current object storage)](#cloudflare-r2-current-object-storage)
   - [Cloudflare Hyperdrive](#cloudflare-hyperdrive)
   - [Neon — Serverless PostgreSQL](#neon--serverless-postgresql)
   - [PlanetScale — Serverless MySQL](#planetscale--serverless-mysql)
   - [Prisma ORM](#prisma-orm)
4. [Head-to-Head Comparison](#head-to-head-comparison)
5. [Proposed Database Design](#proposed-database-design)
   - [Authentication System](#authentication-system)
   - [Blocklist Storage and Caching](#blocklist-storage-and-caching)
   - [Compilation History and Metrics](#compilation-history-and-metrics)
   - [Source Health and Change Tracking](#source-health-and-change-tracking)
6. [Recommended Architecture](#recommended-architecture)
7. [Cloudflare Hyperdrive Integration](#cloudflare-hyperdrive-integration)
8. [Migration Plan](#migration-plan)
9. [Proposed PostgreSQL Schema](#proposed-postgresql-schema)
10. [References](#references)

---

## Current State

The adblock-compiler uses three distinct storage mechanisms:

| Storage | Technology | Purpose | Location |
|---------|-----------|---------|----------|
| **Cloudflare D1** | SQLite at edge | Filter cache, compilation metadata, health metrics | Edge (Workers) |
| **Cloudflare R2** | Object storage (S3-compatible) | Large filter list blobs, output artifacts | Edge (object store) |
| **Prisma/SQLite** | SQLite via Prisma ORM | Local dev storage, same schema as D1 | Local / Node.js / Deno |

**Hyperdrive** is already configured in `wrangler.toml` with a binding (`HYPERDRIVE`) but no target database yet:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "126a652809674e4abc722e9777ee4140"
localConnectionString = "postgres://username:password@127.0.0.1:5432/database"
```

### Current Limitations

| Limitation | Impact |
|-----------|--------|
| D1 is SQLite — no real concurrent writes | Cannot scale beyond a single Worker's D1 replica |
| D1 max row size: 1 MB | Large filter lists cannot be stored as single rows |
| R2 has no query capability | Cannot filter, sort, or aggregate stored lists |
| No authentication system | No per-user API keys, rate limiting per account, or admin roles |
| No shared state between deployments | Each Worker region may see different data |
| No schema validation at the DB level | Business rules enforced only in TypeScript code |
| SQLite lacks advanced indexing | Full-text search, JSONB queries, `pg_vector` extensions not available |

---

## What a Better Backend Could Unlock

Moving to a shared relational PostgreSQL database (e.g., via Neon + Hyperdrive) would enable:

1. **User authentication** — API keys, JWT sessions, OAuth. Users could save filter list configurations, track compilation history, and have per-account rate limits.
2. **Shared blocklist registry** — Store popular/community filter lists in the database. Workers query and serve them without downloading from upstream every time.
3. **Real-time analytics** — Aggregate compile counts, rule counts, latency distributions across all Workers using proper SQL aggregations.
4. **Full-text search** — Search through filter rules, source URLs, or configuration names using PostgreSQL `tsvector`.
5. **Admin dashboard backend** — Persist admin-managed settings, feature flags, and overrides across regions.
6. **Row-level security** — Tenant isolation for a future multi-tenant SaaS offering.
7. **Branching / staging environments** — Neon's branch-per-environment feature maps perfectly to the existing `development`, `staging`, and `production` Cloudflare environments.

---

## Vendor Evaluation

### Cloudflare D1 (current edge database)

D1 is Cloudflare's managed SQLite service that runs at the edge. It replicates reads globally while writes go to a primary location.

**Pros**

- ✅ Zero additional infrastructure — runs natively inside Cloudflare Workers
- ✅ No connection overhead — native binding (`env.DB`)
- ✅ Global read replication (SQLite replicated to ~300 PoPs)
- ✅ Free tier: 5 million rows read/day, 100k writes/day, 5 GB storage
- ✅ Familiar SQL syntax
- ✅ Prisma D1 adapter available (`@prisma/adapter-d1`)
- ✅ Already in use — schema exists, migrations applied

**Cons**

- ❌ SQLite — no real PostgreSQL features (JSONB, arrays, extensions, `pg_vector`)
- ❌ 1 MB max row size — large filter lists require chunking
- ❌ Write-path latency — writes go to a single primary (up to 70–100 ms from edge)
- ❌ 10 GB max database size per database
- ❌ No concurrent write transactions (single-writer model)
- ❌ No authentication at DB level (no row-level security, no roles)
- ❌ Limited aggregation / window functions compared to PostgreSQL

**Best for:** Edge-local caching, ephemeral session state, hot-path lookups where read latency matters most.

---

### Cloudflare R2 (current object storage)

R2 is Cloudflare's S3-compatible object storage with no egress fees.

**Pros**

- ✅ No egress fees (unlike AWS S3)
- ✅ S3-compatible API
- ✅ Excellent for large binary blobs (full compiled filter lists, backups)
- ✅ Already used for `FILTER_STORAGE` binding
- ✅ Free tier: 10 GB storage, 1M Class-A operations/month

**Cons**

- ❌ Object store only — no SQL, no query capability
- ❌ Cannot query contents — must know the exact key
- ❌ Not suitable as a primary relational database
- ❌ Metadata is limited (only HTTP headers / custom metadata per object)

**Best for:** Storing compiled filter list artifacts (`.txt` blobs), backup snapshots. Keep R2 even after migrating to PostgreSQL.

---

### Cloudflare Hyperdrive

Hyperdrive is **not a database** — it is a connection accelerator and query result caching layer that sits between Cloudflare Workers and any external PostgreSQL (or MySQL) database.

```
Cloudflare Worker
    ↓  (standard pg connection string)
Hyperdrive
    ↓  (pooled, geographically distributed)
PostgreSQL database (Neon / Supabase / self-hosted)
```

**How it helps**

- **Connection pooling** — PostgreSQL allows ~100–500 max connections; Workers can fan out to thousands. Hyperdrive maintains a connection pool close to your database and reuses connections across requests.
- **Query caching** — Non-mutating queries (`SELECT`) can be cached at the Hyperdrive edge PoP for configurable TTLs, reducing round-trip to the origin database.
- **Lower latency** — Without Hyperdrive, a Worker in Europe connecting to a US-east PostgreSQL incurs ~120 ms TCP handshake + TLS. With Hyperdrive, the TLS session is pre-warmed and pooled.

**Pros**

- ✅ Works with any standard PostgreSQL wire protocol
- ✅ Reduces cold-start latency by 2–10×
- ✅ Transparent to the application — use standard `pg` client
- ✅ Already configured in `wrangler.toml` (binding `HYPERDRIVE`)
- ✅ Caches `SELECT` results at the edge
- ✅ Pay-per-use, included in Workers Paid plan

**Cons**

- ❌ Requires an external PostgreSQL database (it accelerates but does not replace one)
- ❌ Not available on free Workers plan
- ❌ Some client libraries need minor adaptation (`pg` node-postgres works; Prisma requires `@prisma/adapter-pg`)

**Best for:** Accelerating connections from Workers to any external PostgreSQL provider (Neon, Supabase, etc.).

---

### Neon — Serverless PostgreSQL

[Neon](https://neon.tech) is a serverless PostgreSQL service built on a disaggregated storage architecture. Compute auto-scales to zero when idle.

**Pros**

- ✅ **True PostgreSQL** — full compatibility including extensions (`pg_vector`, `pg_trgm`, `uuid-ossp`, PostGIS, etc.)
- ✅ **Serverless / auto-suspend** — compute pauses when idle, reducing cost during low-traffic periods
- ✅ **Branching** — create a database branch per feature branch, PR environment, or staging slot (same as git branches)
- ✅ **Cloudflare Hyperdrive compatible** — standard PostgreSQL wire protocol
- ✅ **`@neondatabase/serverless` WebSocket driver** — works directly in Cloudflare Workers without Hyperdrive (useful as a fallback)
- ✅ **Prisma support** — `@prisma/adapter-neon` available
- ✅ **Generous free tier** — 512 MB storage, 1 compute unit, unlimited branches
- ✅ **Point-in-time restore** — up to 30 days (paid plans)
- ✅ **Row-level security** — PostgreSQL native RLS via roles/policies

**Cons**

- ❌ Cold start latency (~100–500 ms on free tier when compute was suspended) — mitigated by Hyperdrive caching
- ❌ WebSocket driver has some quirks vs. standard `pg` module
- ❌ Compute scaling has a ceiling on lower-tier plans
- ❌ Relatively newer product (launched 2022) compared to established providers

**Pricing (2025)**

| Tier | Storage | Compute | Cost |
|------|---------|---------|------|
| Free | 512 MB | 0.25 CU, auto-suspend | $0/month |
| Launch | 10 GB | 1 CU, auto-suspend | $19/month |
| Scale | 50 GB | 4 CU, auto-suspend | $69/month |

**Best for:** Projects needing true PostgreSQL on a serverless, low-ops budget. The branching feature maps directly to Cloudflare's multi-environment deployment model.

---

### PlanetScale — Serverless MySQL

[PlanetScale](https://planetscale.com) is a serverless database platform based on Vitess — the same sharding layer used by YouTube, Slack, and GitHub.

**Pros**

- ✅ **Branching** — same git-style branching model as Neon (safe schema migrations via deploy requests)
- ✅ **Zero-downtime schema migrations** — deploy schema changes without locking tables
- ✅ **High write throughput** — Vitess sharding handles very high concurrent writes
- ✅ **Direct connections in Workers** — `@planetscale/database` HTTP driver works in Cloudflare Workers without Hyperdrive
- ✅ **Prisma support** — `@prisma/adapter-planetscale` available
- ✅ **MySQL compatibility** — familiar SQL syntax

**Cons**

- ❌ **MySQL, not PostgreSQL** — no JSONB (only JSON), no arrays, no advanced extensions (`pg_vector`, PostGIS), different window function syntax
- ❌ **No foreign key constraints** — Vitess does not enforce FK constraints at the database level (must be enforced in application code or Prisma)
- ❌ **No free tier (as of 2024)** — PlanetScale eliminated its free tier; plans start at $39/month
- ❌ **Prisma workarounds needed** — `relationMode = "prisma"` required to emulate FK behavior
- ❌ MySQL feature parity: some PostgreSQL-specific features (CTEs, window functions, RLS) differ

**Pricing (2025)**

| Tier | Storage | Reads | Writes | Cost |
|------|---------|-------|--------|------|
| Scaler Pro | 10 GB | 100B rows/month | 50M rows/month | $39/month |

**Best for:** Applications with very high write concurrency (social feeds, event streams) that are already on MySQL. For new PostgreSQL-targeted projects, Neon is generally preferred.

---

### Prisma ORM

[Prisma](https://www.prisma.io) is an ORM (Object-Relational Mapper) that generates type-safe database clients from a schema file. **Prisma is not a database** — it works on top of the databases evaluated above.

**Pros**

- ✅ **Already in use** — `PrismaStorageAdapter` and `D1StorageAdapter` both exist
- ✅ **Type-safe queries** — generated TypeScript client from `schema.prisma`
- ✅ **Multi-database support** — same code, different provider (SQLite → PostgreSQL requires only a config change)
- ✅ **Migration management** — `prisma migrate dev` generates and applies SQL migrations
- ✅ **Prisma Studio** — GUI data browser
- ✅ **Driver adapters** — `@prisma/adapter-neon`, `@prisma/adapter-d1`, `@prisma/adapter-pg` for edge runtimes
- ✅ **Deno support** — via `runtime = "deno"` in generator config
- ✅ **Works with all vendors** — PostgreSQL (Neon, Supabase), MySQL (PlanetScale), SQLite (D1, local)

**Cons**

- ❌ **Prisma Client in Cloudflare Workers** — requires driver adapter (`@prisma/adapter-neon` or `@prisma/adapter-pg` via Hyperdrive)
- ❌ **Bundle size** — Prisma Client adds ~300 KB to Worker bundle; use edge-compatible driver adapters
- ❌ **Raw SQL sometimes needed** — complex PostgreSQL queries (e.g., `UPSERT ... RETURNING`, CTEs) require `prisma.$queryRaw`
- ❌ **MongoDB has limitations** — some Prisma features not supported on MongoDB connector

**Recommendation:** Keep Prisma as the ORM layer. Use `@prisma/adapter-neon` or `@prisma/adapter-pg` (via Hyperdrive) in Workers.

---

## Head-to-Head Comparison

| Criterion | Cloudflare D1 | Cloudflare R2 | Neon | PlanetScale | Prisma |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Database type** | SQLite | Object store | PostgreSQL | MySQL (Vitess) | ORM (any DB) |
| **True PostgreSQL** | ❌ | ❌ | ✅ | ❌ | via adapter |
| **Foreign keys** | ✅ | N/A | ✅ | ❌ (app-level) | ✅ |
| **JSONB columns** | ❌ | ❌ | ✅ | ❌ (JSON only) | ✅ |
| **Extensions** | ❌ | N/A | ✅ (pg_vector, etc.) | ❌ | ✅ |
| **Row-level security** | ❌ | ❌ | ✅ | ❌ | via DB |
| **Branching** | ❌ | ❌ | ✅ | ✅ | N/A |
| **Serverless / auto-scale** | ✅ | ✅ | ✅ | ✅ | N/A |
| **Works in CF Workers** | ✅ (native) | ✅ (native) | ✅ (ws driver or Hyperdrive) | ✅ (HTTP driver) | ✅ (adapter) |
| **Hyperdrive compatible** | ❌ | ❌ | ✅ | ✅ (MySQL) | N/A |
| **Free tier** | ✅ (generous) | ✅ (generous) | ✅ (512 MB) | ❌ ($39/mo min) | N/A |
| **Max storage** | 10 GB/DB | Unlimited | Plan-dependent | Plan-dependent | N/A |
| **Connection pooling** | Built-in | N/A | Neon pooler / Hyperdrive | Built-in | N/A |
| **Migration tooling** | Manual SQL / Prisma | N/A | Prisma / raw SQL | Prisma / deploy requests | Built-in CLI |
| **Latency (from Worker)** | ~0–5 ms (edge) | ~5–50 ms | ~20–120 ms + Hyperdrive | ~20–100 ms | N/A |
| **Best use** | Hot-path edge KV | Blob storage | Primary relational DB | High-write MySQL app | ORM layer |

---

## Proposed Database Design

The following schema design uses **PostgreSQL** conventions and targets Neon as the primary provider, accessed from Workers via Hyperdrive + Prisma.

### Authentication System

An authentication system enables per-user API keys, admin roles, and audit logging.

```
users
├── id (UUID)
├── email (unique)
├── display_name
├── role (admin | user | readonly)
├── created_at
└── updated_at

api_keys
├── id (UUID)
├── user_id → users.id
├── key_hash (SHA-256 of the raw key — never store plaintext)
├── key_prefix (first 8 chars for display, e.g. "abc12345...")
├── name (human label, e.g. "CI pipeline key")
├── scopes (text[] — e.g. ['compile', 'admin:read'])
├── rate_limit_per_minute
├── last_used_at
├── expires_at (nullable)
├── revoked_at (nullable)
├── created_at
└── updated_at

sessions (for web UI login)
├── id (UUID)
├── user_id → users.id
├── token_hash
├── ip_address
├── user_agent
├── expires_at
└── created_at
```

**Design decisions:**

- Store only the **hash** of API keys — never plaintext. On creation, return the raw key once to the user.
- Use PostgreSQL `text[]` for `scopes` — avoids a join table for simple RBAC.
- `sessions` is for browser sessions (cookie-based); `api_keys` is for programmatic access.
- Leverage PostgreSQL row-level security to ensure users can only see their own data.

### Blocklist Storage and Caching

Rather than only caching in R2 or D1, persist structured metadata in PostgreSQL with blobs in R2.

```
filter_sources
├── id (UUID)
├── url (unique) — canonical upstream URL
├── name — human label (e.g. "EasyList")
├── description
├── homepage
├── license
├── is_public (bool) — community-visible or private
├── owner_user_id → users.id (nullable — NULL = system/community)
├── refresh_interval_seconds (e.g. 3600)
├── last_checked_at
├── last_success_at
├── last_failure_at
├── consecutive_failures
├── status (healthy | degraded | unhealthy | unknown)
├── created_at
└── updated_at

filter_list_versions
├── id (UUID)
├── source_id → filter_sources.id
├── content_hash (SHA-256)
├── rule_count
├── etag
├── r2_key — pointer to R2 object containing raw content
├── fetched_at
├── expires_at
└── is_current (bool — latest successful fetch)

compiled_outputs
├── id (UUID)
├── config_hash (SHA-256 of the input IConfiguration JSON)
├── config_name
├── config_snapshot (jsonb — full IConfiguration used)
├── rule_count
├── source_count
├── duration_ms
├── r2_key — pointer to R2 object containing compiled output
├── owner_user_id → users.id (nullable)
├── created_at
└── expires_at (nullable — NULL = permanent)
```

**Design decisions:**

- Raw filter list content lives in **R2** (blobs up to gigabytes). PostgreSQL stores metadata and the R2 object key.
- `filter_list_versions` tracks every fetch, enabling point-in-time recovery and diffing.
- `compiled_outputs` stores the result of each unique compilation (deduplication by `config_hash`).
- `config_snapshot` as `jsonb` enables querying past configurations.

### Compilation History and Metrics

```
compilation_events
├── id (UUID)
├── compiled_output_id → compiled_outputs.id
├── user_id → users.id (nullable)
├── api_key_id → api_keys.id (nullable)
├── request_source (worker | cli | batch_api)
├── worker_region (e.g. "enam", "weur")
├── client_ip_hash
├── duration_ms
├── cache_hit (bool)
├── error_message (nullable)
└── created_at

-- Materialized view for dashboard analytics
-- CREATE MATERIALIZED VIEW compilation_stats_hourly AS
-- SELECT
--   date_trunc('hour', created_at) AS hour,
--   count(*) AS total,
--   sum(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
--   avg(duration_ms) AS avg_duration_ms,
--   max(rule_count) AS max_rules
-- FROM compilation_events
-- JOIN compiled_outputs ON ...
-- GROUP BY 1;
```

### Source Health and Change Tracking

```
source_health_snapshots
├── id (UUID)
├── source_id → filter_sources.id
├── status (healthy | degraded | unhealthy)
├── total_attempts
├── successful_attempts
├── failed_attempts
├── consecutive_failures
├── avg_duration_ms
├── avg_rule_count
└── recorded_at

source_change_events
├── id (UUID)
├── source_id → filter_sources.id
├── previous_version_id → filter_list_versions.id (nullable)
├── new_version_id → filter_list_versions.id
├── rule_count_delta (new - previous)
├── content_hash_changed (bool)
└── detected_at
```

---

## Recommended Architecture

### Summary Recommendation

> **Use Neon (PostgreSQL) + Cloudflare Hyperdrive + Prisma ORM, while keeping D1 for hot-path edge caching and R2 for blob storage.**

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Primary relational DB** | Neon (PostgreSQL) | True PostgreSQL, serverless, branching, free tier, Hyperdrive compatible |
| **Edge acceleration** | Cloudflare Hyperdrive | Reduces Worker → Neon latency by 2–10×, connection pooling |
| **ORM** | Prisma | Already integrated, type-safe, Deno + Workers compatible via adapters |
| **Edge hot-path cache** | Cloudflare D1 | Sub-5ms lookups for filter cache hits; keep as L1 cache layer |
| **Blob storage** | Cloudflare R2 | Large compiled outputs, raw filter list content |
| **Local development DB** | SQLite via Prisma | Zero-config local dev; switch to PostgreSQL URL for staging/prod |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                            │
│                                                                 │
│  Request                                                        │
│    ↓                                                            │
│  [D1 cache lookup]  ──── HIT ────▶  Return cached result       │
│    ↓ MISS                                                       │
│  [Hyperdrive]  ──────────────────▶  [Neon PostgreSQL]          │
│    ↓                                        ↓                  │
│  [Prisma Client]  ◀──────────────  Query result                │
│    ↓                                                            │
│  [R2]  (fetch blob if needed)                                   │
│    ↓                                                            │
│  [D1 cache write]  (populate L1 cache)                         │
│    ↓                                                            │
│  Return response                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow by Use Case

| Operation | L1 (D1) | L2 (Hyperdrive → Neon) | Blob (R2) |
|-----------|---------|----------------------|-----------|
| Compile filter list (cache hit) | Read | — | — |
| Compile filter list (cache miss) | Write (on complete) | Read/Write metadata | Read blob |
| Store compiled output | — | Write metadata | Write blob |
| User authentication | — | Read api_keys | — |
| Health monitoring | Read/Write | Write snapshots | — |
| Admin dashboard | — | Read aggregates | — |
| Analytics queries | — | Read materialized views | — |

---

## Cloudflare Hyperdrive Integration

Hyperdrive is already configured in `wrangler.toml`. The next steps are:

### 1. Create a Neon Database

```bash
# Install Neon CLI
npm install -g neonctl

# Create a project
neonctl projects create --name adblock-compiler

# Get connection string
neonctl connection-string --project-id <PROJECT_ID>
# Output: postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 2. Update Hyperdrive with Neon Connection

```bash
# Create Hyperdrive config pointing to Neon
wrangler hyperdrive create adblock-hyperdrive \
  --connection-string="postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Note the returned ID and update wrangler.toml
```

Update `wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<NEW_HYPERDRIVE_ID>"
localConnectionString = "postgres://username:password@127.0.0.1:5432/adblock_dev"
```

### 3. Install Prisma with Neon Adapter

```bash
npm install @prisma/client @prisma/adapter-neon @neondatabase/serverless
npm install -D prisma
```

### 4. Update Prisma Schema for PostgreSQL

Update `prisma/schema.prisma` to switch the provider:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // For local dev: DATABASE_URL="postgres://user:pass@localhost:5432/adblock"
  // For production: set via wrangler secret put DATABASE_URL
}
```

### 5. Use Hyperdrive in the Worker

```typescript
// worker/worker.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

export interface Env {
    HYPERDRIVE: Hyperdrive;
    DB: D1Database;          // keep for edge caching
    FILTER_STORAGE: R2Bucket; // keep for blob storage
}

function createPrisma(env: Env): PrismaClient {
    // Use Hyperdrive connection string — it handles pooling + caching
    const sql = neon(env.HYPERDRIVE.connectionString);
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({ adapter });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const prisma = createPrisma(env);
        // ... use prisma for relational queries
        // ... use env.DB for fast edge caching
        // ... use env.FILTER_STORAGE for blob reads
    },
};
```

### 6. Configure Hyperdrive Caching

In the Cloudflare dashboard or via API, configure Hyperdrive to cache appropriate queries:

```bash
# Enable caching on the Hyperdrive config
wrangler hyperdrive update <HYPERDRIVE_ID> \
  --caching-disabled=false \
  --max-age=60 \  # Cache SELECT results for 60 seconds
  --stale-while-revalidate=15
```

**What to cache vs. skip:**

| Query type | Cache? | Reason |
|-----------|--------|--------|
| `SELECT` filter list metadata | ✅ Yes (60s TTL) | Rarely changes |
| `SELECT` compiled output by hash | ✅ Yes (300s TTL) | Immutable by hash |
| `SELECT` user/api_key lookup | ✅ Yes (30s TTL) | Low churn |
| `INSERT/UPDATE` compilation events | ❌ No | Writes bypass cache |
| `SELECT` health snapshots | ✅ Yes (30s TTL) | Dashboard data |

---

## Migration Plan

### Phase 1 — Set Up Infrastructure (Week 1)

- [ ] Create Neon project and database
- [ ] Configure development and production branches in Neon
- [ ] Update Hyperdrive config with Neon connection string
- [ ] Set `DATABASE_URL` secret in Cloudflare: `wrangler secret put DATABASE_URL`
- [ ] Update `wrangler.toml` with the correct Hyperdrive ID

### Phase 2 — PostgreSQL Schema (Week 1–2)

- [ ] Update `prisma/schema.prisma` provider to `postgresql`
- [ ] Add new models: `users`, `api_keys`, `sessions`, `filter_sources`, `filter_list_versions`, `compiled_outputs`, `compilation_events`
- [ ] Run `npx prisma migrate dev --name init_postgresql`
- [ ] Apply migration to Neon dev branch: `npx prisma migrate deploy`
- [ ] Update `.env.development` with Neon dev branch connection string

### Phase 3 — Update Storage Adapters (Week 2–3)

- [ ] Create `src/storage/NeonStorageAdapter.ts` implementing `IStorageAdapter` via Prisma + Neon adapter
- [ ] Update `PrismaStorageAdapter` to support both SQLite (local dev) and PostgreSQL (staging/prod) via environment variable
- [ ] Update Worker entry point to use `createPrisma(env)` with Hyperdrive connection string
- [ ] Add `StorageAdapterType = 'neon'` alongside existing `'prisma' | 'd1' | 'memory'`

### Phase 4 — Authentication (Week 3–4)

- [ ] Implement `src/services/AuthService.ts` — API key creation, validation, hashing (SHA-256)
- [ ] Add middleware to Worker router: `validateApiKey(request, env)` 
- [ ] Expose `POST /api/auth/keys` — create API key (returns raw key once)
- [ ] Expose `DELETE /api/auth/keys/:id` — revoke API key
- [ ] Wire `user_id` into compilation event tracking

### Phase 5 — Data Migration (Week 4–5)

- [ ] Export existing D1 data to JSON using `wrangler d1 export`
- [ ] Write migration script to import into Neon PostgreSQL
- [ ] Validate data integrity after import
- [ ] Run both backends in parallel for one week (D1 as L1 cache, Neon as source of truth)

### Phase 6 — Cutover (Week 5–6)

- [ ] Switch primary storage reads/writes to Neon
- [ ] Keep D1 as L1 hot cache (TTL: 60–300 seconds)
- [ ] Keep R2 for blob storage
- [ ] Monitor latency via Cloudflare Analytics + Neon metrics dashboard
- [ ] Remove D1 as primary storage after 1-week validation period

---

## Proposed PostgreSQL Schema

Below is a consolidated SQL schema (compatible with Neon PostgreSQL) combining all proposed tables. Use with `prisma migrate` or apply directly.

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Authentication
-- ============================================================

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'readonly')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash             TEXT UNIQUE NOT NULL,
    key_prefix           TEXT NOT NULL,
    name                 TEXT NOT NULL,
    scopes               TEXT[] NOT NULL DEFAULT '{"compile"}',
    rate_limit_per_minute INT NOT NULL DEFAULT 60,
    last_used_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    revoked_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT UNIQUE NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id    ON sessions(user_id);

-- ============================================================
-- Filter Sources
-- ============================================================

CREATE TABLE filter_sources (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url                     TEXT UNIQUE NOT NULL,
    name                    TEXT NOT NULL,
    description             TEXT,
    homepage                TEXT,
    license                 TEXT,
    is_public               BOOLEAN NOT NULL DEFAULT TRUE,
    owner_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    refresh_interval_seconds INT NOT NULL DEFAULT 3600,
    last_checked_at         TIMESTAMPTZ,
    last_success_at         TIMESTAMPTZ,
    last_failure_at         TIMESTAMPTZ,
    consecutive_failures    INT NOT NULL DEFAULT 0,
    status                  TEXT NOT NULL DEFAULT 'unknown'
                                CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_filter_sources_status ON filter_sources(status);
CREATE INDEX idx_filter_sources_url    ON filter_sources(url);

CREATE TABLE filter_list_versions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id    UUID NOT NULL REFERENCES filter_sources(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    rule_count   INT NOT NULL,
    etag         TEXT,
    r2_key       TEXT NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ,
    is_current   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_filter_list_versions_current
    ON filter_list_versions(source_id) WHERE is_current = TRUE;
CREATE INDEX idx_filter_list_versions_source ON filter_list_versions(source_id);
CREATE INDEX idx_filter_list_versions_hash   ON filter_list_versions(content_hash);

-- ============================================================
-- Compiled Outputs
-- ============================================================

CREATE TABLE compiled_outputs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_hash     TEXT UNIQUE NOT NULL,
    config_name     TEXT NOT NULL,
    config_snapshot JSONB NOT NULL,
    rule_count      INT NOT NULL,
    source_count    INT NOT NULL,
    duration_ms     INT NOT NULL,
    r2_key          TEXT NOT NULL,
    owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_compiled_outputs_config_name ON compiled_outputs(config_name);
CREATE INDEX idx_compiled_outputs_created_at  ON compiled_outputs(created_at DESC);
CREATE INDEX idx_compiled_outputs_owner       ON compiled_outputs(owner_user_id);

-- ============================================================
-- Compilation Events (append-only telemetry)
-- ============================================================

CREATE TABLE compilation_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    compiled_output_id  UUID REFERENCES compiled_outputs(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    api_key_id          UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    request_source      TEXT NOT NULL CHECK (request_source IN ('worker', 'cli', 'batch_api', 'workflow')),
    worker_region       TEXT,
    duration_ms         INT NOT NULL,
    cache_hit           BOOLEAN NOT NULL DEFAULT FALSE,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compilation_events_created_at ON compilation_events(created_at DESC);
CREATE INDEX idx_compilation_events_user_id    ON compilation_events(user_id);

-- ============================================================
-- Source Health Tracking
-- ============================================================

CREATE TABLE source_health_snapshots (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id            UUID NOT NULL REFERENCES filter_sources(id) ON DELETE CASCADE,
    status               TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    total_attempts       INT NOT NULL DEFAULT 0,
    successful_attempts  INT NOT NULL DEFAULT 0,
    failed_attempts      INT NOT NULL DEFAULT 0,
    consecutive_failures INT NOT NULL DEFAULT 0,
    avg_duration_ms      FLOAT NOT NULL DEFAULT 0,
    avg_rule_count       FLOAT NOT NULL DEFAULT 0,
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_health_source_id   ON source_health_snapshots(source_id);
CREATE INDEX idx_source_health_recorded_at ON source_health_snapshots(recorded_at DESC);

CREATE TABLE source_change_events (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id             UUID NOT NULL REFERENCES filter_sources(id) ON DELETE CASCADE,
    previous_version_id   UUID REFERENCES filter_list_versions(id) ON DELETE SET NULL,
    new_version_id        UUID NOT NULL REFERENCES filter_list_versions(id) ON DELETE CASCADE,
    rule_count_delta      INT NOT NULL DEFAULT 0,
    content_hash_changed  BOOLEAN NOT NULL DEFAULT TRUE,
    detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_change_source_id   ON source_change_events(source_id);
CREATE INDEX idx_source_change_detected_at ON source_change_events(detected_at DESC);
```

---

## References

- [Neon Serverless PostgreSQL](https://neon.tech/docs)
- [Neon + Cloudflare Workers](https://neon.tech/docs/guides/cloudflare-workers)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Hyperdrive + Neon Guide](https://developers.cloudflare.com/hyperdrive/examples/neon/)
- [PlanetScale Documentation](https://planetscale.com/docs)
- [PlanetScale + Cloudflare Workers](https://planetscale.com/docs/tutorials/connect-cloudflare-workers)
- [Prisma Driver Adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [Prisma Neon Adapter](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Current Storage Implementation](../src/storage/README.md)
- [Prisma Evaluation](PRISMA_EVALUATION.md)
- [Cloudflare D1 Integration Guide](CLOUDFLARE_D1.md)
