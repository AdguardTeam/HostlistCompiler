# Prisma Storage Backend

This directory contains the Prisma ORM configuration for the storage backend.

## Overview

The Prisma storage adapter is the default storage backend for the adblock-compiler, providing flexible database support for scenarios requiring:

- Cross-runtime compatibility (Node.js, Deno, Bun)
- Multi-instance deployments with shared database
- SQL database features (transactions, complex queries)
- Enterprise database requirements

## Supported Databases

Prisma supports the following databases:

### Relational Databases (SQL)

| Database        | Provider      | Connection String Example                                           |
| --------------- | ------------- | ------------------------------------------------------------------- |
| **PostgreSQL**  | `postgresql`  | `postgresql://user:pass@localhost:5432/adblock`                     |
| **MySQL**       | `mysql`       | `mysql://user:pass@localhost:3306/adblock`                          |
| **MariaDB**     | `mysql`       | `mysql://user:pass@localhost:3306/adblock`                          |
| **SQLite**      | `sqlite`      | `file:./dev.db`                                                     |
| **SQL Server**  | `sqlserver`   | `sqlserver://localhost:1433;database=adblock;user=SA;password=pass` |
| **CockroachDB** | `cockroachdb` | `postgresql://user:pass@localhost:26257/adblock`                    |

### NoSQL Databases

| Database    | Provider  | Connection String Example           |
| ----------- | --------- | ----------------------------------- |
| **MongoDB** | `mongodb` | `mongodb://localhost:27017/adblock` |

### Cloud Database Services

| Service           | Notes                                       |
| ----------------- | ------------------------------------------- |
| **Supabase**      | PostgreSQL-based, use `postgresql` provider |
| **PlanetScale**   | MySQL-compatible, use `mysql` provider      |
| **Turso**         | SQLite edge database                        |
| **Cloudflare D1** | SQLite at the edge                          |
| **Neon**          | Serverless PostgreSQL                       |
| **Railway**       | PostgreSQL/MySQL hosting                    |
| **Render**        | PostgreSQL hosting                          |

## Quick Start

### 1. Install Dependencies

```bash
# Using npm
npm install @prisma/client
npm install -D prisma

# Using Deno
# Add to import map or use npm specifier
```

### 2. Configure Database

Create a `.env` file in the project root:

```env
# SQLite (default, local development)
DATABASE_URL="file:./data/adblock.db"

# PostgreSQL (production)
# DATABASE_URL="postgresql://user:password@localhost:5432/adblock?schema=public"

# MySQL
# DATABASE_URL="mysql://user:password@localhost:3306/adblock"

# SQL Server
# DATABASE_URL="sqlserver://localhost:1433;database=adblock;user=SA;password=YourPassword123"

# MongoDB
# DATABASE_URL="mongodb://localhost:27017/adblock"
```

### 3. Update Schema Provider (if not using SQLite)

Edit `prisma/schema.prisma` and change the provider:

```prisma
datasource db {
  provider = "postgresql"  // or "mysql", "sqlserver", "mongodb"
  url      = env("DATABASE_URL")
}
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Create Database Tables

```bash
# Development (creates tables, may reset data)
npx prisma db push

# Production (with migrations)
npx prisma migrate dev --name init
npx prisma migrate deploy
```

### 6. Use in Code

```typescript
import { PrismaStorageAdapter } from './src/storage/PrismaStorageAdapter.ts';
import { logger } from './src/utils/logger.ts';

const storage = new PrismaStorageAdapter(logger, {
    type: 'prisma',
    connectionString: process.env.DATABASE_URL,
});

await storage.open();

// Use the storage API
await storage.cacheFilterList(
    'https://example.com/filters.txt',
    ['||ad.example.com^'],
    'hash123',
);

await storage.close();
```

## Schema Overview

The Prisma schema defines the following models:

### StorageEntry

Generic key-value storage with metadata:

```prisma
model StorageEntry {
  id        String   @id @default(cuid())
  key       String   @unique  // Serialized key path
  data      String            // JSON-serialized data
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expiresAt DateTime?
  tags      String?           // JSON array
}
```

### FilterCache

Dedicated table for filter list caching:

```prisma
model FilterCache {
  id        String   @id @default(cuid())
  source    String   @unique  // Source URL
  content   String            // JSON array of rules
  hash      String
  etag      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expiresAt DateTime?
}
```

### CompilationMetadata

Build history tracking:

```prisma
model CompilationMetadata {
  id          String   @id @default(cuid())
  configName  String
  timestamp   DateTime @default(now())
  sourceCount Int
  ruleCount   Int
  duration    Int      // Milliseconds
  outputPath  String?
}
```

### SourceSnapshot

Change detection snapshots:

```prisma
model SourceSnapshot {
  id          String   @id @default(cuid())
  source      String
  timestamp   DateTime @default(now())
  contentHash String
  ruleCount   Int
  ruleSample  String?  // JSON array
  etag        String?
  isCurrent   Boolean  @default(true)
}
```

### SourceHealth

Reliability metrics:

```prisma
model SourceHealth {
  id                  String   @id @default(cuid())
  source              String   @unique
  status              String   // healthy, degraded, unhealthy, unknown
  totalAttempts       Int      @default(0)
  successfulAttempts  Int      @default(0)
  failedAttempts      Int      @default(0)
  consecutiveFailures Int      @default(0)
  averageDuration     Float    @default(0)
  averageRuleCount    Float    @default(0)
  lastAttemptAt       DateTime?
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?
  recentAttempts      String?  // JSON array
  updatedAt           DateTime @updatedAt
}
```

### SourceAttempt

Individual fetch attempt records:

```prisma
model SourceAttempt {
  id        String   @id @default(cuid())
  source    String
  timestamp DateTime @default(now())
  success   Boolean
  duration  Int      // Milliseconds
  error     String?
  ruleCount Int?
  etag      String?
}
```

## Database-Specific Configuration

### PostgreSQL

```env
DATABASE_URL="postgresql://username:password@localhost:5432/adblock?schema=public"
```

Features: Full support, recommended for production.

### MySQL / MariaDB

```env
DATABASE_URL="mysql://username:password@localhost:3306/adblock"
```

Note: Use `@db.Text` for large content fields if needed.

### SQLite

```env
DATABASE_URL="file:./data/adblock.db"
```

Best for: Local development, single-instance deployments, embedded use.

### SQL Server

```env
DATABASE_URL="sqlserver://localhost:1433;database=adblock;user=SA;password=YourPassword123;trustServerCertificate=true"
```

Note: Requires SQL Server 2017 or later.

### MongoDB

```env
DATABASE_URL="mongodb://localhost:27017/adblock"
```

Schema changes for MongoDB:

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model StorageEntry {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  // ... rest of fields
}
```

## Commands Reference

### Development

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Push schema to database (development only)
npx prisma db push

# Create a migration
npx prisma migrate dev --name description

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio
```

### Production

```bash
# Deploy migrations
npx prisma migrate deploy

# Generate client (usually in build step)
npx prisma generate
```

### Introspection

```bash
# Generate schema from existing database
npx prisma db pull

# Validate schema
npx prisma validate

# Format schema file
npx prisma format
```

## Switching Between Backends

Use the `IStorageAdapter` interface for backend-agnostic code:

```typescript
import type { IStorageAdapter } from './src/storage/IStorageAdapter.ts';
import { PrismaStorageAdapter } from './src/storage/PrismaStorageAdapter.ts';
import { D1StorageAdapter } from './src/storage/D1StorageAdapter.ts';

function createStorage(type: 'prisma' | 'd1', env?: { DB: D1Database }): IStorageAdapter {
    if (type === 'd1') {
        return new D1StorageAdapter(env!.DB);
    }
    return new PrismaStorageAdapter(logger, { type: 'prisma' });
}

const storage = createStorage(process.env.STORAGE_TYPE || 'prisma');
await storage.open();
```

## Troubleshooting

### Common Issues

**"Cannot find module '@prisma/client'"**

Run `npx prisma generate` after installing dependencies.

**"The table does not exist"**

Run `npx prisma db push` or `npx prisma migrate deploy`.

**"Unique constraint failed"**

The key already exists. Use upsert operations (handled by adapter).

**MongoDB: "Invalid ObjectId"**

Ensure MongoDB-specific schema changes are applied.

**Connection refused**

Check database server is running and connection string is correct.

### Debug Mode

Enable Prisma query logging:

```typescript
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});
```

### Performance Tips

1. **Use indexes** - Schema includes indexes on frequently queried fields
2. **Batch operations** - Group related operations when possible
3. **Connection pooling** - Prisma handles this automatically
4. **TTL cleanup** - Enable `autoCleanup` in adapter config

## Security Considerations

- **Never commit `.env` files** with database credentials
- **Use connection pooling** in production (PgBouncer, ProxySQL)
- **Enable SSL/TLS** for remote database connections
- **Limit database permissions** to required operations only
- **Rotate credentials** regularly

## License

Part of the adblock-compiler project.
