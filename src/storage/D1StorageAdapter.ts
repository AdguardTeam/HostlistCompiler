/**
 * Cloudflare D1 Storage Adapter
 *
 * Storage backend implementation specifically optimized for Cloudflare D1,
 * Cloudflare's serverless SQLite database at the edge.
 *
 * This adapter can be used with or without Prisma:
 * - With Prisma: Use PrismaClient with @prisma/adapter-d1
 * - Direct D1: Use Cloudflare's D1 binding directly for maximum performance
 *
 * Installation:
 *   npm install @prisma/client @prisma/adapter-d1
 *
 * Usage in Cloudflare Workers:
 *   import { D1StorageAdapter } from './storage/D1StorageAdapter';
 *   const storage = new D1StorageAdapter(env.DB);
 */

import type { IStorageAdapter } from './IStorageAdapter.ts';
import type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './types.ts';

/**
 * Cloudflare D1 Database type
 * This matches the D1Database interface from @cloudflare/workers-types
 */
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta?: {
        duration: number;
        changes: number;
        last_row_id: number;
        rows_read: number;
        rows_written: number;
    };
}

interface D1ExecResult {
    count: number;
    duration: number;
}

/**
 * Logger interface for D1 adapter
 */
interface ID1Logger {
    debug?(message: string): void;
    info?(message: string): void;
    warn?(message: string): void;
    error?(message: string): void;
}

/**
 * Configuration options for D1 Storage Adapter
 */
export interface D1StorageConfig {
    /** Default TTL for cache entries in milliseconds (default: 1 hour) */
    defaultTtlMs?: number;
    /** Enable query logging */
    enableLogging?: boolean;
    /** Table name prefix (default: none) */
    tablePrefix?: string;
}

/**
 * Serializes a key array to a string for D1 storage
 */
function serializeKey(key: string[]): string {
    return key.join('/');
}

/**
 * Deserializes a key string back to an array
 */
function deserializeKey(key: string): string[] {
    return key.split('/');
}

/**
 * Generates a CUID-like unique ID
 */
function generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
}

/**
 * Cloudflare D1 Storage Adapter
 *
 * Provides the IStorageAdapter interface backed by Cloudflare D1,
 * enabling edge-first storage with global distribution.
 *
 * @example
 * ```typescript
 * // In a Cloudflare Worker
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const storage = new D1StorageAdapter(env.DB);
 *
 *     await storage.cacheFilterList(
 *       'https://example.com/filters.txt',
 *       ['||ad.example.com^'],
 *       'hash123'
 *     );
 *
 *     const cached = await storage.getCachedFilterList('https://example.com/filters.txt');
 *     return Response.json({ cached });
 *   }
 * };
 * ```
 */
export class D1StorageAdapter implements IStorageAdapter {
    private readonly db: D1Database;
    private readonly config: Required<D1StorageConfig>;
    private readonly logger?: ID1Logger;
    private _isOpen = false;

    /**
     * Creates a new D1StorageAdapter instance
     *
     * @param db - Cloudflare D1 database binding (env.DB)
     * @param config - Optional configuration
     * @param logger - Optional logger for debugging
     *
     * @example
     * ```typescript
     * const storage = new D1StorageAdapter(env.DB, {
     *   defaultTtlMs: 3600000,
     *   enableLogging: true
     * });
     * ```
     */
    constructor(db: D1Database, config: D1StorageConfig = {}, logger?: ID1Logger) {
        this.db = db;
        this.config = {
            defaultTtlMs: config.defaultTtlMs ?? 3600000,
            enableLogging: config.enableLogging ?? false,
            tablePrefix: config.tablePrefix ?? '',
        };
        this.logger = logger;
    }

    /**
     * Get table name with optional prefix
     */
    private table(name: string): string {
        return this.config.tablePrefix ? `${this.config.tablePrefix}_${name}` : name;
    }

    /**
     * Log a message if logging is enabled
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        if (this.config.enableLogging && this.logger?.[level]) {
            this.logger[level]!(message);
        }
    }

    /**
     * Opens the storage connection
     * For D1, this is a no-op as connections are managed by Cloudflare
     */
    async open(): Promise<void> {
        this._isOpen = true;
        this.log('info', 'D1 storage adapter initialized');
    }

    /**
     * Closes the storage connection
     * For D1, this is a no-op as connections are managed by Cloudflare
     */
    async close(): Promise<void> {
        this._isOpen = false;
        this.log('info', 'D1 storage adapter closed');
    }

    /**
     * Checks if storage is ready
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    // ========================================================================
    // Core Key-Value Operations
    // ========================================================================

    /**
     * Stores a value with the given key
     *
     * @param key - Hierarchical key path
     * @param value - Value to store (must be JSON-serializable)
     * @param ttlMs - Optional time-to-live in milliseconds
     * @returns True if successful
     *
     * @example
     * ```typescript
     * // Store with 1 hour TTL
     * await storage.set(['cache', 'user', '123'], userData, 3600000);
     *
     * // Store without TTL
     * await storage.set(['config', 'settings'], { theme: 'dark' });
     * ```
     */
    async set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean> {
        const serializedKey = serializeKey(key);
        const now = new Date();
        const expiresAt = ttlMs ? new Date(now.getTime() + ttlMs) : null;

        try {
            // Use INSERT OR REPLACE for upsert behavior
            await this.db
                .prepare(
                    `
                INSERT OR REPLACE INTO ${this.table('storage_entries')}
                (id, key, data, createdAt, updatedAt, expiresAt)
                VALUES (
                    COALESCE((SELECT id FROM ${this.table('storage_entries')} WHERE key = ?), ?),
                    ?, ?,
                    COALESCE((SELECT createdAt FROM ${this.table('storage_entries')} WHERE key = ?), ?),
                    ?, ?
                )
            `,
                )
                .bind(
                    serializedKey,
                    generateId(),
                    serializedKey,
                    JSON.stringify(value),
                    serializedKey,
                    now.toISOString(),
                    now.toISOString(),
                    expiresAt?.toISOString() ?? null,
                )
                .run();

            this.log('debug', `Stored entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to set key ${serializedKey}: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves a value by key
     *
     * @param key - Hierarchical key path
     * @returns Storage entry with metadata, or null if not found/expired
     *
     * @example
     * ```typescript
     * const entry = await storage.get<UserData>(['cache', 'user', '123']);
     * if (entry) {
     *   console.log(entry.data.name);
     *   console.log('Created:', new Date(entry.createdAt));
     * }
     * ```
     */
    async get<T>(key: string[]): Promise<StorageEntry<T> | null> {
        const serializedKey = serializeKey(key);

        try {
            const result = await this.db
                .prepare(
                    `
                SELECT data, createdAt, updatedAt, expiresAt, tags
                FROM ${this.table('storage_entries')}
                WHERE key = ?
            `,
                )
                .bind(serializedKey)
                .first<{
                    data: string;
                    createdAt: string;
                    updatedAt: string;
                    expiresAt: string | null;
                    tags: string | null;
                }>();

            if (!result) {
                return null;
            }

            // Check if expired
            if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
                this.log('debug', `Entry at key ${serializedKey} has expired`);
                await this.delete(key);
                return null;
            }

            const entry: StorageEntry<T> = {
                data: JSON.parse(result.data),
                createdAt: new Date(result.createdAt).getTime(),
                updatedAt: new Date(result.updatedAt).getTime(),
                expiresAt: result.expiresAt ? new Date(result.expiresAt).getTime() : undefined,
                tags: result.tags ? JSON.parse(result.tags) : undefined,
            };

            this.log('debug', `Retrieved entry at key: ${serializedKey}`);
            return entry;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get key ${serializedKey}: ${message}`);
            return null;
        }
    }

    /**
     * Deletes a value by key
     *
     * @param key - Hierarchical key path
     * @returns True if successful (including if key didn't exist)
     */
    async delete(key: string[]): Promise<boolean> {
        const serializedKey = serializeKey(key);

        try {
            await this.db.prepare(`DELETE FROM ${this.table('storage_entries')} WHERE key = ?`).bind(serializedKey).run();

            this.log('debug', `Deleted entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to delete key ${serializedKey}: ${message}`);
            return false;
        }
    }

    /**
     * Lists entries matching query options
     *
     * @param options - Query options (prefix, limit, reverse)
     * @returns Array of matching entries with their keys
     *
     * @example
     * ```typescript
     * // List all cache entries
     * const entries = await storage.list({ prefix: ['cache'] });
     *
     * // List most recent 10 logs
     * const logs = await storage.list({
     *   prefix: ['logs'],
     *   limit: 10,
     *   reverse: true
     * });
     * ```
     */
    async list<T>(options: QueryOptions = {}): Promise<Array<{ key: string[]; value: StorageEntry<T> }>> {
        const results: Array<{ key: string[]; value: StorageEntry<T> }> = [];

        try {
            let query = `
                SELECT key, data, createdAt, updatedAt, expiresAt, tags
                FROM ${this.table('storage_entries')}
                WHERE (expiresAt IS NULL OR expiresAt > datetime('now'))
            `;
            const params: unknown[] = [];

            // Add prefix filter
            if (options.prefix) {
                const prefixStr = serializeKey(options.prefix);
                query += ` AND key LIKE ?`;
                params.push(`${prefixStr}%`);
            }

            // Add range filters
            if (options.start) {
                query += ` AND key >= ?`;
                params.push(serializeKey(options.start));
            }
            if (options.end) {
                query += ` AND key <= ?`;
                params.push(serializeKey(options.end));
            }

            // Add ordering
            query += ` ORDER BY key ${options.reverse ? 'DESC' : 'ASC'}`;

            // Add limit
            if (options.limit) {
                query += ` LIMIT ?`;
                params.push(options.limit);
            }

            const stmt = this.db.prepare(query);
            const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;

            const response = await boundStmt.all<{
                key: string;
                data: string;
                createdAt: string;
                updatedAt: string;
                expiresAt: string | null;
                tags: string | null;
            }>();

            for (const row of response.results || []) {
                results.push({
                    key: deserializeKey(row.key),
                    value: {
                        data: JSON.parse(row.data),
                        createdAt: new Date(row.createdAt).getTime(),
                        updatedAt: new Date(row.updatedAt).getTime(),
                        expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : undefined,
                        tags: row.tags ? JSON.parse(row.tags) : undefined,
                    },
                });
            }

            this.log('debug', `Listed ${results.length} entries`);
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to list entries: ${message}`);
            return [];
        }
    }

    /**
     * Clears all expired entries
     *
     * @returns Number of entries deleted
     */
    async clearExpired(): Promise<number> {
        try {
            // Clear from storage_entries
            const storageResult = await this.db
                .prepare(
                    `
                DELETE FROM ${this.table('storage_entries')}
                WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')
            `,
                )
                .run();

            // Clear from filter_cache
            const cacheResult = await this.db
                .prepare(
                    `
                DELETE FROM ${this.table('filter_cache')}
                WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')
            `,
                )
                .run();

            const totalDeleted = (storageResult.meta?.changes || 0) + (cacheResult.meta?.changes || 0);

            this.log('info', `Cleared ${totalDeleted} expired entries`);
            return totalDeleted;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to clear expired entries: ${message}`);
            return 0;
        }
    }

    /**
     * Gets storage statistics
     *
     * @returns Statistics including entry count, expired count, and size estimate
     */
    async getStats(): Promise<StorageStats> {
        try {
            const [totalResult, expiredResult, sizeResult] = await this.db.batch([
                this.db.prepare(`SELECT COUNT(*) as count FROM ${this.table('storage_entries')}`),
                this.db.prepare(`
                    SELECT COUNT(*) as count FROM ${this.table('storage_entries')}
                    WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')
                `),
                this.db.prepare(`SELECT SUM(LENGTH(data)) as size FROM ${this.table('storage_entries')}`),
            ]);

            return {
                entryCount: ((totalResult.results as Array<{ count: number }>) || [])[0]?.count || 0,
                expiredCount: ((expiredResult.results as Array<{ count: number }>) || [])[0]?.count || 0,
                sizeEstimate: ((sizeResult.results as Array<{ size: number }>) || [])[0]?.size || 0,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get stats: ${message}`);
            return { entryCount: 0, expiredCount: 0, sizeEstimate: 0 };
        }
    }

    // ========================================================================
    // Filter List Caching Methods
    // ========================================================================

    /**
     * Caches a filter list with metadata
     *
     * @param source - Source URL or identifier
     * @param content - Array of filter rules
     * @param hash - Content hash for validation
     * @param etag - Optional ETag from HTTP response
     * @param ttlMs - TTL in milliseconds (default: 1 hour)
     * @returns True if successful
     *
     * @example
     * ```typescript
     * await storage.cacheFilterList(
     *   'https://easylist.to/easylist/easylist.txt',
     *   filterRules,
     *   'sha256-abc123',
     *   'W/"123456"',
     *   3600000 // 1 hour
     * );
     * ```
     */
    async cacheFilterList(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
        ttlMs: number = this.config.defaultTtlMs,
    ): Promise<boolean> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        try {
            await this.db
                .prepare(
                    `
                INSERT OR REPLACE INTO ${this.table('filter_cache')}
                (id, source, content, hash, etag, createdAt, updatedAt, expiresAt)
                VALUES (
                    COALESCE((SELECT id FROM ${this.table('filter_cache')} WHERE source = ?), ?),
                    ?, ?, ?, ?,
                    COALESCE((SELECT createdAt FROM ${this.table('filter_cache')} WHERE source = ?), ?),
                    ?, ?
                )
            `,
                )
                .bind(
                    source,
                    generateId(),
                    source,
                    JSON.stringify(content),
                    hash,
                    etag ?? null,
                    source,
                    now.toISOString(),
                    now.toISOString(),
                    expiresAt.toISOString(),
                )
                .run();

            this.log('debug', `Cached filter list for source: ${source}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to cache filter list: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves a cached filter list
     *
     * @param source - Source URL or identifier
     * @returns Cache entry or null if not found/expired
     *
     * @example
     * ```typescript
     * const cached = await storage.getCachedFilterList('https://easylist.to/easylist.txt');
     * if (cached) {
     *   console.log(`Loaded ${cached.content.length} rules from cache`);
     *   console.log(`Hash: ${cached.hash}`);
     * }
     * ```
     */
    async getCachedFilterList(source: string): Promise<CacheEntry | null> {
        try {
            const result = await this.db
                .prepare(
                    `
                SELECT source, content, hash, etag, expiresAt
                FROM ${this.table('filter_cache')}
                WHERE source = ?
            `,
                )
                .bind(source)
                .first<{
                    source: string;
                    content: string;
                    hash: string;
                    etag: string | null;
                    expiresAt: string | null;
                }>();

            if (!result) {
                return null;
            }

            // Check if expired
            if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
                this.log('debug', `Filter cache for ${source} has expired`);
                await this.db.prepare(`DELETE FROM ${this.table('filter_cache')} WHERE source = ?`).bind(source).run();
                return null;
            }

            return {
                source: result.source,
                content: JSON.parse(result.content),
                hash: result.hash,
                etag: result.etag ?? undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get cached filter list: ${message}`);
            return null;
        }
    }

    /**
     * Stores compilation metadata record
     *
     * @param metadata - Compilation metadata to store
     * @returns True if successful
     */
    async storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean> {
        try {
            await this.db
                .prepare(
                    `
                INSERT INTO ${this.table('compilation_metadata')}
                (id, configName, timestamp, sourceCount, ruleCount, duration, outputPath)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
                )
                .bind(
                    generateId(),
                    metadata.configName,
                    new Date(metadata.timestamp).toISOString(),
                    metadata.sourceCount,
                    metadata.ruleCount,
                    metadata.duration,
                    metadata.outputPath ?? null,
                )
                .run();

            this.log('debug', `Stored compilation metadata for: ${metadata.configName}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to store compilation metadata: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves compilation history for a config
     *
     * @param configName - Configuration name to query
     * @param limit - Maximum number of records (default: 10)
     * @returns Array of compilation metadata, most recent first
     */
    async getCompilationHistory(configName: string, limit: number = 10): Promise<CompilationMetadata[]> {
        try {
            const result = await this.db
                .prepare(
                    `
                SELECT configName, timestamp, sourceCount, ruleCount, duration, outputPath
                FROM ${this.table('compilation_metadata')}
                WHERE configName = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `,
                )
                .bind(configName, limit)
                .all<{
                    configName: string;
                    timestamp: string;
                    sourceCount: number;
                    ruleCount: number;
                    duration: number;
                    outputPath: string | null;
                }>();

            return (result.results || []).map((r) => ({
                configName: r.configName,
                timestamp: new Date(r.timestamp).getTime(),
                sourceCount: r.sourceCount,
                ruleCount: r.ruleCount,
                duration: r.duration,
                outputPath: r.outputPath ?? undefined,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get compilation history: ${message}`);
            return [];
        }
    }

    /**
     * Clears all cache entries
     *
     * @returns Number of entries cleared
     */
    async clearCache(): Promise<number> {
        try {
            const [storageResult, cacheResult] = await this.db.batch([
                this.db.prepare(`DELETE FROM ${this.table('storage_entries')} WHERE key LIKE 'cache/%'`),
                this.db.prepare(`DELETE FROM ${this.table('filter_cache')}`),
            ]);

            const totalCleared = (storageResult.meta?.changes || 0) + (cacheResult.meta?.changes || 0);

            this.log('info', `Cleared ${totalCleared} cache entries`);
            return totalCleared;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to clear cache: ${message}`);
            return 0;
        }
    }

    // ========================================================================
    // D1-Specific Utility Methods
    // ========================================================================

    /**
     * Executes a raw SQL query (D1-specific)
     *
     * Use with caution - prefer the typed methods above.
     *
     * @param sql - SQL query string
     * @param params - Query parameters
     * @returns Query results
     */
    async rawQuery<T>(sql: string, ...params: unknown[]): Promise<T[]> {
        const stmt = this.db.prepare(sql);
        const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await boundStmt.all<T>();
        return result.results || [];
    }

    /**
     * Executes multiple statements in a batch (D1-specific)
     *
     * More efficient than executing statements individually.
     *
     * @param statements - Array of { sql, params } objects
     * @returns Array of results
     */
    async batchExecute(statements: Array<{ sql: string; params?: unknown[] }>): Promise<D1Result[]> {
        const prepared = statements.map(({ sql, params }) => {
            const stmt = this.db.prepare(sql);
            return params && params.length > 0 ? stmt.bind(...params) : stmt;
        });

        return this.db.batch(prepared);
    }

    /**
     * Gets D1 database info (D1-specific)
     *
     * @returns Database dump as ArrayBuffer
     */
    async getDatabaseDump(): Promise<ArrayBuffer> {
        return this.db.dump();
    }
}

/**
 * Creates D1 storage adapter from Cloudflare Worker environment
 *
 * @param env - Cloudflare Worker environment with DB binding
 * @param config - Optional configuration
 * @returns Configured D1StorageAdapter
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const storage = createD1Storage(env);
 *     // ... use storage
 *   }
 * };
 * ```
 */
export function createD1Storage(env: { DB: D1Database }, config?: D1StorageConfig): D1StorageAdapter {
    return new D1StorageAdapter(env.DB, config);
}
