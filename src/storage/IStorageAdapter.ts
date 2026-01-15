/**
 * Storage Adapter Interface Module
 *
 * Provides an abstract interface for storage backends, enabling swappable
 * implementations (Prisma, Cloudflare D1, In-Memory, etc.) without
 * changing application code.
 *
 * ## Available Implementations
 *
 * | Adapter | Backend | Use Case |
 * |---------|---------|----------|
 * | `PrismaStorageAdapter` | Prisma ORM (SQLite default) | Local/multi-instance |
 * | `D1StorageAdapter` | Cloudflare D1 | Edge deployments |
 *
 * ## Supported Databases (via Prisma)
 *
 * - **SQL**: SQLite (default), PostgreSQL, MySQL, MariaDB, SQL Server, CockroachDB
 * - **NoSQL**: MongoDB
 * - **Edge**: Cloudflare D1, Turso, Supabase, PlanetScale
 *
 * ## Usage Example
 *
 * ```typescript
 * import type { IStorageAdapter } from './storage/IStorageAdapter.ts';
 * import { PrismaStorageAdapter } from './storage/PrismaStorageAdapter.ts';
 *
 * // Create storage with SQLite (default)
 * const storage = new PrismaStorageAdapter(logger, { type: 'prisma' });
 * await storage.open();
 *
 * await storage.set(['cache', 'data'], { value: 123 }, 3600000);
 * const entry = await storage.get(['cache', 'data']);
 *
 * await storage.close();
 * ```
 *
 * @module IStorageAdapter
 */

import type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './types.ts';

/**
 * Abstract storage adapter interface
 *
 * All storage backend implementations must implement this interface to ensure
 * consistent behavior across different backends.
 *
 * ## Key Design Principles
 *
 * 1. **Hierarchical Keys**: Keys are arrays of strings forming paths
 *    (e.g., `['cache', 'filters', 'source-url']`)
 *
 * 2. **TTL Support**: All set operations support optional time-to-live
 *
 * 3. **Type Safety**: Generic methods preserve type information
 *
 * 4. **Graceful Failures**: Methods return success indicators rather than throwing
 *
 * ## Implementation Requirements
 *
 * - `open()` must be called before any operations
 * - `close()` should release all resources
 * - Expired entries should not be returned by `get()` or `list()`
 * - Operations should be atomic where possible
 *
 * @example
 * ```typescript
 * class MyStorageAdapter implements IStorageAdapter {
 *     async open() { /* connect to database *\/ }
 *     async close() { /* disconnect *\/ }
 *     isOpen() { return this._isOpen; }
 *     // ... implement other methods
 * }
 * ```
 */
export interface IStorageAdapter {
    /**
     * Opens/initializes the storage connection
     *
     * Must be called before any storage operations. Should be idempotent
     * (safe to call multiple times).
     *
     * @throws Error if connection fails
     *
     * @example
     * ```typescript
     * const storage = new PrismaStorageAdapter(logger, config);
     * await storage.open();
     * // Now ready for operations
     * ```
     */
    open(): Promise<void>;

    /**
     * Closes the storage connection and releases resources
     *
     * Should be called when storage is no longer needed. Safe to call
     * even if not open.
     *
     * @example
     * ```typescript
     * try {
     *     await storage.open();
     *     // ... use storage
     * } finally {
     *     await storage.close();
     * }
     * ```
     */
    close(): Promise<void>;

    /**
     * Checks if the storage is open and ready for operations
     *
     * @returns True if storage is initialized and ready
     *
     * @example
     * ```typescript
     * if (!storage.isOpen()) {
     *     await storage.open();
     * }
     * ```
     */
    isOpen(): boolean;

    // ========================================================================
    // Core Key-Value Operations
    // ========================================================================

    /**
     * Stores a value with the given hierarchical key
     *
     * Keys are arrays of strings that form a path-like structure.
     * Values can be any JSON-serializable data.
     *
     * @typeParam T - Type of the value being stored
     * @param key - Hierarchical key path (e.g., `['users', 'john', 'profile']`)
     * @param value - Value to store (must be JSON-serializable)
     * @param ttlMs - Optional time-to-live in milliseconds
     * @returns True if successful, false if operation failed
     *
     * @example
     * ```typescript
     * // Store without TTL (permanent until deleted)
     * await storage.set(['config', 'settings'], { theme: 'dark' });
     *
     * // Store with 1-hour TTL
     * await storage.set(['cache', 'token'], 'abc123', 3600000);
     *
     * // Store complex object
     * await storage.set(['users', 'john'], {
     *     name: 'John Doe',
     *     email: 'john@example.com',
     *     roles: ['admin', 'user']
     * });
     * ```
     */
    set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean>;

    /**
     * Retrieves a value by its hierarchical key
     *
     * Returns null if:
     * - Key does not exist
     * - Entry has expired (and triggers deletion)
     * - Operation failed
     *
     * @typeParam T - Expected type of the stored value
     * @param key - Hierarchical key path
     * @returns Storage entry with metadata, or null if not found/expired
     *
     * @example
     * ```typescript
     * const entry = await storage.get<UserProfile>(['users', 'john']);
     *
     * if (entry) {
     *     console.log('User:', entry.data.name);
     *     console.log('Created:', new Date(entry.createdAt));
     *     console.log('Expires:', entry.expiresAt ? new Date(entry.expiresAt) : 'never');
     * } else {
     *     console.log('User not found or expired');
     * }
     * ```
     */
    get<T>(key: string[]): Promise<StorageEntry<T> | null>;

    /**
     * Deletes a value by its hierarchical key
     *
     * Returns true even if the key did not exist (idempotent).
     *
     * @param key - Hierarchical key path
     * @returns True if operation completed (regardless of whether key existed)
     *
     * @example
     * ```typescript
     * await storage.delete(['cache', 'outdated-data']);
     * await storage.delete(['users', 'deleted-user', 'profile']);
     * ```
     */
    delete(key: string[]): Promise<boolean>;

    /**
     * Lists entries matching the query options
     *
     * Supports filtering by prefix, pagination, and ordering.
     * Expired entries are automatically excluded.
     *
     * @typeParam T - Expected type of stored values
     * @param options - Query options for filtering and pagination
     * @returns Array of entries with their keys
     *
     * @example
     * ```typescript
     * // List all cache entries
     * const cacheEntries = await storage.list({
     *     prefix: ['cache']
     * });
     *
     * // List most recent 10 logs
     * const recentLogs = await storage.list({
     *     prefix: ['logs'],
     *     limit: 10,
     *     reverse: true
     * });
     *
     * // Process results
     * for (const { key, value } of cacheEntries) {
     *     console.log(`${key.join('/')}: ${JSON.stringify(value.data)}`);
     * }
     * ```
     */
    list<T>(options?: QueryOptions): Promise<Array<{ key: string[]; value: StorageEntry<T> }>>;

    /**
     * Clears all expired entries from storage
     *
     * Should be called periodically or configured for auto-cleanup.
     *
     * @returns Number of entries deleted
     *
     * @example
     * ```typescript
     * // Manual cleanup
     * const cleared = await storage.clearExpired();
     * console.log(`Cleared ${cleared} expired entries`);
     *
     * // Schedule regular cleanup
     * setInterval(async () => {
     *     await storage.clearExpired();
     * }, 300000); // Every 5 minutes
     * ```
     */
    clearExpired(): Promise<number>;

    /**
     * Gets storage statistics
     *
     * Returns metrics about storage usage including entry counts
     * and size estimates.
     *
     * @returns Storage statistics object
     *
     * @example
     * ```typescript
     * const stats = await storage.getStats();
     * console.log(`Total entries: ${stats.entryCount}`);
     * console.log(`Expired entries: ${stats.expiredCount}`);
     * console.log(`Size: ${(stats.sizeEstimate / 1024).toFixed(2)} KB`);
     *
     * // Alert if too many expired entries
     * if (stats.expiredCount > 1000) {
     *     await storage.clearExpired();
     * }
     * ```
     */
    getStats(): Promise<StorageStats>;

    // ========================================================================
    // Convenience Methods for Filter List Caching
    // ========================================================================

    /**
     * Stores a cache entry for a filter list download
     *
     * Convenience method optimized for filter list caching with
     * content hash and ETag support.
     *
     * @param source - Source URL or identifier
     * @param content - Array of filter rules
     * @param hash - Content hash for validation (e.g., SHA-256)
     * @param etag - Optional ETag from HTTP response
     * @param ttlMs - TTL in milliseconds (default: 1 hour)
     * @returns True if caching succeeded
     *
     * @example
     * ```typescript
     * const rules = ['||ad.example.com^', '||tracker.example.com^'];
     * const hash = await sha256(rules.join('\n'));
     *
     * await storage.cacheFilterList(
     *     'https://easylist.to/easylist/easylist.txt',
     *     rules,
     *     hash,
     *     response.headers.get('etag'),
     *     3600000 // 1 hour
     * );
     * ```
     */
    cacheFilterList(source: string, content: string[], hash: string, etag?: string, ttlMs?: number): Promise<boolean>;

    /**
     * Retrieves a cached filter list
     *
     * Returns null if not cached or expired.
     *
     * @param source - Source URL or identifier
     * @returns Cache entry with content, hash, and etag, or null
     *
     * @example
     * ```typescript
     * const cached = await storage.getCachedFilterList(sourceUrl);
     *
     * if (cached) {
     *     // Use cached content
     *     console.log(`Using ${cached.content.length} cached rules`);
     *     console.log(`Hash: ${cached.hash}`);
     *
     *     // Can use etag for conditional requests
     *     if (cached.etag) {
     *         headers['If-None-Match'] = cached.etag;
     *     }
     * } else {
     *     // Need to download fresh
     *     console.log('Cache miss, downloading...');
     * }
     * ```
     */
    getCachedFilterList(source: string): Promise<CacheEntry | null>;

    /**
     * Stores compilation metadata for history tracking
     *
     * Records information about a compilation run for auditing
     * and performance analysis.
     *
     * @param metadata - Compilation metadata to store
     * @returns True if storage succeeded
     *
     * @example
     * ```typescript
     * await storage.storeCompilationMetadata({
     *     configName: 'production-blocklist',
     *     timestamp: Date.now(),
     *     sourceCount: 10,
     *     ruleCount: 150000,
     *     duration: 5230, // ms
     *     outputPath: './output/blocklist.txt'
     * });
     * ```
     */
    storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean>;

    /**
     * Retrieves recent compilation metadata history
     *
     * Returns compilation records in reverse chronological order
     * (most recent first).
     *
     * @param configName - Configuration name to query
     * @param limit - Maximum number of results (default: 10)
     * @returns Array of compilation metadata records
     *
     * @example
     * ```typescript
     * const history = await storage.getCompilationHistory('production', 5);
     *
     * console.log('Recent compilations:');
     * for (const record of history) {
     *     console.log(`  ${new Date(record.timestamp).toISOString()}`);
     *     console.log(`    Rules: ${record.ruleCount}, Duration: ${record.duration}ms`);
     * }
     *
     * // Calculate average duration
     * const avgDuration = history.reduce((sum, r) => sum + r.duration, 0) / history.length;
     * console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);
     * ```
     */
    getCompilationHistory(configName: string, limit?: number): Promise<CompilationMetadata[]>;

    /**
     * Clears all cache entries
     *
     * Removes all entries from the cache namespace. Use with caution
     * as this will force re-downloading of all filter lists.
     *
     * @returns Number of entries deleted
     *
     * @example
     * ```typescript
     * // Full cache invalidation
     * const cleared = await storage.clearCache();
     * console.log(`Cleared ${cleared} cache entries`);
     *
     * // Use in maintenance scripts
     * if (process.argv.includes('--clear-cache')) {
     *     await storage.clearCache();
     * }
     * ```
     */
    clearCache(): Promise<number>;
}

/**
 * Storage adapter type identifier
 *
 * Used to specify which backend implementation to use.
 *
 * | Type | Backend | Description |
 * |------|---------|-------------|
 * | `prisma` | Prisma ORM | SQL/MongoDB databases (default, uses SQLite) |
 * | `d1` | Cloudflare D1 | Edge SQLite |
 * | `memory` | In-memory | Testing only |
 */
export type StorageAdapterType = 'prisma' | 'd1' | 'memory';

/**
 * Configuration options for storage adapters
 *
 * @example
 * ```typescript
 * const config: StorageAdapterConfig = {
 *     type: 'prisma',
 *     connectionString: 'postgresql://user:pass@localhost:5432/adblock',
 *     defaultTtlMs: 3600000,
 *     autoCleanup: true,
 *     cleanupIntervalMs: 300000
 * };
 *
 * const storage = new PrismaStorageAdapter(logger, config);
 * ```
 */
export interface StorageAdapterConfig {
    /**
     * Type of storage adapter to use
     *
     * @see StorageAdapterType for available options
     */
    type: StorageAdapterType;

    /**
     * Database connection string or path
     *
     * Format depends on adapter type:
     * - Prisma: Database URL (e.g., `file:./dev.db` for SQLite, `postgresql://user:pass@localhost:5432/db`)
     * - D1: Not applicable (uses Cloudflare binding)
     */
    connectionString?: string;

    /**
     * Default TTL for cache entries in milliseconds
     *
     * Applied when `cacheFilterList()` is called without explicit TTL.
     *
     * @default 3600000 (1 hour)
     */
    defaultTtlMs?: number;

    /**
     * Whether to automatically cleanup expired entries
     *
     * When enabled, the adapter will periodically call `clearExpired()`.
     *
     * @default false
     */
    autoCleanup?: boolean;

    /**
     * Interval between automatic cleanup runs in milliseconds
     *
     * Only applies when `autoCleanup` is true.
     *
     * @default 300000 (5 minutes)
     */
    cleanupIntervalMs?: number;
}

/**
 * Factory function type for creating storage adapters
 *
 * @example
 * ```typescript
 * const createStorage: StorageAdapterFactory = (config) => {
 *     switch (config.type) {
 *         case 'd1':
 *             return new D1StorageAdapter(env.DB, config);
 *         case 'prisma':
 *         default:
 *             return new PrismaStorageAdapter(logger, config);
 *     }
 * };
 *
 * const storage = createStorage({ type: 'prisma', connectionString: 'file:./dev.db' });
 * ```
 */
export type StorageAdapterFactory = (config: StorageAdapterConfig) => IStorageAdapter;
