# Storage Module

A flexible storage backend built on Prisma ORM with SQLite as the default database for the hostlist compiler. Provides persistent key-value storage with TTL support, perfect for caching filter lists and storing compilation metadata.

## Features

- **Key-Value Storage**: Simple yet powerful key-value store using hierarchical keys
- **TTL Support**: Automatic expiration of entries with configurable time-to-live
- **Query API**: List and filter entries by prefix with pagination support
- **Type-Safe**: Full TypeScript support with generic types
- **Storage Statistics**: Track storage size and entry counts
- **Built-in Caching**: Convenience methods for common caching scenarios
- **Multiple Backends**: Support for SQLite, PostgreSQL, MySQL, and Cloudflare D1

## Installation

The storage module is already part of the hostlist compiler. No additional installation required.

## Basic Usage

```typescript
import { PrismaStorageAdapter } from './storage/index.ts';
import { logger } from './utils/logger.ts';

// Create and open storage (uses SQLite by default)
const storage = new PrismaStorageAdapter(logger, {
    type: 'prisma',
    // Uses DATABASE_URL env var or defaults to file:./dev.db
});
await storage.open();

// Store a value
await storage.set(['users', 'john'], { name: 'John Doe', age: 30 });

// Retrieve a value
const entry = await storage.get(['users', 'john']);
console.log(entry?.data); // { name: 'John Doe', age: 30 }

// Delete a value
await storage.delete(['users', 'john']);

// Close when done
await storage.close();
```

## TTL (Time-to-Live)

Store entries that automatically expire after a specified duration:

```typescript
// Store with 1 hour TTL
await storage.set(['cache', 'temp-data'], { value: 'expires soon' }, 3600000);

// After 1 hour, this will return null
const entry = await storage.get(['cache', 'temp-data']);
```

## Querying

List entries with flexible filtering options:

```typescript
// List all entries with a specific prefix
const entries = await storage.list({
    prefix: ['users'],
});

// List with limit and reverse order
const recent = await storage.list({
    prefix: ['logs'],
    limit: 10,
    reverse: true,
});
```

## Caching Filter Lists

Built-in convenience methods for caching downloaded filter lists:

```typescript
// Cache a filter list
await storage.cacheFilterList(
    'https://example.com/filters.txt',
    ['||example.com^', '||test.com^'],
    'abc123hash',
    'etag-value',
    3600000, // 1 hour TTL
);

// Retrieve cached filter list
const cached = await storage.getCachedFilterList('https://example.com/filters.txt');
if (cached) {
    console.log(`Found ${cached.content.length} rules in cache`);
}
```

## Compilation Metadata

Store and retrieve compilation history:

```typescript
// Store metadata after compilation
await storage.storeCompilationMetadata({
    configName: 'my-blocklist',
    timestamp: Date.now(),
    sourceCount: 5,
    ruleCount: 10000,
    duration: 5000,
    outputPath: './output/blocklist.txt',
});

// Get compilation history
const history = await storage.getCompilationHistory('my-blocklist', 10);
for (const meta of history) {
    console.log(`Compiled ${meta.ruleCount} rules in ${meta.duration}ms`);
}
```

## Storage Management

### Statistics

Get information about storage usage:

```typescript
const stats = await storage.getStats();
console.log(`Total entries: ${stats.entryCount}`);
console.log(`Expired: ${stats.expiredCount}`);
console.log(`Size estimate: ${stats.sizeEstimate} bytes`);
```

### Cleanup

Remove expired entries or clear cache:

```typescript
// Clear all expired entries
const cleared = await storage.clearExpired();
console.log(`Cleared ${cleared} expired entries`);

// Clear all cache entries
await storage.clearCache();
```

## Key Structure

Keys are hierarchical arrays of strings, similar to a file path:

```typescript
// Good key structure
['cache', 'filters', 'source-url']['metadata', 'compilations', 'config-name', 'timestamp']['users', 'user-id', 'preferences'] // Keys can be as deep as needed
    ['project', 'version', 'module', 'submodule', 'data'];
```

## Data Types

Store any JSON-serializable data:

```typescript
// Primitives
await storage.set(['config', 'enabled'], true);
await storage.set(['config', 'count'], 42);
await storage.set(['config', 'name'], 'my-app');

// Objects and arrays
await storage.set(['config', 'settings'], {
    theme: 'dark',
    features: ['caching', 'logging'],
});

// Complex nested structures
await storage.set(['data', 'complex'], {
    nested: {
        deep: {
            value: [1, 2, 3],
        },
    },
});
```

## Error Handling

The storage module handles errors gracefully and logs them:

```typescript
// Safe to call even if key doesn't exist
const entry = await storage.get(['nonexistent']); // Returns null

// Operations return boolean success indicators
const success = await storage.set(['key'], 'value');
if (!success) {
    console.error('Failed to store value');
}
```

## Testing

Run the storage tests:

```bash
deno test src/storage/PrismaStorageAdapter.test.ts
```

## Performance Considerations

- **Key Design**: Use hierarchical keys to enable efficient prefix queries
- **TTL**: Set appropriate TTLs for cached data to prevent unbounded growth
- **Cleanup**: Periodically run `clearExpired()` to remove stale entries
- **Batch Operations**: When possible, group related operations together

## Example: Complete Workflow

```typescript
import { PrismaStorageAdapter, CachingDownloader } from './storage/index.ts';
import { FilterDownloader } from '../downloader/FilterDownloader.ts';
import { logger } from './utils/logger.ts';

async function example() {
    // Initialize storage
    const storage = new PrismaStorageAdapter(logger, {
        type: 'prisma',
    });
    await storage.open();

    try {
        // Cache filter list with 1 hour TTL
        await storage.cacheFilterList(
            'https://example.com/filters.txt',
            ['||ad.example.com^', '||tracker.example.com^'],
            'content-hash-123',
            undefined,
            3600000,
        );

        // Check if cached before downloading
        const cached = await storage.getCachedFilterList('https://example.com/filters.txt');
        if (cached) {
            console.log('Using cached filter list');
            return cached.content;
        }

        // Store compilation metadata
        await storage.storeCompilationMetadata({
            configName: 'example-config',
            timestamp: Date.now(),
            sourceCount: 3,
            ruleCount: 5000,
            duration: 3000,
            outputPath: './output/filters.txt',
        });

        // Get storage stats
        const stats = await storage.getStats();
        console.log(`Storage has ${stats.entryCount} entries (${stats.sizeEstimate} bytes)`);

        // Cleanup
        await storage.clearExpired();
    } finally {
        await storage.close();
    }
}
```

## API Reference

### Constructor

- `constructor(logger: IDetailedLogger, config?: StorageAdapterConfig)`

### Core Methods

- `open(): Promise<void>` - Open database connection
- `close(): Promise<void>` - Close database connection
- `set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean>` - Store value
- `get<T>(key: string[]): Promise<StorageEntry<T> | null>` - Retrieve value
- `delete(key: string[]): Promise<boolean>` - Delete value
- `list<T>(options?: QueryOptions): Promise<Array<{ key: string[]; value: StorageEntry<T> }>>` - List entries

### Utility Methods

- `clearExpired(): Promise<number>` - Remove expired entries
- `getStats(): Promise<StorageStats>` - Get storage statistics

### Convenience Methods

- `cacheFilterList(source: string, content: string[], hash: string, etag?: string, ttlMs?: number): Promise<boolean>`
- `getCachedFilterList(source: string): Promise<CacheEntry | null>`
- `storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean>`
- `getCompilationHistory(configName: string, limit?: number): Promise<CompilationMetadata[]>`
- `clearCache(): Promise<number>`

## Advanced Features

### Intelligent Caching

The `CachingDownloader` wraps any downloader implementation with intelligent caching, health monitoring, and change detection.

**Basic Usage:**

```typescript
import { CachingDownloader, PrismaStorageAdapter } from './storage/index.ts';
import { FilterDownloader } from '../downloader/FilterDownloader.ts';

const storage = new PrismaStorageAdapter(logger, { type: 'prisma' });
await storage.open();

const cachingDownloader = new CachingDownloader(
    new FilterDownloader(),
    storage,
    logger,
    {
        enabled: true,
        ttl: 3600000, // 1 hour cache
        detectChanges: true,
        monitorHealth: true,
    },
);

const rules = await cachingDownloader.download('https://example.com/filters.txt');
```

**Download with Metadata:**

```typescript
const result = await cachingDownloader.downloadWithMetadata(source);
console.log(`From cache: ${result.fromCache}`);
console.log(`Changed: ${result.hasChanged}`);
console.log(`Delta: ${result.ruleCountDelta} rules`);
```

### Source Health Monitoring

Track the reliability of filter list sources over time. Sources are classified as:

- **Healthy**: 95%+ success rate, no recent failures
- **Degraded**: 80-95% success rate or 1-2 consecutive failures
- **Unhealthy**: <80% success rate or 3+ consecutive failures

**Usage:**

```typescript
// Get health for specific source
const health = await cachingDownloader.getSourceHealth(source);
console.log(`Status: ${health.status}`);
console.log(`Success rate: ${(health.successRate * 100).toFixed(1)}%`);

// Get all unhealthy sources
const unhealthy = await cachingDownloader.getUnhealthySources();

// Generate health report
const report = await cachingDownloader.generateHealthReport();
console.log(report);
```

### Change Detection

The `ChangeDetector` tracks changes in filter lists over time.

**Usage:**

```typescript
// Get change history
const history = await cachingDownloader.getChangeHistory(source, 10);

// Get last snapshot
const snapshot = await cachingDownloader.getLastSnapshot(source);
if (snapshot) {
    console.log(`Last seen: ${new Date(snapshot.timestamp)}`);
    console.log(`Rules: ${snapshot.ruleCount}`);
}
```

## Best Practices

### Cache TTL Selection

- **Short-lived lists** (updated hourly): 30-60 minutes
- **Daily updated lists**: 6-12 hours
- **Stable lists**: 24 hours
- **Development**: 5-15 minutes

### Storage Maintenance

```typescript
// Clean expired entries daily
const cleared = await storage.clearExpired();

// Monitor storage size
const stats = await storage.getStats();
if (stats.sizeEstimate > 100 * 1024 * 1024) { // 100MB
    await storage.clearCache();
}
```

### Pre-warming Cache

```typescript
// Pre-warm cache for scheduled tasks
await cachingDownloader.prewarmCache(sources);
```

## Storage Backends

The storage module supports multiple backends through the `IStorageAdapter` interface:

| Backend           | Use Case                          | Documentation                                        |
| ----------------- | --------------------------------- | ---------------------------------------------------- |
| **Prisma/SQLite** (default) | Local/single-instance deployments | This document                                        |
| **Prisma/PostgreSQL**       | Multi-instance, production        | [prisma/README.md](../../prisma/README.md)           |
| **Cloudflare D1** | Edge deployments                  | [docs/CLOUDFLARE_D1.md](../../docs/CLOUDFLARE_D1.md) |

### Choosing a Backend

| Scenario                 | Recommended Backend |
| ------------------------ | ------------------- |
| Local development        | SQLite (default)    |
| Single server deployment | SQLite              |
| Multi-server deployment  | PostgreSQL          |
| Cloudflare Workers       | D1StorageAdapter    |
| Need complex queries     | PostgreSQL          |
| Need SQL Server support  | Prisma              |
| Need MongoDB             | Prisma              |

### Prisma Supported Databases

Prisma supports these databases (see [PRISMA_EVALUATION.md](../../docs/PRISMA_EVALUATION.md)):

**SQL Databases:**

- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server
- CockroachDB

**NoSQL Databases:**

- MongoDB

**Edge/Cloud:**

- Cloudflare D1
- Supabase
- PlanetScale
- Turso
- Neon

### Quick Start: Prisma with PostgreSQL

```bash
# Install dependencies
npm install @prisma/client
npm install -D prisma

# Generate client
npx prisma generate

# Create database tables
npx prisma db push
```

```typescript
import { PrismaStorageAdapter } from './storage/index.ts';

const storage = new PrismaStorageAdapter(logger, {
    type: 'prisma',
    connectionString: 'postgresql://user:pass@localhost:5432/adblock',
});

await storage.open();
// Use the same API as shown above
await storage.cacheFilterList(source, rules, hash);
await storage.close();
```

### Quick Start: Cloudflare D1 Backend

```bash
# Install dependencies
npm install @prisma/client @prisma/adapter-d1

# Create D1 database
wrangler d1 create adblock-storage
```

```typescript
// In Cloudflare Worker
import { D1StorageAdapter } from './storage/index.ts';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const storage = new D1StorageAdapter(env.DB);

        await storage.cacheFilterList(source, rules, hash);

        return new Response('OK');
    },
};
```

### Storage Adapter Interface

All backends implement the `IStorageAdapter` interface:

```typescript
interface IStorageAdapter {
    // Lifecycle
    open(): Promise<void>;
    close(): Promise<void>;
    isOpen(): boolean;

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

### Backend Selection at Runtime

```typescript
import type { IStorageAdapter } from './storage/IStorageAdapter.ts';
import { PrismaStorageAdapter } from './storage/PrismaStorageAdapter.ts';
import { D1StorageAdapter } from './storage/D1StorageAdapter.ts';

function createStorage(type: string, env?: { DB: D1Database }): IStorageAdapter {
    switch (type) {
        case 'd1':
            return new D1StorageAdapter(env!.DB);
        case 'prisma':
        default:
            return new PrismaStorageAdapter(logger, { type: 'prisma' });
    }
}
```

## License

Part of the hostlist compiler project.
