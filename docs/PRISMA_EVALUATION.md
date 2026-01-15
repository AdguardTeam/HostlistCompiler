# Prisma ORM Evaluation for Storage Classes

## Overview

This document evaluates the storage backend options for the adblock-compiler project. Prisma ORM with SQLite is now the default storage backend.

## Prisma Supported Databases

Prisma is a next-generation ORM for Node.js and TypeScript that supports the following databases:

### Relational Databases (SQL)

| Database        | Status       | Notes                                 |
| --------------- | ------------ | ------------------------------------- |
| **PostgreSQL**  | Full Support | Primary recommendation for production |
| **MySQL**       | Full Support | Including MySQL 5.7+                  |
| **MariaDB**     | Full Support | MySQL-compatible                      |
| **SQLite**      | Full Support | Great for local development/embedded  |
| **SQL Server**  | Full Support | Microsoft SQL Server 2017+            |
| **CockroachDB** | Full Support | Distributed SQL database              |

### NoSQL Databases

| Database    | Status       | Notes                                   |
| ----------- | ------------ | --------------------------------------- |
| **MongoDB** | Full Support | Special connector with some limitations |

### Cloud Database Integrations

| Provider          | Status    | Notes                 |
| ----------------- | --------- | --------------------- |
| **Supabase**      | Supported | PostgreSQL-based      |
| **PlanetScale**   | Supported | MySQL-compatible      |
| **Turso**         | Supported | SQLite edge database  |
| **Cloudflare D1** | Supported | SQLite at the edge    |
| **Neon**          | Supported | Serverless PostgreSQL |

### Upcoming Features (2025)

- PostgreSQL extensions support (PGVector, Full-Text Search via ParadeDB)
- Prisma 7 major release with modernized foundations

## Current Implementation Analysis

### Current Architecture: Prisma with SQLite

The project uses **Prisma ORM with SQLite** as the default storage backend:

```
PrismaStorageAdapter (SQLite/PostgreSQL/MySQL)
├── CachingDownloader
│   ├── ChangeDetector
│   └── SourceHealthMonitor
└── IncrementalCompiler (MemoryCacheStorage)
```

**Key Characteristics:**

- Flexible database support (SQLite default, PostgreSQL, MySQL, etc.)
- Cross-runtime compatibility (Node.js, Deno, Bun)
- Hierarchical keys: `['cache', 'filters', source]`
- Application-level TTL support
- Type-safe generic operations

### Storage Classes Summary

| Class                   | Purpose                  | Complexity |
| ----------------------- | ------------------------ | ---------- |
| `PrismaStorageAdapter`  | Core KV operations       | Low        |
| `D1StorageAdapter`      | Cloudflare edge storage  | Low        |
| `CachingDownloader`     | Smart download caching   | Medium     |
| `ChangeDetector`        | Track filter changes     | Low        |
| `SourceHealthMonitor`   | Track source reliability | Low        |
| `IncrementalCompiler`   | Compilation caching      | Medium     |

## Comparison: Prisma SQLite vs Other Options

### Feature Comparison

| Feature               | Prisma/SQLite     | Prisma/PostgreSQL | Cloudflare D1     |
| --------------------- | ----------------- | ----------------- | ----------------- |
| **Schema Definition** | Prisma Schema     | Prisma Schema     | SQL               |
| **Type Safety**       | Generated types   | Generated types   | Manual            |
| **Queries**           | Rich query API    | Rich query API    | Raw SQL           |
| **Relations**         | First-class       | First-class       | Manual            |
| **Migrations**        | Built-in          | Built-in          | Manual            |
| **TTL Support**       | Application-level | Application-level | Application-level |
| **Transactions**      | Full ACID         | Full ACID         | Limited           |
| **Tooling**           | Prisma Studio     | Prisma Studio     | Wrangler CLI      |
| **Runtime**           | All               | All               | Workers only      |
| **Infrastructure**    | None (embedded)   | Server required   | Edge              |

### Pros and Cons

#### Prisma with SQLite (Default)

**Pros:**

- Zero infrastructure overhead
- Cross-runtime compatibility (Node.js, Deno, Bun)
- Simple API for KV operations
- Works offline/locally
- Type-safe with generated client
- Built-in migrations and schema management
- Excellent tooling (Prisma Studio, CLI)
- Fast for simple operations

**Cons:**

- Single-instance only (no shared database)
- TTL must be implemented in application code
- Not suitable for multi-server deployments

#### Prisma with PostgreSQL

**Pros:**

- Multi-instance support
- Full ACID transactions
- Rich query capabilities
- Production-ready for scaled deployments
- Same API as SQLite

**Cons:**

- Requires database server
- Additional infrastructure overhead
- More complex setup

#### Cloudflare D1

**Pros:**

- Edge-first architecture
- Low latency globally
- Serverless pricing model
- No infrastructure management

**Cons:**

- Cloudflare Workers only
- Limited query capabilities
- Different API from Prisma adapters

## Use Case Analysis

### Current Use Cases

| Use Case            | Data Pattern        | Complexity | SQLite Fit | PostgreSQL Fit | D1 Fit |
| ------------------- | ------------------- | ---------- | ---------- | -------------- | ------ |
| Filter list caching | Simple KV with TTL  | Low        | Excellent  | Excellent      | Good   |
| Health monitoring   | Append-only metrics | Low        | Good       | Better         | Good   |
| Change detection    | Snapshot comparison | Low        | Good       | Good           | Good   |
| Compilation history | Time-series queries | Medium     | Good       | Better         | Good   |

### When to Use PostgreSQL

PostgreSQL is beneficial if:

1. **Multi-instance deployment** - Shared database across servers/workers
2. **Complex queries required** - Filtering, aggregation, joins
3. **Data relationships** - Related entities need referential integrity
4. **Audit/compliance needs** - Full transaction logs, ACID guarantees
5. **High concurrency** - Multiple writers accessing the same data

### When to Use SQLite (Default)

SQLite remains the best choice when:

1. **Single-instance deployment** - One server or local development
2. **Simplicity is paramount** - No external infrastructure needed
3. **Local/offline use** - Application runs standalone
4. **Minimal maintenance** - No database server to manage

### When to Use Cloudflare D1

D1 is the best choice when:

1. **Edge deployment** - Running on Cloudflare Workers
2. **Global distribution** - Need low latency worldwide
3. **Serverless** - No infrastructure management desired

## Recommendation

### Summary

**Prisma with SQLite is the default choice for simplicity and zero infrastructure.**

The existing storage patterns (caching, health monitoring, change detection) are well-suited to the Prisma adapter pattern. SQLite provides a simple embedded database that requires no external infrastructure.

### Architecture

The project uses a flexible adapter pattern:

```
┌─────────────────────────────────────────────────────┐
│                  IStorageAdapter                     │
├─────────────────────────────────────────────────────┤
│  + set<T>(key, value, ttl?)                         │
│  + get<T>(key): StorageEntry<T>                     │
│  + delete(key)                                       │
│  + list<T>(options): StorageEntry<T>[]              │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌──────────┐ ┌─────────────┐
│ Prisma  │ │    D1    │ │ InMemory    │
│ Storage │ │ Storage  │ │ Storage     │
└─────────┘ └──────────┘ └─────────────┘
```

This allows switching storage backends based on deployment environment without changing application code.

### Implementation Status

The project includes:

1. **`IStorageAdapter`** - Abstract interface for storage backends
2. **`PrismaStorageAdapter`** - Default implementation (SQLite/PostgreSQL/MySQL)
3. **`D1StorageAdapter`** - Cloudflare edge deployment
4. **`prisma/schema.prisma`** - Prisma schema (for SQLite/PostgreSQL/MongoDB)

## Conclusion

| Aspect                 | Recommendation                            |
| ---------------------- | ----------------------------------------- |
| **Default Usage**      | Prisma with SQLite                        |
| **Multi-instance**     | Prisma with PostgreSQL                    |
| **Edge Deployment**    | Cloudflare D1                             |
| **MongoDB**            | Prisma with MongoDB connector             |

The storage abstraction layer enables switching backends based on deployment requirements without affecting the application code.

## References

- [Prisma Supported Databases](https://www.prisma.io/docs/orm/reference/supported-databases)
- [Prisma Database Features Matrix](https://www.prisma.io/docs/orm/reference/database-features)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Prisma MongoDB Connector](https://www.prisma.io/docs/orm/overview/databases/mongodb)
