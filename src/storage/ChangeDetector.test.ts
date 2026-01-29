/**
 * Tests for ChangeDetector
 */

import { assertEquals } from '@std/assert';
import { ChangeDetectionResult, ChangeDetector, SourceSnapshot } from './ChangeDetector.ts';
import { IStorageAdapter } from './IStorageAdapter.ts';
import type { CompilationMetadata } from './types.ts';
import { silentLogger } from '../utils/index.ts';

/**
 * Mock storage adapter for testing
 */
class MockStorageAdapter implements IStorageAdapter {
    private data = new Map<string, { data: unknown; createdAt: number; updatedAt: number; expiresAt?: number }>();
    private _isOpen = true;

    async open(): Promise<void> {
        this._isOpen = true;
    }

    async close(): Promise<void> {
        this._isOpen = false;
    }

    isOpen(): boolean {
        return this._isOpen;
    }

    async get<T>(key: string[]): Promise<{ data: T; createdAt: number; updatedAt: number; expiresAt?: number } | null> {
        const keyStr = key.join('/');
        const entry = this.data.get(keyStr);
        if (!entry) return null;

        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.data.delete(keyStr);
            return null;
        }

        return entry as { data: T; createdAt: number; updatedAt: number; expiresAt?: number };
    }

    async set(key: string[], value: unknown, ttlMs?: number): Promise<boolean> {
        const keyStr = key.join('/');
        const now = Date.now();
        const entry: { data: unknown; createdAt: number; updatedAt: number; expiresAt?: number } = {
            data: value,
            createdAt: now,
            updatedAt: now,
        };
        if (ttlMs) {
            entry.expiresAt = now + ttlMs;
        }
        this.data.set(keyStr, entry);
        return true;
    }

    async delete(key: string[]): Promise<boolean> {
        const keyStr = key.join('/');
        return this.data.delete(keyStr);
    }

    async list<T>(options?: { prefix?: string[]; limit?: number; reverse?: boolean }): Promise<
        Array<{ key: string[]; value: { data: T; createdAt: number; updatedAt: number; expiresAt?: number } }>
    > {
        const prefixStr = options?.prefix ? options.prefix.join('/') : '';
        const results: Array<{ key: string[]; value: { data: T; createdAt: number; updatedAt: number; expiresAt?: number } }> = [];

        for (const [keyStr, entry] of this.data.entries()) {
            if (keyStr.startsWith(prefixStr)) {
                // Skip expired entries
                if (entry.expiresAt && Date.now() > entry.expiresAt) {
                    continue;
                }
                results.push({
                    key: keyStr.split('/'),
                    value: entry as { data: T; createdAt: number; updatedAt: number; expiresAt?: number },
                });
            }
        }

        if (options?.reverse) {
            results.reverse();
        }

        if (options?.limit) {
            return results.slice(0, options.limit);
        }

        return results;
    }

    async clearExpired(): Promise<number> {
        const now = Date.now();
        let count = 0;
        for (const [key, entry] of this.data.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.data.delete(key);
                count++;
            }
        }
        return count;
    }

    async getStats(): Promise<{
        entryCount: number;
        expiredCount: number;
        sizeEstimate: number;
    }> {
        const now = Date.now();
        let expiredEntries = 0;
        for (const entry of this.data.values()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                expiredEntries++;
            }
        }
        return {
            entryCount: this.data.size,
            expiredCount: expiredEntries,
            sizeEstimate: 0,
        };
    }

    async cacheFilterList(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
        ttlMs?: number,
    ): Promise<boolean> {
        const entry = {
            source,
            content,
            hash,
            etag,
        };
        return await this.set(['cache', 'filters', source], entry, ttlMs);
    }

    async getCachedFilterList(source: string): Promise<{ source: string; content: string[]; hash: string; etag?: string } | null> {
        const entry = await this.get<{ source: string; content: string[]; hash: string; etag?: string }>([
            'cache',
            'filters',
            source,
        ]);
        return entry ? entry.data : null;
    }

    async storeCompilationMetadata(_metadata: unknown): Promise<boolean> {
        return true;
    }

    async getCompilationHistory(_configName: string, _limit?: number): Promise<CompilationMetadata[]> {
        return [];
    }

    async clearCache(): Promise<number> {
        const entries = await this.list({ prefix: ['cache'] });
        let count = 0;
        for (const entry of entries) {
            if (await this.delete(entry.key)) {
                count++;
            }
        }
        return count;
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
        assertEquals(stored?.data.source, 'source1');
        assertEquals(stored?.data.hash, 'hash123');
    });
});

Deno.test('ChangeDetector - getLastSnapshot', async (t) => {
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
        const retrieved = await detector.getLastSnapshot('source1');

        assertEquals(retrieved?.source, 'source1');
        assertEquals(retrieved?.hash, 'hash123');
    });

    await t.step('should return null for non-existent snapshot', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const retrieved = await detector.getLastSnapshot('nonexistent');

        assertEquals(retrieved, null);
    });
});

Deno.test('ChangeDetector - detectChanges', async (t) => {
    await t.step('should detect no change when content is same', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^', '||test.com^'];
        const snapshot = detector.createSnapshot('source1', content, 'hash123');
        await detector.storeSnapshot(snapshot);

        const result = await detector.detectChanges('source1', content, 'hash123');

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
        const result = await detector.detectChanges('source1', content2, 'hash456');

        assertEquals(result.hasChanged, true);
        assertEquals(result.ruleCountDelta, 1);
    });

    await t.step('should detect new source (no previous snapshot)', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content = ['||example.com^'];
        const result = await detector.detectChanges('new-source', content, 'hash123');

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
        const result = await detector.detectChanges('source1', content2, 'hash2');

        assertEquals(result.ruleCountDelta, 5);
    });

    await t.step('should calculate percentage change', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const content1 = Array.from({ length: 100 }, (_, i) => `||example${i}.com^`);
        const snapshot = detector.createSnapshot('source1', content1, 'hash1');
        await detector.storeSnapshot(snapshot);

        const content2 = Array.from({ length: 150 }, (_, i) => `||example${i}.com^`);
        const result = await detector.detectChanges('source1', content2, 'hash2');

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

        const result = await detector.detectChanges('source1', content, 'hash2');

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

Deno.test('ChangeDetector - generateChangeSummary', async (t) => {
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
            await detector.detectChanges('source1', ['||example.com^', '||new.com^'], 'hash1-new'),
            await detector.detectChanges('source2', ['||test.com^'], 'hash2'), // No change
            await detector.detectChanges('source4', ['||fresh.com^'], 'hash4'), // New source
        ];

        const summary = await detector.generateChangeSummary(results);

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
            await detector.detectChanges('source1', ['||example.com^', '||new.com^'], 'hash-new'),
        ];

        const summary = await detector.generateChangeSummary(results);

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

        const retrieved = await detector.getLastSnapshot('https://example.com/filter?param=value&other=123');
        assertEquals(retrieved !== null, true);
    });

    await t.step('should handle empty rule samples', async () => {
        const storage = new MockStorageAdapter();
        const detector = new ChangeDetector(storage, silentLogger);

        const snapshot = detector.createSnapshot('source1', [], 'hash-empty');

        assertEquals(snapshot.ruleSample.length, 0);
    });
});
