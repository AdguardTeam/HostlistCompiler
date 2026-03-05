# Database Architecture

> Visual reference for the multi-tier storage architecture introduced in Phase 1 of the PlanetScale PostgreSQL + Cloudflare Hyperdrive integration.

## Table of Contents

- [Storage Tier Overview](#storage-tier-overview)
- [Request Data Flow](#request-data-flow)
- [Write Path](#write-path)
- [Authentication Flow](#authentication-flow)
- [D1 → PostgreSQL Migration Flow](#d1--postgresql-migration-flow)
- [Local vs Production Connection Routing](#local-vs-production-connection-routing)
- [Schema Relationships](#schema-relationships)

---

## Storage Tier Overview

The system uses four storage tiers arranged by access latency and role:

```mermaid
flowchart TB
    subgraph "Cloudflare Worker"
        W[Worker Request Handler]
    end

    subgraph "L0 · KV — Hot Cache (1–5 ms)"
        KV_CACHE[(COMPILATION_CACHE)]
        KV_METRICS[(METRICS)]
        KV_RATE[(RATE_LIMIT)]
    end

    subgraph "L1 · D1 — Edge SQLite (1–10 ms)"
        D1[(D1 SQLite\nstructured cache)]
    end

    subgraph "L2 · Hyperdrive → PlanetScale PostgreSQL (20–80 ms)"
        HD[Hyperdrive\nconnection pool]
        PG[(PlanetScale\nPostgreSQL\nsource of truth)]
        HD --> PG
    end

    subgraph "Blob · R2 (5–50 ms)"
        R2[(FILTER_STORAGE\ncompiled outputs\n& raw content)]
    end

    W -->|cache lookup| KV_CACHE
    W -->|structured cache| D1
    W -->|relational queries| HD
    W -->|large blobs| R2

    style KV_CACHE fill:#fff9c4,stroke:#fbc02d
    style KV_METRICS fill:#fff9c4,stroke:#fbc02d
    style KV_RATE fill:#fff9c4,stroke:#fbc02d
    style D1 fill:#c8e6c9,stroke:#388e3c
    style HD fill:#e1f5ff,stroke:#0288d1
    style PG fill:#e1f5ff,stroke:#0288d1
    style R2 fill:#f3e5f5,stroke:#7b1fa2
```

| Tier | Binding | Technology | Role |
|------|---------|-----------|------|
| **L0** | `COMPILATION_CACHE`, `METRICS`, `RATE_LIMIT` | Cloudflare KV | Hot-path key-value cache |
| **L1** | `DB` | Cloudflare D1 (SQLite) | Edge read cache for structured lookups |
| **L2** | `HYPERDRIVE` | Hyperdrive → PlanetScale PostgreSQL | Primary relational store (source of truth) |
| **Blob** | `FILTER_STORAGE` | Cloudflare R2 | Large compiled outputs, raw filter content |

---

## Request Data Flow

End-to-end path for a compilation request, showing which tier is consulted at each step:

```mermaid
flowchart TD
    REQ([Incoming Request]) --> AUTH{Authenticated?}
    AUTH -->|No| REJECT([401 Unauthorized])
    AUTH -->|Yes| KV_CHECK{L0 KV\ncache hit?}

    KV_CHECK -->|Hit| RETURN_KV([Return cached result\n~1–5 ms])

    KV_CHECK -->|Miss| D1_CHECK{L1 D1\ncache hit?}

    D1_CHECK -->|Hit| RETURN_D1([Return result\npopulate L0 KV\n~1–10 ms])

    D1_CHECK -->|Miss| PG_META[L2: Query PlanetScale\nfor filter metadata]
    PG_META --> R2_READ[Blob: Read compiled\noutput from R2]
    R2_READ --> COMPILE{Needs\nrecompile?}

    COMPILE -->|No| SERVE_CACHED[Serve existing\ncompiled output]
    COMPILE -->|Yes| DO_COMPILE[Run compilation\npipeline]

    DO_COMPILE --> R2_WRITE[Blob: Write new\ncompiled output to R2]
    R2_WRITE --> PG_WRITE[L2: Write metadata\n+ CompilationEvent to PG]
    PG_WRITE --> D1_WRITE[L1: Update D1\ncache entry]
    D1_WRITE --> KV_WRITE[L0: Store result\nin KV cache]
    KV_WRITE --> RESPOND([Return response])

    SERVE_CACHED --> KV_WRITE

    style RETURN_KV fill:#fff9c4,stroke:#fbc02d
    style RETURN_D1 fill:#c8e6c9,stroke:#388e3c
    style PG_META fill:#e1f5ff,stroke:#0288d1
    style PG_WRITE fill:#e1f5ff,stroke:#0288d1
    style R2_READ fill:#f3e5f5,stroke:#7b1fa2
    style R2_WRITE fill:#f3e5f5,stroke:#7b1fa2
    style REJECT fill:#ffcdd2,stroke:#d32f2f
```

---

## Write Path

How writes propagate through the storage tiers to ensure consistency:

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker
    participant PG as L2 PostgreSQL
    participant R2 as Blob R2
    participant D1 as L1 D1
    participant KV as L0 KV

    C->>W: POST /compile (with filter sources)
    W->>PG: Read FilterSource + latest version metadata
    PG-->>W: metadata, r2_key
    W->>R2: GET compiled blob (r2_key)
    R2-->>W: compiled content

    Note over W: Run transformation pipeline if stale

    W->>R2: PUT new compiled blob → new r2_key
    W->>PG: INSERT CompiledOutput (r2_key, checksum, size)
    W->>PG: INSERT CompilationEvent (duration, rule counts)
    W->>D1: UPSERT cache entry (TTL 60–300s)
    W->>KV: SET cached result (TTL 60s)
    W-->>C: 200 OK (compiled filter list)
```

---

## Authentication Flow

API key authentication with PostgreSQL as the authority:

```mermaid
flowchart TD
    REQ([Request with\nBearer token]) --> EXTRACT[Extract token\nfrom Authorization header]
    EXTRACT --> HASH[SHA-256 hash\nthe raw token]
    HASH --> PG_LOOKUP[L2: SELECT api_keys\nWHERE key_hash = $1]

    PG_LOOKUP --> FOUND{Key found?}
    FOUND -->|No| FALLBACK{Static\nADMIN_KEY\nmatch?}
    FALLBACK -->|No| REJECT([401 Unauthorized])
    FALLBACK -->|Yes| ADMIN_OK([Proceed as admin])

    FOUND -->|Yes| ACTIVE{is_active\n= true?}
    ACTIVE -->|No| REJECT
    ACTIVE -->|Yes| EXPIRY{expires_at\ncheck}
    EXPIRY -->|Expired| REJECT
    EXPIRY -->|Valid| SCOPE[Validate request\nscope vs key scopes]
    SCOPE -->|Insufficient| REJECT403([403 Forbidden])
    SCOPE -->|OK| UPDATE_USED[Fire-and-forget:\nUPDATE last_used_at]
    UPDATE_USED --> PROCEED([Proceed with request])

    style REJECT fill:#ffcdd2,stroke:#d32f2f
    style REJECT403 fill:#ffcdd2,stroke:#d32f2f
    style PROCEED fill:#c8e6c9,stroke:#388e3c
    style ADMIN_OK fill:#c8e6c9,stroke:#388e3c
```

---

## D1 → PostgreSQL Migration Flow

One-time migration from the legacy D1 SQLite store to PlanetScale PostgreSQL:

```mermaid
flowchart TD
    START([POST /admin/migrate/d1-to-pg]) --> DRY{?dryRun\n= true?}

    DRY -->|Yes| COUNT[Query D1 row counts\nper table]
    COUNT --> DRY_RESP([Return counts\nno writes])

    DRY -->|No| TABLES[Resolve tables to migrate\nstorage_entries, filter_cache,\ncompilation_metadata]
    TABLES --> BATCH_LOOP[For each table:\nfetch 100 rows at a time]

    BATCH_LOOP --> READ_D1[Read batch from D1]
    READ_D1 --> INSERT_PG[INSERT INTO pg\nON CONFLICT DO NOTHING]
    INSERT_PG --> MORE{More rows?}
    MORE -->|Yes| READ_D1
    MORE -->|No| NEXT_TABLE{More tables?}
    NEXT_TABLE -->|Yes| BATCH_LOOP
    NEXT_TABLE -->|No| DONE([Return migration summary\nrows migrated per table])

    style DRY_RESP fill:#fff9c4,stroke:#fbc02d
    style DONE fill:#c8e6c9,stroke:#388e3c
```

> **Idempotent**: `ON CONFLICT DO NOTHING` means the migration can be run multiple times safely — only missing rows are inserted.

---

## Local vs Production Connection Routing

How the worker resolves its database connection string depending on the environment:

```mermaid
flowchart LR
    subgraph "Production (Cloudflare Workers)"
        PROD_W[Worker] -->|env.HYPERDRIVE\n.connectionString| HD_PROD[Hyperdrive\nconnection pool]
        HD_PROD --> PS[(PlanetScale\nPostgreSQL)]
    end

    subgraph "Local Dev (wrangler dev)"
        LOCAL_W[Worker] -->|WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE\nfrom .env.local| LOCAL_PG[(Local PostgreSQL\nDocker / native)]
    end

    subgraph "Prisma CLI (migrations)"
        PRISMA[npx prisma migrate] -->|DIRECT_DATABASE_URL\nor DATABASE_URL\nfrom .env.local| LOCAL_PG
    end

    style HD_PROD fill:#e1f5ff,stroke:#0288d1
    style PS fill:#e1f5ff,stroke:#0288d1
    style LOCAL_PG fill:#c8e6c9,stroke:#388e3c
```

> Set credentials in `.env.local` (gitignored). See [`.env.example`](../../.env.example) and [local-dev.md](./local-dev.md).

---

## Schema Relationships

Core PostgreSQL model relationships:

```mermaid
erDiagram
    User {
        uuid id PK
        string username
        string email
        boolean is_active
        timestamp created_at
    }

    ApiKey {
        uuid id PK
        uuid user_id FK
        string key_hash
        string[] scopes
        boolean is_active
        timestamp expires_at
        timestamp last_used_at
    }

    Session {
        uuid id PK
        uuid user_id FK
        string token_hash
        timestamp expires_at
    }

    FilterSource {
        uuid id PK
        string name
        string url
        string format
        boolean is_enabled
    }

    FilterListVersion {
        uuid id PK
        uuid source_id FK
        string content_hash
        boolean is_current
        timestamp fetched_at
    }

    CompiledOutput {
        uuid id PK
        uuid source_id FK
        string r2_key
        string checksum
        integer rule_count
        timestamp compiled_at
    }

    CompilationEvent {
        uuid id PK
        uuid output_id FK
        integer duration_ms
        integer rules_in
        integer rules_out
        timestamp created_at
    }

    SourceHealthSnapshot {
        uuid id PK
        uuid source_id FK
        string status
        integer latency_ms
        timestamp checked_at
    }

    SourceChangeEvent {
        uuid id PK
        uuid source_id FK
        string change_type
        string details
        timestamp detected_at
    }

    User ||--o{ ApiKey : "owns"
    User ||--o{ Session : "has"
    FilterSource ||--o{ FilterListVersion : "has versions"
    FilterSource ||--o{ CompiledOutput : "compiled as"
    FilterSource ||--o{ SourceHealthSnapshot : "monitored by"
    FilterSource ||--o{ SourceChangeEvent : "changes tracked by"
    CompiledOutput ||--o{ CompilationEvent : "recorded in"
```

---

## References

- [plan.md](./plan.md) — Database architecture plan and migration phases
- [local-dev.md](./local-dev.md) — Local PostgreSQL setup guide
- [postgres-modern.md](./postgres-modern.md) — PostgreSQL best practices
- [quickstart.sh](./quickstart.sh) — Automated local Docker bootstrap
- [WORKFLOW_DIAGRAMS.md](../WORKFLOW_DIAGRAMS.md) — Compilation and queue workflow diagrams
