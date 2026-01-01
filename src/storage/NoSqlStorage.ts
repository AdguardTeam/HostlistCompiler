/// <reference lib="deno.unstable" />

import type { IDetailedLogger } from '../types/index.ts';

/**
 * Storage entry with metadata
 */
export interface StorageEntry<T = unknown> {
    /** The stored data */
    data: T;
    /** Timestamp when the entry was created */
    createdAt: number;
    /** Timestamp when the entry was last updated */
    updatedAt: number;
    /** Optional expiration timestamp */
    expiresAt?: number;
    /** Optional tags for categorization */
    tags?: string[];
}

/**
 * Query options for listing entries
 */
export interface QueryOptions {
    /** Prefix to filter keys */
    prefix?: string[];
    /** Limit number of results */
    limit?: number;
    /** Start from a specific key */
    start?: string[];
    /** End at a specific key */
    end?: string[];
    /** Reverse the order */
    reverse?: boolean;
}

/**
 * Storage statistics
 */
export interface StorageStats {
    /** Total number of entries */
    entryCount: number;
    /** Number of expired entries */
    expiredCount: number;
    /** Storage size estimate in bytes */
    sizeEstimate: number;
}

/**
 * Cache entry for filter list downloads
 */
export interface CacheEntry {
    /** Source URL or path */
    source: string;
    /** Content of the filter list */
    content: string[];
    /** ETag or version identifier */
    etag?: string;
    /** Content hash for validation */
    hash: string;
}

/**
 * Compilation metadata
 */
export interface CompilationMetadata {
    /** Configuration name */
    configName: string;
    /** Timestamp of compilation */
    timestamp: number;
    /** Number of sources compiled */
    sourceCount: number;
    /** Total number of rules */
    ruleCount: number;
    /** Duration in milliseconds */
    duration: number;
    /** Output file path */
    outputPath?: string;
}

/**
 * NoSQL local storage backend using Deno KV
 * Provides persistent key-value storage with TTL support
 */
export class NoSqlStorage {
    private kv: Deno.Kv | null = null;
    private readonly logger: IDetailedLogger;
    private readonly dbPath?: string;

    /**
     * Creates a new NoSqlStorage instance
     * @param logger - Logger for diagnostic messages
     * @param dbPath - Optional custom database path
     */
    constructor(logger: IDetailedLogger, dbPath?: string) {
        this.logger = logger;
        this.dbPath = dbPath;
    }

    /**
     * Opens the database connection
     * @throws Error if connection fails
     */
    async open(): Promise<void> {
        try {
            this.kv = await Deno.openKv(this.dbPath);
            this.logger.info(`NoSQL storage opened at ${this.dbPath || 'default location'}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to open NoSQL storage: ${message}`);
            throw new Error(`Storage initialization failed: ${message}`);
        }
    }

    /**
     * Closes the database connection
     */
    async close(): Promise<void> {
        if (this.kv) {
            this.kv.close();
            this.kv = null;
            this.logger.info('NoSQL storage closed');
        }
    }

    /**
     * Ensures the database is open
     * @throws Error if database is not initialized
     */
    private ensureOpen(): Deno.Kv {
        if (!this.kv) {
            throw new Error('Storage not initialized. Call open() first.');
        }
        return this.kv;
    }

    /**
     * Stores a value with the given key
     * @param key - Key path (array of strings)
     * @param value - Value to store
     * @param ttlMs - Optional TTL in milliseconds
     * @returns True if successful
     */
    async set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean> {
        const kv = this.ensureOpen();

        const entry: StorageEntry<T> = {
            data: value,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
        };

        try {
            const result = await kv.set(key, entry, ttlMs ? { expireIn: ttlMs } : undefined);
            this.logger.debug(`Stored entry at key: ${key.join('/')}`);
            return result.ok;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to set key ${key.join('/')}: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves a value by key
     * @param key - Key path
     * @returns The stored entry or null if not found/expired
     */
    async get<T>(key: string[]): Promise<StorageEntry<T> | null> {
        const kv = this.ensureOpen();

        try {
            const result = await kv.get<StorageEntry<T>>(key);
            
            if (!result.value) {
                return null;
            }

            // Check if expired
            if (result.value.expiresAt && result.value.expiresAt < Date.now()) {
                this.logger.debug(`Entry at key ${key.join('/')} has expired`);
                await this.delete(key);
                return null;
            }

            this.logger.debug(`Retrieved entry at key: ${key.join('/')}`);
            return result.value;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get key ${key.join('/')}: ${message}`);
            return null;
        }
    }

    /**
     * Deletes a value by key
     * @param key - Key path
     * @returns True if successful
     */
    async delete(key: string[]): Promise<boolean> {
        const kv = this.ensureOpen();

        try {
            await kv.delete(key);
            this.logger.debug(`Deleted entry at key: ${key.join('/')}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to delete key ${key.join('/')}: ${message}`);
            return false;
        }
    }

    /**
     * Lists entries matching the query options
     * @param options - Query options
     * @returns Array of entries with their keys
     */
    async list<T>(options: QueryOptions = {}): Promise<Array<{ key: string[]; value: StorageEntry<T> }>> {
        const kv = this.ensureOpen();
        const results: Array<{ key: string[]; value: StorageEntry<T> }> = [];

        try {
            const selector: Deno.KvListSelector = options.prefix 
                ? { prefix: options.prefix }
                : { start: options.start || [], end: options.end || [] };

            const listOptions: Deno.KvListOptions = {
                limit: options.limit,
                reverse: options.reverse,
            };

            const entries = kv.list<StorageEntry<T>>(selector, listOptions);

            for await (const entry of entries) {
                // Filter out expired entries
                if (entry.value.expiresAt && entry.value.expiresAt < Date.now()) {
                    await this.delete(entry.key as string[]);
                    continue;
                }

                results.push({
                    key: entry.key as string[],
                    value: entry.value,
                });
            }

            this.logger.debug(`Listed ${results.length} entries`);
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to list entries: ${message}`);
            return [];
        }
    }

    /**
     * Clears all expired entries
     * @returns Number of entries deleted
     */
    async clearExpired(): Promise<number> {
        const kv = this.ensureOpen();
        let count = 0;

        try {
            const entries = kv.list<StorageEntry>({ prefix: [] });

            for await (const entry of entries) {
                if (entry.value.expiresAt && entry.value.expiresAt < Date.now()) {
                    await this.delete(entry.key as string[]);
                    count++;
                }
            }

            this.logger.info(`Cleared ${count} expired entries`);
            return count;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to clear expired entries: ${message}`);
            return count;
        }
    }

    /**
     * Gets storage statistics
     * @returns Storage statistics
     */
    async getStats(): Promise<StorageStats> {
        const kv = this.ensureOpen();
        let entryCount = 0;
        let expiredCount = 0;
        let sizeEstimate = 0;

        try {
            const entries = kv.list<StorageEntry>({ prefix: [] });

            for await (const entry of entries) {
                entryCount++;
                
                if (entry.value.expiresAt && entry.value.expiresAt < Date.now()) {
                    expiredCount++;
                }

                // Rough size estimate
                sizeEstimate += JSON.stringify(entry.value).length;
            }

            return { entryCount, expiredCount, sizeEstimate };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get stats: ${message}`);
            return { entryCount: 0, expiredCount: 0, sizeEstimate: 0 };
        }
    }

    // ========================================================================
    // Convenience methods for common use cases
    // ========================================================================

    /**
     * Stores a cache entry for a filter list download
     * @param source - Source URL or path
     * @param content - Filter list content
     * @param hash - Content hash
     * @param etag - Optional ETag
     * @param ttlMs - TTL in milliseconds (default: 1 hour)
     */
    async cacheFilterList(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
        ttlMs: number = 3600000, // 1 hour default
    ): Promise<boolean> {
        const cacheEntry: CacheEntry = { source, content, hash, etag };
        return await this.set(['cache', 'filters', source], cacheEntry, ttlMs);
    }

    /**
     * Retrieves a cached filter list
     * @param source - Source URL or path
     * @returns Cached entry or null if not found
     */
    async getCachedFilterList(source: string): Promise<CacheEntry | null> {
        const entry = await this.get<CacheEntry>(['cache', 'filters', source]);
        return entry?.data || null;
    }

    /**
     * Stores compilation metadata
     * @param metadata - Compilation metadata
     */
    async storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean> {
        const key = ['metadata', 'compilations', metadata.configName, metadata.timestamp.toString()];
        return await this.set(key, metadata);
    }

    /**
     * Retrieves recent compilation metadata
     * @param configName - Configuration name
     * @param limit - Maximum number of results
     * @returns Array of compilation metadata
     */
    async getCompilationHistory(configName: string, limit: number = 10): Promise<CompilationMetadata[]> {
        const entries = await this.list<CompilationMetadata>({
            prefix: ['metadata', 'compilations', configName],
            limit,
            reverse: true, // Most recent first
        });

        return entries.map(e => e.value.data);
    }

    /**
     * Clears all cache entries
     * @returns Number of entries deleted
     */
    async clearCache(): Promise<number> {
        const entries = await this.list({ prefix: ['cache'] });
        let count = 0;

        for (const entry of entries) {
            if (await this.delete(entry.key)) {
                count++;
            }
        }

        this.logger.info(`Cleared ${count} cache entries`);
        return count;
    }
}
