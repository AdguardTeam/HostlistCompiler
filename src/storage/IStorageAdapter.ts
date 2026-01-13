/**
 * Storage Adapter Interface
 *
 * Abstract interface for storage backends, enabling swappable implementations
 * (Deno KV, Prisma, In-Memory, etc.) without changing application code.
 */

import type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './NoSqlStorage.ts';

/**
 * Abstract storage adapter interface
 * Implementations should provide consistent behavior across different backends
 */
export interface IStorageAdapter {
    /**
     * Opens/initializes the storage connection
     */
    open(): Promise<void>;

    /**
     * Closes the storage connection
     */
    close(): Promise<void>;

    /**
     * Checks if the storage is open and ready
     */
    isOpen(): boolean;

    // ========================================================================
    // Core Key-Value Operations
    // ========================================================================

    /**
     * Stores a value with the given key
     * @param key - Key path (array of strings)
     * @param value - Value to store
     * @param ttlMs - Optional TTL in milliseconds
     * @returns True if successful
     */
    set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean>;

    /**
     * Retrieves a value by key
     * @param key - Key path
     * @returns The stored entry or null if not found/expired
     */
    get<T>(key: string[]): Promise<StorageEntry<T> | null>;

    /**
     * Deletes a value by key
     * @param key - Key path
     * @returns True if successful
     */
    delete(key: string[]): Promise<boolean>;

    /**
     * Lists entries matching the query options
     * @param options - Query options
     * @returns Array of entries with their keys
     */
    list<T>(options?: QueryOptions): Promise<Array<{ key: string[]; value: StorageEntry<T> }>>;

    /**
     * Clears all expired entries
     * @returns Number of entries deleted
     */
    clearExpired(): Promise<number>;

    /**
     * Gets storage statistics
     * @returns Storage statistics
     */
    getStats(): Promise<StorageStats>;

    // ========================================================================
    // Convenience Methods for Filter List Caching
    // ========================================================================

    /**
     * Stores a cache entry for a filter list download
     * @param source - Source URL or path
     * @param content - Filter list content
     * @param hash - Content hash
     * @param etag - Optional ETag
     * @param ttlMs - TTL in milliseconds (default: 1 hour)
     */
    cacheFilterList(source: string, content: string[], hash: string, etag?: string, ttlMs?: number): Promise<boolean>;

    /**
     * Retrieves a cached filter list
     * @param source - Source URL or path
     * @returns Cached entry or null if not found
     */
    getCachedFilterList(source: string): Promise<CacheEntry | null>;

    /**
     * Stores compilation metadata
     * @param metadata - Compilation metadata
     */
    storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean>;

    /**
     * Retrieves recent compilation metadata
     * @param configName - Configuration name
     * @param limit - Maximum number of results
     * @returns Array of compilation metadata
     */
    getCompilationHistory(configName: string, limit?: number): Promise<CompilationMetadata[]>;

    /**
     * Clears all cache entries
     * @returns Number of entries deleted
     */
    clearCache(): Promise<number>;
}

/**
 * Storage adapter type identifier
 */
export type StorageAdapterType = 'deno-kv' | 'prisma' | 'memory';

/**
 * Configuration options for storage adapters
 */
export interface StorageAdapterConfig {
    /** Type of storage adapter */
    type: StorageAdapterType;
    /** Database path or connection URL */
    connectionString?: string;
    /** Default TTL for cache entries in milliseconds */
    defaultTtlMs?: number;
    /** Whether to auto-cleanup expired entries */
    autoCleanup?: boolean;
    /** Cleanup interval in milliseconds */
    cleanupIntervalMs?: number;
}

/**
 * Factory function type for creating storage adapters
 */
export type StorageAdapterFactory = (config: StorageAdapterConfig) => IStorageAdapter;
