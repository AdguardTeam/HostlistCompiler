// deno-lint-ignore-file no-console
/**
 * Prisma Storage Adapter - Usage Examples
 *
 * This file demonstrates how to use the PrismaStorageAdapter,
 * the default storage backend using SQLite.
 *
 * Prerequisites:
 *   1. npm install @prisma/client
 *   2. npx prisma generate
 *   3. npx prisma db push (or npx prisma migrate dev)
 *   4. Optionally set DATABASE_URL environment variable
 *
 * Run this example:
 *   DATABASE_URL="file:./dev.db" deno run --allow-all src/storage/prisma-example.ts
 */

import type { IStorageAdapter } from './IStorageAdapter.ts';
import type { IDetailedLogger } from '../types/index.ts';

// Note: In actual usage, import from the storage module:
// import { PrismaStorageAdapter } from './storage/index.ts';

/**
 * Simple console logger for examples
 */
const exampleLogger: IDetailedLogger = {
    debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
    trace: (msg: string) => console.log(`[TRACE] ${msg}`),
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.log(`[WARN] ${msg}`),
    error: (msg: string) => console.log(`[ERROR] ${msg}`),
};

// ============================================================================
// Example 1: Basic Key-Value Operations
// ============================================================================

async function basicOperationsExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 1: Basic Key-Value Operations ===\n');

    // Store a simple value
    await storage.set(['config', 'version'], '1.0.0');
    console.log('Stored version string');

    // Store an object
    await storage.set(['config', 'settings'], {
        theme: 'dark',
        language: 'en',
        notifications: true,
    });
    console.log('Stored settings object');

    // Retrieve values
    const version = await storage.get<string>(['config', 'version']);
    console.log(`Retrieved version: ${version?.data}`);

    const settings = await storage.get<{ theme: string; language: string }>(['config', 'settings']);
    console.log(`Retrieved settings: ${JSON.stringify(settings?.data)}`);

    // Delete a value
    await storage.delete(['config', 'version']);
    console.log('Deleted version');

    // Verify deletion
    const deleted = await storage.get<string>(['config', 'version']);
    console.log(`After deletion: ${deleted === null ? 'null (as expected)' : 'still exists'}`);
}

// ============================================================================
// Example 2: TTL (Time-to-Live) Support
// ============================================================================

async function ttlExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 2: TTL (Time-to-Live) Support ===\n');

    // Store with 5-second TTL
    await storage.set(['cache', 'temporary'], 'This will expire', 5000);
    console.log('Stored temporary value with 5-second TTL');

    // Immediately retrieve
    const immediate = await storage.get<string>(['cache', 'temporary']);
    console.log(`Immediate retrieval: ${immediate?.data}`);

    // Store with longer TTL
    await storage.set(
        ['cache', 'session'],
        {
            userId: 123,
            token: 'abc123',
        },
        3600000,
    ); // 1 hour
    console.log('Stored session with 1-hour TTL');

    // Check expiration timestamp
    const session = await storage.get(['cache', 'session']);
    if (session?.expiresAt) {
        console.log(`Session expires at: ${new Date(session.expiresAt).toISOString()}`);
    }
}

// ============================================================================
// Example 3: Filter List Caching
// ============================================================================

async function filterCachingExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 3: Filter List Caching ===\n');

    const filterSource = 'https://example.com/adblock-filters.txt';
    const filterRules = ['||ads.example.com^', '||tracker.example.com^', '||analytics.example.com^', '@@||allowed.example.com^'];

    // Cache filter list
    const cached = await storage.cacheFilterList(
        filterSource,
        filterRules,
        'sha256-abc123def456', // Content hash
        'W/"123456789"', // ETag
        3600000, // 1 hour TTL
    );
    console.log(`Cache result: ${cached ? 'success' : 'failed'}`);

    // Retrieve cached filter list
    const retrieved = await storage.getCachedFilterList(filterSource);
    if (retrieved) {
        console.log(`Retrieved ${retrieved.content.length} rules from cache`);
        console.log(`Hash: ${retrieved.hash}`);
        console.log(`ETag: ${retrieved.etag}`);
        console.log(`Sample rules: ${retrieved.content.slice(0, 2).join(', ')}`);
    }

    // Check if specific source is cached
    const nonExistent = await storage.getCachedFilterList('https://nonexistent.com/filters.txt');
    console.log(`Non-existent source: ${nonExistent === null ? 'not cached' : 'found'}`);
}

// ============================================================================
// Example 4: Compilation Metadata
// ============================================================================

async function compilationMetadataExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 4: Compilation Metadata ===\n');

    // Store multiple compilation records
    const compilations = [
        {
            configName: 'my-blocklist',
            timestamp: Date.now() - 7200000, // 2 hours ago
            sourceCount: 5,
            ruleCount: 50000,
            duration: 3500,
            outputPath: './output/blocklist-v1.txt',
        },
        {
            configName: 'my-blocklist',
            timestamp: Date.now() - 3600000, // 1 hour ago
            sourceCount: 5,
            ruleCount: 51000,
            duration: 3200,
            outputPath: './output/blocklist-v2.txt',
        },
        {
            configName: 'my-blocklist',
            timestamp: Date.now(), // Now
            sourceCount: 6,
            ruleCount: 55000,
            duration: 3800,
            outputPath: './output/blocklist-v3.txt',
        },
    ];

    for (const comp of compilations) {
        await storage.storeCompilationMetadata(comp);
    }
    console.log(`Stored ${compilations.length} compilation records`);

    // Retrieve compilation history
    const history = await storage.getCompilationHistory('my-blocklist', 5);
    console.log(`\nCompilation History (${history.length} records):`);

    for (const record of history) {
        console.log(
            `  - ${new Date(record.timestamp).toISOString()}: ` +
                `${record.ruleCount} rules from ${record.sourceCount} sources ` +
                `(${record.duration}ms)`,
        );
    }
}

// ============================================================================
// Example 5: Querying and Listing
// ============================================================================

async function queryingExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 5: Querying and Listing ===\n');

    // Store some test data
    await storage.set(['users', 'alice', 'profile'], { name: 'Alice', role: 'admin' });
    await storage.set(['users', 'bob', 'profile'], { name: 'Bob', role: 'user' });
    await storage.set(['users', 'charlie', 'profile'], { name: 'Charlie', role: 'user' });
    await storage.set(['logs', '001'], { message: 'User login', level: 'info' });
    await storage.set(['logs', '002'], { message: 'Error occurred', level: 'error' });
    console.log('Stored test data');

    // List all users
    const users = await storage.list({ prefix: ['users'] });
    console.log(`\nFound ${users.length} user entries:`);
    for (const user of users) {
        console.log(`  - ${user.key.join('/')}: ${JSON.stringify(user.value.data)}`);
    }

    // List with limit
    const limitedLogs = await storage.list({
        prefix: ['logs'],
        limit: 1,
    });
    console.log(`\nLimited logs (1): ${limitedLogs.length} entries`);

    // List in reverse order
    const reverseLogs = await storage.list({
        prefix: ['logs'],
        reverse: true,
    });
    console.log(`\nReverse order logs:`);
    for (const log of reverseLogs) {
        console.log(`  - ${log.key.join('/')}`);
    }
}

// ============================================================================
// Example 6: Storage Statistics and Maintenance
// ============================================================================

async function maintenanceExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 6: Storage Statistics and Maintenance ===\n');

    // Get storage statistics
    const stats = await storage.getStats();
    console.log('Storage Statistics:');
    console.log(`  - Total entries: ${stats.entryCount}`);
    console.log(`  - Expired entries: ${stats.expiredCount}`);
    console.log(`  - Size estimate: ${(stats.sizeEstimate / 1024).toFixed(2)} KB`);

    // Clear expired entries
    const clearedExpired = await storage.clearExpired();
    console.log(`\nCleared ${clearedExpired} expired entries`);

    // Clear all cache
    const clearedCache = await storage.clearCache();
    console.log(`Cleared ${clearedCache} cache entries`);

    // Final stats
    const finalStats = await storage.getStats();
    console.log(`\nFinal entry count: ${finalStats.entryCount}`);
}

// ============================================================================
// Example 7: Factory Pattern for Backend Selection
// ============================================================================

type StorageBackend = 'prisma' | 'd1' | 'memory';

/**
 * Factory function demonstrating how to select storage backend at runtime
 */
async function createStorageBackend(backend: StorageBackend, logger: IDetailedLogger): Promise<IStorageAdapter> {
    switch (backend) {
        case 'prisma': {
            // Dynamic import to avoid loading Prisma if not needed
            const { PrismaStorageAdapter } = await import('./PrismaStorageAdapter.ts');
            return new PrismaStorageAdapter(logger, {
                type: 'prisma',
                connectionString: Deno.env.get('DATABASE_URL'),
                autoCleanup: true,
                cleanupIntervalMs: 300000, // 5 minutes
            });
        }

        case 'd1': {
            // D1 requires Cloudflare Workers environment
            throw new Error('D1 storage requires Cloudflare Workers environment');
        }

        case 'memory':
        default: {
            // For testing - simple in-memory implementation
            return createInMemoryStorage();
        }
    }
}

/**
 * Simple in-memory storage for testing
 */
function createInMemoryStorage(): IStorageAdapter {
    const store = new Map<string, unknown>();

    return {
        async open() {},
        async close() {},
        isOpen: () => true,

        async set(key, value, ttlMs) {
            store.set(key.join('/'), {
                data: value,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
            });
            return true;
        },

        async get(key) {
            return (store.get(key.join('/')) as ReturnType<IStorageAdapter['get']>) || null;
        },

        async delete(key) {
            store.delete(key.join('/'));
            return true;
        },

        async list(options = {}) {
            const results: Array<{ key: string[]; value: unknown }> = [];
            const prefix = options.prefix?.join('/') || '';

            for (const [key, value] of store.entries()) {
                if (key.startsWith(prefix)) {
                    results.push({ key: key.split('/'), value });
                }
            }

            return results.slice(0, options.limit) as Awaited<ReturnType<IStorageAdapter['list']>>;
        },

        async clearExpired() {
            return 0;
        },
        async getStats() {
            return { entryCount: store.size, expiredCount: 0, sizeEstimate: 0 };
        },
        async cacheFilterList() {
            return true;
        },
        async getCachedFilterList() {
            return null;
        },
        async storeCompilationMetadata() {
            return true;
        },
        async getCompilationHistory() {
            return [];
        },
        async clearCache() {
            store.clear();
            return 0;
        },
    };
}

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function errorHandlingExample(storage: IStorageAdapter): Promise<void> {
    console.log('\n=== Example 8: Error Handling ===\n');

    // Graceful handling of non-existent keys
    const nonExistent = await storage.get(['does', 'not', 'exist']);
    console.log(`Non-existent key returns: ${nonExistent === null ? 'null' : 'unexpected value'}`);

    // Delete non-existent key (should not throw)
    const deleteResult = await storage.delete(['does', 'not', 'exist']);
    console.log(`Delete non-existent: ${deleteResult ? 'success' : 'failed'}`);

    // Operations return boolean indicators
    const setResult = await storage.set(['test', 'error-handling'], 'test value');
    if (setResult) {
        console.log('Set operation succeeded');
    } else {
        console.log('Set operation failed - check logs for details');
    }
}

// ============================================================================
// Main: Run All Examples
// ============================================================================

async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Prisma Storage Adapter - Usage Examples                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Determine which backend to use
    const backend = (Deno.env.get('STORAGE_BACKEND') || 'memory') as StorageBackend;
    console.log(`\nUsing storage backend: ${backend}`);

    if (backend === 'prisma') {
        console.log('DATABASE_URL:', Deno.env.get('DATABASE_URL') || '(not set)');
    }

    try {
        // Create storage instance
        const storage = await createStorageBackend(backend, exampleLogger);
        await storage.open();

        console.log('Storage initialized successfully\n');

        // Run examples
        await basicOperationsExample(storage);
        await ttlExample(storage);
        await filterCachingExample(storage);
        await compilationMetadataExample(storage);
        await queryingExample(storage);
        await maintenanceExample(storage);
        await errorHandlingExample(storage);

        // Cleanup
        await storage.close();
        console.log('\n✓ All examples completed successfully!');
    } catch (error) {
        console.error('\n✗ Error running examples:', error);
        Deno.exit(1);
    }
}

// Run if executed directly
if (import.meta.main) {
    main();
}

// Export for testing
export { basicOperationsExample, compilationMetadataExample, createStorageBackend, errorHandlingExample, filterCachingExample, maintenanceExample, queryingExample, ttlExample };
