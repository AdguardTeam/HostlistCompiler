/// <reference lib="deno.unstable" />

/**
 * Tests for NoSqlStorage
 */
import { assertEquals, assertExists } from '@std/assert';
import { type CompilationMetadata, NoSqlStorage } from './NoSqlStorage.ts';
import type { IDetailedLogger } from '../types/index.ts';

// Mock logger for testing
const mockLogger: IDetailedLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
};

Deno.test('NoSqlStorage', async (t) => {
    let storage: NoSqlStorage;

    // Setup: Create storage instance with temporary path
    const tempDbPath = await Deno.makeTempFile({ prefix: 'test_db_' });
    await Deno.remove(tempDbPath); // Remove file so Deno.openKv can create a directory

    await t.step('should open and close storage', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();
        storage.close();
    });

    await t.step('should set and get values', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const testData = { message: 'Hello, World!' };
        const success = await storage.set(['test', 'basic'], testData);
        assertEquals(success, true);

        const entry = await storage.get<typeof testData>(['test', 'basic']);
        assertExists(entry);
        assertEquals(entry.data.message, 'Hello, World!');
        assertExists(entry.createdAt);
        assertExists(entry.updatedAt);

        storage.close();
    });

    await t.step('should delete values', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        await storage.set(['test', 'delete'], { data: 'test' });
        const deleted = await storage.delete(['test', 'delete']);
        assertEquals(deleted, true);

        const entry = await storage.get(['test', 'delete']);
        assertEquals(entry, null);

        storage.close();
    });

    await t.step('should handle TTL expiration', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        // Set with very short TTL
        await storage.set(['test', 'ttl'], { data: 'expires soon' }, 100);

        // Should exist immediately
        let entry = await storage.get(['test', 'ttl']);
        assertExists(entry);

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Should be gone
        entry = await storage.get(['test', 'ttl']);
        assertEquals(entry, null);

        storage.close();
    });

    await t.step('should list entries with prefix', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        // Add multiple entries
        await storage.set(['test', 'list', '1'], { value: 1 });
        await storage.set(['test', 'list', '2'], { value: 2 });
        await storage.set(['test', 'list', '3'], { value: 3 });
        await storage.set(['other', 'key'], { value: 'other' });

        const entries = await storage.list({ prefix: ['test', 'list'] });
        assertEquals(entries.length, 3);

        storage.close();
    });

    await t.step('should list entries with limit', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const entries = await storage.list({
            prefix: ['test', 'list'],
            limit: 2,
        });
        assertEquals(entries.length, 2);

        storage.close();
    });

    await t.step('should cache and retrieve filter lists', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const source = 'https://example.com/filters.txt';
        const content = ['||example.com^', '||test.com^'];
        const hash = 'abc123';

        const cached = await storage.cacheFilterList(source, content, hash);
        assertEquals(cached, true);

        const retrieved = await storage.getCachedFilterList(source);
        assertExists(retrieved);
        assertEquals(retrieved.source, source);
        assertEquals(retrieved.content.length, 2);
        assertEquals(retrieved.hash, hash);

        storage.close();
    });

    await t.step('should store and retrieve compilation metadata', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const metadata: CompilationMetadata = {
            configName: 'test-config',
            timestamp: Date.now(),
            sourceCount: 5,
            ruleCount: 1000,
            duration: 5000,
            outputPath: '/output/filters.txt',
        };

        const stored = await storage.storeCompilationMetadata(metadata);
        assertEquals(stored, true);

        // Add more metadata for history
        await new Promise((resolve) => setTimeout(resolve, 10));
        const metadata2: CompilationMetadata = {
            ...metadata,
            timestamp: Date.now(),
            ruleCount: 1100,
        };
        await storage.storeCompilationMetadata(metadata2);

        const history = await storage.getCompilationHistory('test-config', 5);
        assertEquals(history.length, 2);
        // Should be in reverse chronological order
        assertEquals(history[0].ruleCount, 1100);
        assertEquals(history[1].ruleCount, 1000);

        storage.close();
    });

    await t.step('should get storage statistics', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const stats = await storage.getStats();
        assertExists(stats.entryCount);
        assertExists(stats.sizeEstimate);
        // We expect stats.entryCount > 0 from previous tests
        assertEquals(stats.entryCount > 0, true);

        storage.close();
    });

    await t.step('should clear expired entries', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        // Add entries with short TTL
        await storage.set(['test', 'expire1'], { data: 'test1' }, 50);
        await storage.set(['test', 'expire2'], { data: 'test2' }, 50);

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cleared = await storage.clearExpired();
        // Should have cleared at least the 2 we just added
        assertEquals(cleared >= 2, true);

        storage.close();
    });

    await t.step('should clear cache', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        // Add some cache entries
        await storage.cacheFilterList('source1', ['rule1'], 'hash1');
        await storage.cacheFilterList('source2', ['rule2'], 'hash2');

        const cleared = await storage.clearCache();
        assertEquals(cleared >= 2, true);

        // Verify they're gone
        const cached1 = await storage.getCachedFilterList('source1');
        assertEquals(cached1, null);

        storage.close();
    });

    await t.step('should handle complex data structures', async () => {
        storage = new NoSqlStorage(mockLogger, tempDbPath);
        await storage.open();

        const complexData = {
            array: [1, 2, 3],
            nested: {
                deep: {
                    value: 'nested value',
                },
            },
            map: { key: 'value' },
        };

        await storage.set(['test', 'complex'], complexData);
        const entry = await storage.get<typeof complexData>(['test', 'complex']);
        assertExists(entry);
        assertEquals(entry.data.array.length, 3);
        assertEquals(entry.data.nested.deep.value, 'nested value');

        storage.close();
    });

    // Cleanup: Remove test database
    try {
        await Deno.remove(tempDbPath, { recursive: true });
    } catch {
        // Ignore errors during cleanup
    }
});
