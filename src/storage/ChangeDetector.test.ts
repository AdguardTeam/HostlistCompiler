/**
 * Tests for ChangeDetector
 */

import { assertEquals } from '@std/assert';
import { ChangeDetectionResult, ChangeDetector, SourceSnapshot } from './ChangeDetector.ts';
import { IStorageAdapter } from './IStorageAdapter.ts';
import { silentLogger } from '../utils/index.ts';

/**
 * Mock storage adapter for testing
 */
class MockStorageAdapter implements IStorageAdapter {
    private data = new Map<string, unknown>();

    async get<T>(key: string[]): Promise<T | null> {
        const keyStr = key.join('/');
        return (this.data.get(keyStr) as T) ?? null;
    }

    async set(key: string[], value: unknown): Promise<void> {
        const keyStr = key.join('/');
        this.data.set(keyStr, value);
    }

    async delete(key: string[]): Promise<void> {
        const keyStr = key.join('/');
        this.data.delete(keyStr);
    }

    async list(prefix: string[]): Promise<string[][]> {
        const prefixStr = prefix.join('/');
        const results: string[][] = [];
        for (const key of this.data.keys()) {
            if (key.startsWith(prefixStr)) {
                results.push(key.split('/'));
            }
        }
        return results;
    }

    async clear(): Promise<void> {
        this.data.clear();
    }

    // Additional methods required by interface
    async has(key: string[]): Promise<boolean> {
        const keyStr = key.join('/');
        return this.data.has(keyStr);
    }

    async keys(prefix?: string[]): Promise<string[][]> {
        return this.list(prefix ?? []);
    }
}

Deno.test('ChangeDetector - createSnapshot', async (t) => {
    await t.step('should create snapshot with basic data', () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^', '||test.com^'];
        const snapshot = detector.createSnapshot('https://example.com/filter.txt', content, 'hash123');

        assertEquals(snapshot.source, 'https://example.com/filter.txt');
        assertEquals(snapshot.hash, 'hash123');
        assertEquals(snapshot.ruleCount, 2);
        assertEquals(snapshot.ruleSample.length, 2);
        assertEquals(typeof snapshot.timestamp, 'number');
    });

    await t.step('should create snapshot with etag', () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^'];
        const snapshot = detector.createSnapshot('source1', content, 'hash123', 'etag-456');

        assertEquals(snapshot.etag, 'etag-456');
    });

    await t.step('should limit sample to first 10 rules', () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = Array.from({ length: 20 }, (_, i) => `||example${i}.com^`);
        const snapshot = detector.createSnapshot('source1', content, 'hash123');

        assertEquals(snapshot.ruleCount, 20);
        assertEquals(snapshot.ruleSample.length, 10);
        assertEquals(snapshot.ruleSample[0], '||example0.com^');
        assertEquals(snapshot.ruleSample[9], '||example9.com^');
    });

    await t.step('should handle empty content', () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot = detector.createSnapshot('source1', [], 'hash123');

        assertEquals(snapshot.ruleCount, 0);
        assertEquals(snapshot.ruleSample.length, 0);
    });
});

Deno.test('ChangeDetector - storeSnapshot', async (t) => {
    await t.step('should store snapshot in storage', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot: SourceSnapshot = {
            source: 'source1',
            timestamp: Date.now(),
            hash: 'hash123',
            ruleCount: 10,
            ruleSample: ['||example.com^'],
        };

        await detector.storeSnapshot(snapshot);

        const stored = await storage.get<SourceSnapshot>(['snapshots', 'sources', 'source1']);
        assertEquals(stored?.source, 'source1');
        assertEquals(stored?.hash, 'hash123');
    });
});

Deno.test('ChangeDetector - getSnapshot', async (t) => {
    await t.step('should retrieve stored snapshot', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot: SourceSnapshot = {
            source: 'source1',
            timestamp: Date.now(),
            hash: 'hash123',
            ruleCount: 10,
            ruleSample: ['||example.com^'],
        };

        await detector.storeSnapshot(snapshot);
        const retrieved = await detector.getSnapshot('source1');

        assertEquals(retrieved?.source, 'source1');
        assertEquals(retrieved?.hash, 'hash123');
    });

    await t.step('should return null for non-existent snapshot', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const retrieved = await detector.getSnapshot('nonexistent');

        assertEquals(retrieved, null);
    });
});

Deno.test('ChangeDetector - detectChange', async (t) => {
    await t.step('should detect no change when content is same', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^', '||test.com^'];
        const snapshot = detector.createSnapshot('source1', content, 'hash123');
        await detector.storeSnapshot(snapshot);

        const result = await detector.detectChange('source1', content, 'hash123');

        assertEquals(result.hasChanged, false);
        assertEquals(result.ruleCountDelta, 0);
        assertEquals(result.ruleCountChangePercent, 0);
    });

    await t.step('should detect change when hash differs', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content1 = ['||example.com^'];
        const snapshot = detector.createSnapshot('source1', content1, 'hash123');
        await detector.storeSnapshot(snapshot);

        const content2 = ['||example.com^', '||test.com^'];
        const result = await detector.detectChange('source1', content2, 'hash456');

        assertEquals(result.hasChanged, true);
        assertEquals(result.ruleCountDelta, 1);
    });

    await t.step('should detect new source (no previous snapshot)', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^'];
        const result = await detector.detectChange('new-source', content, 'hash123');

        assertEquals(result.hasChanged, true);
        assertEquals(result.previous, undefined);
        assertEquals(result.current.source, 'new-source');
    });

    await t.step('should calculate rule count delta', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content1 = Array.from({ length: 10 }, (_, i) => `||example${i}.com^`);
        const snapshot = detector.createSnapshot('source1', content1, 'hash1');
        await detector.storeSnapshot(snapshot);

        const content2 = Array.from({ length: 15 }, (_, i) => `||example${i}.com^`);
        const result = await detector.detectChange('source1', content2, 'hash2');

        assertEquals(result.ruleCountDelta, 5);
    });

    await t.step('should calculate percentage change', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content1 = Array.from({ length: 100 }, (_, i) => `||example${i}.com^`);
        const snapshot = detector.createSnapshot('source1', content1, 'hash1');
        await detector.storeSnapshot(snapshot);

        const content2 = Array.from({ length: 150 }, (_, i) => `||example${i}.com^`);
        const result = await detector.detectChange('source1', content2, 'hash2');

        assertEquals(result.ruleCountChangePercent, 50);
    });

    await t.step('should calculate time since last snapshot', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^'];
        const snapshot = detector.createSnapshot('source1', content, 'hash1');
        await detector.storeSnapshot(snapshot);

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = await detector.detectChange('source1', content, 'hash2');

        assertEquals(typeof result.timeSinceLastSnapshot, 'number');
        assertEquals((result.timeSinceLastSnapshot ?? 0) > 0, true);
    });
});

Deno.test('ChangeDetector - archiveSnapshot', async (t) => {
    await t.step('should archive snapshot to history', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot: SourceSnapshot = {
            source: 'source1',
            timestamp: 123456,
            hash: 'hash123',
            ruleCount: 10,
            ruleSample: ['||example.com^'],
        };

        await detector.archiveSnapshot(snapshot);

        const archived = await storage.get(['snapshots', 'history', 'source1', '123456']);
        assertEquals(archived !== null, true);
    });
});

Deno.test('ChangeDetector - getSnapshotHistory', async (t) => {
    await t.step('should retrieve snapshot history', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        // Create and archive multiple snapshots
        for (let i = 0; i < 3; i++) {
            const snapshot: SourceSnapshot = {
                source: 'source1',
                timestamp: Date.now() + i * 1000,
                hash: `hash${i}`,
                ruleCount: 10 + i,
                ruleSample: ['||example.com^'],
            };
            await detector.archiveSnapshot(snapshot);
        }

        const history = await detector.getSnapshotHistory('source1');

        assertEquals(history.length, 3);
    });

    await t.step('should return empty array for no history', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const history = await detector.getSnapshotHistory('nonexistent');

        assertEquals(history.length, 0);
    });
});

Deno.test('ChangeDetector - generateSummary', async (t) => {
    await t.step('should generate change summary for multiple sources', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        // Setup: create snapshots for 3 sources
        const snapshot1 = detector.createSnapshot('source1', ['||example.com^'], 'hash1');
        const snapshot2 = detector.createSnapshot('source2', ['||test.com^'], 'hash2');
        const snapshot3 = detector.createSnapshot('source3', ['||domain.org^'], 'hash3');

        await detector.storeSnapshot(snapshot1);
        await detector.storeSnapshot(snapshot2);
        await detector.storeSnapshot(snapshot3);

        // Detect changes
        const results: ChangeDetectionResult[] = [
            await detector.detectChange('source1', ['||example.com^', '||new.com^'], 'hash1-new'),
            await detector.detectChange('source2', ['||test.com^'], 'hash2'), // No change
            await detector.detectChange('source4', ['||fresh.com^'], 'hash4'), // New source
        ];

        const summary = detector.generateSummary(results);

        assertEquals(summary.totalSources, 3);
        assertEquals(summary.changedSources, 1);
        assertEquals(summary.unchangedSources, 1);
        assertEquals(summary.newSources, 1);
    });

    await t.step('should include change details in summary', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot = detector.createSnapshot('source1', ['||example.com^'], 'hash1');
        await detector.storeSnapshot(snapshot);

        const results: ChangeDetectionResult[] = [
            await detector.detectChange('source1', ['||example.com^', '||new.com^'], 'hash-new'),
        ];

        const summary = detector.generateSummary(results);

        assertEquals(summary.changes.length, 1);
        assertEquals(summary.changes[0].source, 'source1');
        assertEquals(summary.changes[0].ruleCountDelta, 1);
    });
});

Deno.test('ChangeDetector - edge cases', async (t) => {
    await t.step('should handle very large rule sets', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const largeContent = Array.from({ length: 100000 }, (_, i) => `||example${i}.com^`);
        const snapshot = detector.createSnapshot('source1', largeContent, 'hash-large');

        assertEquals(snapshot.ruleCount, 100000);
        assertEquals(snapshot.ruleSample.length, 10); // Still limited to 10
    });

    await t.step('should handle special characters in source names', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^'];
        const snapshot = detector.createSnapshot('https://example.com/filter?param=value&other=123', content, 'hash123');

        await detector.storeSnapshot(snapshot);

        const retrieved = await detector.getSnapshot('https://example.com/filter?param=value&other=123');
        assertEquals(retrieved !== null, true);
    });

    await t.step('should handle empty rule samples', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot = detector.createSnapshot('source1', [], 'hash-empty');

        assertEquals(snapshot.ruleSample.length, 0);
    });
});
