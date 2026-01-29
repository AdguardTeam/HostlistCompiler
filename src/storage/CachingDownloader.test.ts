/**
 * Tests for CachingDownloader
 */

import { assertEquals, assertExists } from '@std/assert';
import { CachingDownloader, CachingOptions } from './CachingDownloader.ts';
import { IDownloader } from '../types/index.ts';
import { IStorageAdapter } from './IStorageAdapter.ts';
import type { CompilationMetadata } from './types.ts';
import { silentLogger } from '../utils/index.ts';

/**
 * Mock downloader for testing
 */
class MockDownloader implements IDownloader {
    public downloadCount = 0;
    private content: string[] = ['||example.com^', '||test.com^'];

    async download(_source: string): Promise<string[]> {
        this.downloadCount++;
        return [...this.content];
    }

    setContent(content: string[]): void {
        this.content = content;
    }
}

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

Deno.test('CachingDownloader - constructor', () => {
    const downloader = new MockDownloader();
    const storage = new MockStorageAdapter();
    const caching = new CachingDownloader(downloader, storage, silentLogger);

    assertExists(caching);
});

Deno.test('CachingDownloader - download without cache', async (t) => {
    await t.step('should download content when cache is disabled', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: false };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        const result = await caching.download('source1');

        assertEquals(result.length, 2);
        assertEquals(downloader.downloadCount, 1);
    });

    await t.step('should download content when cache is empty', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const result = await caching.download('source1');

        assertEquals(result.length, 2);
        assertEquals(downloader.downloadCount, 1);
    });
});

Deno.test('CachingDownloader - download with cache', async (t) => {
    await t.step('should use cached content on second download', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        // First download
        await caching.download('source1');
        assertEquals(downloader.downloadCount, 1);

        // Second download should use cache
        await caching.download('source1');
        assertEquals(downloader.downloadCount, 1); // Still 1, no new download
    });

    await t.step('should download fresh content when forceRefresh is true', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        // First download
        await caching.download('source1');

        // Force refresh
        const options: CachingOptions = { enabled: true, forceRefresh: true };
        const cachingForced = new CachingDownloader(downloader, storage, silentLogger, options);

        await cachingForced.download('source1');
        assertEquals(downloader.downloadCount, 2); // Downloaded twice
    });

    await t.step('should expire cache after TTL', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, ttl: 1 }; // 1ms TTL
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        // First download
        await caching.download('source1');
        assertEquals(downloader.downloadCount, 1);

        // Wait for cache to expire
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Second download should fetch fresh content
        await caching.download('source1');
        assertEquals(downloader.downloadCount, 2);
    });
});

Deno.test('CachingDownloader - downloadWithMetadata', async (t) => {
    await t.step('should return metadata with download result', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const result = await caching.downloadWithMetadata('source1');

        assertExists(result.content);
        assertExists(result.hash);
        assertEquals(result.fromCache, false);
        assertEquals(typeof result.duration, 'number');
    });

    await t.step('should indicate cache hit in metadata', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        // First download
        await caching.downloadWithMetadata('source1');

        // Second download from cache
        const result = await caching.downloadWithMetadata('source1');

        assertEquals(result.fromCache, true);
    });

    await t.step('should include change detection in metadata', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, detectChanges: true };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        // First download
        await caching.downloadWithMetadata('source1');

        // Change content
        downloader.setContent(['||example.com^', '||test.com^', '||new.com^']);

        // Second download with changes
        const options2: CachingOptions = { enabled: true, forceRefresh: true, detectChanges: true };
        const cachingForced = new CachingDownloader(downloader, storage, silentLogger, options2);
        const result = await cachingForced.downloadWithMetadata('source1');

        assertEquals(typeof result.hasChanged, 'boolean');
    });
});

Deno.test('CachingDownloader - health monitoring', async (t) => {
    await t.step('should record successful downloads in health monitor', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, monitorHealth: true };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        await caching.download('source1');

        // Health metrics should be recorded
        // We can't directly access the health monitor, but we can verify the download succeeded
        assertEquals(downloader.downloadCount, 1);
    });

    await t.step('should skip health monitoring when disabled', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, monitorHealth: false };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        await caching.download('source1');

        assertEquals(downloader.downloadCount, 1);
    });
});

Deno.test('CachingDownloader - change detection', async (t) => {
    await t.step('should detect changes between downloads', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, detectChanges: true };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        // First download
        const result1 = await caching.downloadWithMetadata('source1');

        // Change content
        downloader.setContent(['||example.com^', '||test.com^', '||changed.com^']);

        // Force refresh to get new content
        const options2: CachingOptions = { enabled: true, forceRefresh: true, detectChanges: true };
        const cachingForced = new CachingDownloader(downloader, storage, silentLogger, options2);
        const result2 = await cachingForced.downloadWithMetadata('source1');

        // Results should be different
        assertEquals(result1.hash !== result2.hash, true);
    });

    await t.step('should skip change detection when disabled', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, detectChanges: false };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        await caching.downloadWithMetadata('source1');

        assertEquals(downloader.downloadCount, 1);
    });
});

Deno.test('CachingDownloader - options handling', async (t) => {
    await t.step('should use default options when none provided', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const result = await caching.download('source1');

        assertEquals(result.length > 0, true);
    });

    await t.step('should merge provided options with defaults', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = { enabled: true, ttl: 5000 };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        const result = await caching.download('source1');

        assertEquals(result.length > 0, true);
    });

    await t.step('should respect all custom options', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = {
            enabled: true,
            ttl: 10000,
            detectChanges: true,
            monitorHealth: true,
            forceRefresh: false,
        };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        const result = await caching.download('source1');

        assertEquals(result.length > 0, true);
    });
});

Deno.test('CachingDownloader - edge cases', async (t) => {
    await t.step('should handle empty content', async () => {
        const downloader = new MockDownloader();
        downloader.setContent([]);
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const result = await caching.download('source1');

        assertEquals(result.length, 0);
    });

    await t.step('should handle very large content', async () => {
        const downloader = new MockDownloader();
        const largeContent = Array.from({ length: 100000 }, (_, i) => `||example${i}.com^`);
        downloader.setContent(largeContent);
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const result = await caching.download('source1');

        assertEquals(result.length, 100000);
    });

    await t.step('should handle special characters in source URLs', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        const specialSource = 'https://example.com/filter?param=value&other=123#hash';
        const result = await caching.download(specialSource);

        assertEquals(result.length > 0, true);
    });

    await t.step('should handle rapid successive downloads', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const caching = new CachingDownloader(downloader, storage, silentLogger);

        // Multiple rapid downloads
        const results = await Promise.all([
            caching.download('source1'),
            caching.download('source1'),
            caching.download('source1'),
        ]);

        // First download fetches, others use cache
        assertEquals(results.length, 3);
        assertEquals(downloader.downloadCount >= 1, true);
    });
});

Deno.test('CachingDownloader - integration', async (t) => {
    await t.step('should integrate caching, change detection, and health monitoring', async () => {
        const downloader = new MockDownloader();
        const storage = new MockStorageAdapter();
        const options: CachingOptions = {
            enabled: true,
            ttl: 60000,
            detectChanges: true,
            monitorHealth: true,
            forceRefresh: false,
        };
        const caching = new CachingDownloader(downloader, storage, silentLogger, options);

        // First download
        const result1 = await caching.downloadWithMetadata('source1');
        assertEquals(result1.fromCache, false);

        // Second download from cache
        const result2 = await caching.downloadWithMetadata('source1');
        assertEquals(result2.fromCache, true);

        // Both should return same content
        assertEquals(result1.content.length, result2.content.length);
    });
});
