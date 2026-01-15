# Cloudflare D1 Integration Guide

Complete guide for using Prisma with Cloudflare D1 in the adblock-compiler project.

## Overview

Cloudflare D1 is a serverless SQLite database that runs at the edge, offering:

- **Global distribution** - Data replicated across Cloudflare's edge network
- **SQLite compatibility** - Familiar SQL syntax and tooling
- **Serverless** - No infrastructure management
- **Low latency** - Edge-first architecture
- **Cost effective** - Pay-per-use pricing model

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js 18+ or Deno

## Quick Start

### 1. Install Dependencies

```bash
npm install @prisma/client @prisma/adapter-d1
npm install -D prisma wrangler
```

### 2. Create D1 Database

```bash
# Login to Cloudflare
wrangler login

# Create a new D1 database
wrangler d1 create adblock-storage

# Note the database_id from the output
```

### 3. Configure wrangler.toml

Create or update `wrangler.toml` in your project root:

```toml
name = "adblock-compiler"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "adblock-storage"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Create D1 Prisma Schema

Create `prisma/schema.d1.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model StorageEntry {
  id        String   @id @default(cuid())
  key       String   @unique
  data      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expiresAt DateTime?
  tags      String?

  @@index([key])
  @@index([expiresAt])
  @@map("storage_entries")
}

model FilterCache {
  id        String   @id @default(cuid())
  source    String   @unique
  content   String
  hash      String
  etag      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expiresAt DateTime?

  @@index([source])
  @@index([expiresAt])
  @@map("filter_cache")
}

model CompilationMetadata {
  id          String   @id @default(cuid())
  configName  String
  timestamp   DateTime @default(now())
  sourceCount Int
  ruleCount   Int
  duration    Int
  outputPath  String?

  @@index([configName])
  @@index([timestamp])
  @@map("compilation_metadata")
}

model SourceSnapshot {
  id          String   @id @default(cuid())
  source      String
  timestamp   DateTime @default(now())
  contentHash String
  ruleCount   Int
  ruleSample  String?
  etag        String?
  isCurrent   Int      @default(1)

  @@unique([source, isCurrent])
  @@index([source])
  @@index([timestamp])
  @@map("source_snapshots")
}

model SourceHealth {
  id                  String   @id @default(cuid())
  source              String   @unique
  status              String
  totalAttempts       Int      @default(0)
  successfulAttempts  Int      @default(0)
  failedAttempts      Int      @default(0)
  consecutiveFailures Int      @default(0)
  averageDuration     Float    @default(0)
  averageRuleCount    Float    @default(0)
  lastAttemptAt       DateTime?
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?
  recentAttempts      String?
  updatedAt           DateTime @updatedAt

  @@index([source])
  @@index([status])
  @@map("source_health")
}

model SourceAttempt {
  id        String   @id @default(cuid())
  source    String
  timestamp DateTime @default(now())
  success   Int      @default(0)
  duration  Int
  error     String?
  ruleCount Int?
  etag      String?

  @@index([source])
  @@index([timestamp])
  @@map("source_attempts")
}
```

### 5. Generate Prisma Client

```bash
# Generate with D1 schema
npx prisma generate --schema=prisma/schema.d1.prisma
```

### 6. Create Database Migrations

```bash
# Generate SQL migration
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.d1.prisma \
  --script > migrations/0001_init.sql

# Apply to local D1
wrangler d1 execute adblock-storage --local --file=migrations/0001_init.sql

# Apply to remote D1
wrangler d1 execute adblock-storage --file=migrations/0001_init.sql
```

### 7. Create D1 Storage Adapter

See `src/storage/D1StorageAdapter.ts` for the complete implementation.

## Usage in Cloudflare Workers

### Worker Entry Point

```typescript
// src/worker.ts
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { D1StorageAdapter } from './storage/D1StorageAdapter';

export interface Env {
    DB: D1Database;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // Create Prisma client with D1 adapter
        const adapter = new PrismaD1(env.DB);
        const prisma = new PrismaClient({ adapter });

        // Create storage adapter
        const storage = new D1StorageAdapter(prisma);

        // Example: Cache a filter list
        await storage.cacheFilterList(
            'https://example.com/filters.txt',
            ['||ad.example.com^'],
            'hash123',
        );

        // Example: Get cached filter
        const cached = await storage.getCachedFilterList('https://example.com/filters.txt');

        return new Response(
            JSON.stringify({
                cached: cached !== null,
                ruleCount: cached?.content.length || 0,
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            },
        );
    },
};
```

### Type Definitions

```typescript
// src/types/env.d.ts
interface Env {
    DB: D1Database;
    CACHE_TTL?: string;
    DEBUG?: string;
}
```

## D1 Storage Adapter API

The D1 adapter implements the same `IStorageAdapter` interface:

```typescript
interface ID1StorageAdapter {
    // Core operations
    set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean>;
    get<T>(key: string[]): Promise<StorageEntry<T> | null>;
    delete(key: string[]): Promise<boolean>;
    list<T>(options?: QueryOptions): Promise<Array<{ key: string[]; value: StorageEntry<T> }>>;

    // Filter caching
    cacheFilterList(source: string, content: string[], hash: string, etag?: string, ttlMs?: number): Promise<boolean>;
    getCachedFilterList(source: string): Promise<CacheEntry | null>;

    // Metadata
    storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean>;
    getCompilationHistory(configName: string, limit?: number): Promise<CompilationMetadata[]>;

    // Maintenance
    clearExpired(): Promise<number>;
    clearCache(): Promise<number>;
    getStats(): Promise<StorageStats>;
}
```

## Local Development

### Using Wrangler Dev

```bash
# Start local development server
wrangler dev

# With local D1 database
wrangler dev --local --persist
```

### Local D1 Testing

```bash
# Execute SQL on local D1
wrangler d1 execute adblock-storage --local --command="SELECT * FROM storage_entries"

# Export local database
wrangler d1 export adblock-storage --local --output=backup.sql
```

## Migration from Prisma/SQLite

### Export Data from SQLite

```typescript
// scripts/export-from-sqlite.ts
import { PrismaStorageAdapter } from './src/storage/PrismaStorageAdapter.ts';

const storage = new PrismaStorageAdapter(logger, { type: 'prisma' });
await storage.open();

const entries = await storage.list({ prefix: [] });
const exportData = entries.map((e) => ({
    key: e.key.join('/'),
    data: JSON.stringify(e.value.data),
    createdAt: e.value.createdAt,
    expiresAt: e.value.expiresAt,
}));

await Deno.writeTextFile('export.json', JSON.stringify(exportData, null, 2));
```

### Import to D1

```typescript
// scripts/import-to-d1.ts
const data = JSON.parse(await Deno.readTextFile('export.json'));

for (const entry of data) {
    await env.DB.prepare(`
    INSERT INTO storage_entries (id, key, data, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
            crypto.randomUUID(),
            entry.key,
            entry.data,
            entry.createdAt,
            entry.expiresAt,
        ).run();
}
```

## Performance Optimization

### Indexing Strategy

The schema includes indexes on:

- `key` - Primary lookup
- `source` - Filter cache queries
- `configName` - Compilation history
- `expiresAt` - TTL cleanup queries
- `timestamp` - Time-series queries

### Query Optimization

```typescript
// Use batch operations when possible
const batch = await env.DB.batch([
  env.DB.prepare('INSERT INTO storage_entries ...').bind(...),
  env.DB.prepare('INSERT INTO storage_entries ...').bind(...),
]);

// Use pagination for large result sets
const entries = await prisma.storageEntry.findMany({
  take: 100,
  skip: page * 100,
  orderBy: { createdAt: 'desc' }
});
```

### Caching Layer

For frequently accessed data, combine D1 with Workers KV:

```typescript
// Check KV cache first
let data = await env.KV.get(key, 'json');

if (!data) {
    // Fall back to D1
    data = await storage.get(key);

    // Cache in KV for faster access
    await env.KV.put(key, JSON.stringify(data), { expirationTtl: 300 });
}
```

## Monitoring and Debugging

### D1 Analytics

Access D1 metrics in Cloudflare Dashboard:

- Query counts
- Read/write operations
- Storage usage
- Query latency

### Query Logging

```typescript
const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
});
```

### Error Handling

```typescript
try {
    await storage.set(['key'], value);
} catch (error) {
    if (error.message.includes('D1_ERROR')) {
        console.error('D1 database error:', error);
        // Implement retry logic or fallback
    }
    throw error;
}
```

## Deployment

### Deploy to Cloudflare Workers

```bash
# Deploy worker
wrangler deploy

# Deploy with environment
wrangler deploy --env production
```

### Environment Variables

Set via wrangler or Cloudflare Dashboard:

```bash
wrangler secret put CACHE_TTL
wrangler secret put DEBUG
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare
on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - name: Setup Node
              uses: actions/setup-node@v4
              with:
                  node-version: '20'

            - name: Install dependencies
              run: npm ci

            - name: Generate Prisma
              run: npx prisma generate --schema=prisma/schema.d1.prisma

            - name: Run D1 migrations
              run: wrangler d1 migrations apply adblock-storage
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

            - name: Deploy Worker
              run: wrangler deploy
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

## Limitations

### D1 Constraints

- **Row size**: Maximum 1MB per row
- **Database size**: 10GB per database (free tier: 5GB)
- **Query complexity**: Complex JOINs may be slower
- **Concurrent writes**: Limited compared to distributed databases

### Workarounds

For large filter lists:

```typescript
// Split large content into chunks
const CHUNK_SIZE = 500000; // 500KB chunks
const chunks = splitIntoChunks(content, CHUNK_SIZE);

for (let i = 0; i < chunks.length; i++) {
    await storage.set(['cache', 'filters', source, `chunk-${i}`], chunks[i]);
}
```

## Troubleshooting

### Common Issues

**"D1_ERROR: no such table"**

- Run migrations: `wrangler d1 execute adblock-storage --file=migrations/0001_init.sql`

**"BINDING_NOT_FOUND"**

- Verify `wrangler.toml` has correct `[[d1_databases]]` configuration

**"Query timeout"**

- Optimize query or add pagination
- Check for missing indexes

**Local vs Remote mismatch**

- Ensure migrations applied to both: `--local` and remote

### Debug Commands

```bash
# List all tables
wrangler d1 execute adblock-storage --command="SELECT name FROM sqlite_master WHERE type='table'"

# Check table schema
wrangler d1 execute adblock-storage --command=".schema storage_entries"

# Count entries
wrangler d1 execute adblock-storage --command="SELECT COUNT(*) FROM storage_entries"
```

## References

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Prisma D1 Adapter](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [D1 SQL Reference](https://developers.cloudflare.com/d1/platform/client-api/)
