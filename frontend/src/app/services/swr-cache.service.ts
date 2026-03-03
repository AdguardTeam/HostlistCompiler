/**
 * SWR (Stale-While-Revalidate) Cache Service
 *
 * Generic signal-based cache that returns stale data immediately while
 * revalidating in the background. Provides a smooth UX where users see
 * cached data instantly and it refreshes transparently.
 *
 * Angular 21 patterns: signal(), computed(), Injectable with inject()
 */

import { Injectable, signal, computed, type Signal, type WritableSignal } from '@angular/core';

/** A single cache entry with data, timestamp, and revalidation state */
export interface SwrEntry<T> {
    /** The cached (or freshly fetched) data */
    readonly data: Signal<T | undefined>;
    /** Whether a background revalidation is in progress */
    readonly isRevalidating: Signal<boolean>;
    /** Whether the cached data is older than the TTL */
    readonly isStale: Signal<boolean>;
    /** Force a revalidation now */
    revalidate(): void;
}

interface CacheRecord<T> {
    data: WritableSignal<T | undefined>;
    timestamp: WritableSignal<number>;
    isRevalidating: WritableSignal<boolean>;
}

@Injectable({ providedIn: 'root' })
export class SwrCacheService {
    /** Default TTL in milliseconds (30 seconds) */
    private readonly DEFAULT_TTL = 30_000;

    private readonly cache = new Map<string, CacheRecord<unknown>>();

    /**
     * Get or create a cache entry for the given key.
     *
     * On first call: fetches data and caches it.
     * On subsequent calls: returns cached data immediately, then
     * revalidates in the background if stale.
     *
     * @param key     Unique cache key (e.g. 'metrics', 'health')
     * @param fetcher Async function that fetches fresh data
     * @param ttl     Time-to-live in ms (default 30s)
     */
    get<T>(key: string, fetcher: () => Promise<T>, ttl = this.DEFAULT_TTL): SwrEntry<T> {
        let record = this.cache.get(key) as CacheRecord<T> | undefined;

        if (!record) {
            record = {
                data: signal<T | undefined>(undefined),
                timestamp: signal<number>(0),
                isRevalidating: signal<boolean>(false),
            };
            this.cache.set(key, record as CacheRecord<unknown>);
        }

        const isStale = computed(() => {
            const ts = record!.timestamp();
            if (ts === 0) return true;
            return Date.now() - ts > ttl;
        });

        const revalidate = () => this.doFetch(record!, fetcher);

        // Auto-fetch if no data or stale
        if (record.data() === undefined || isStale()) {
            this.doFetch(record, fetcher);
        }

        return {
            data: record.data.asReadonly(),
            isRevalidating: record.isRevalidating.asReadonly(),
            isStale,
            revalidate,
        };
    }

    /** Invalidate a specific cache entry */
    invalidate(key: string): void {
        const record = this.cache.get(key);
        if (record) {
            record.timestamp.set(0);
        }
    }

    /** Clear all cached data */
    clear(): void {
        this.cache.clear();
    }

    private async doFetch<T>(record: CacheRecord<T>, fetcher: () => Promise<T>): Promise<void> {
        if (record.isRevalidating()) return; // Already fetching

        record.isRevalidating.set(true);
        try {
            const data = await fetcher();
            record.data.set(data);
            record.timestamp.set(Date.now());
        } catch (error) {
            // On error, keep stale data — only log
            console.error('[SWR] Revalidation failed:', error);
        } finally {
            record.isRevalidating.set(false);
        }
    }
}
