/**
 * Cloudflare Hyperdrive Storage Adapter
 *
 * Storage backend implementation for PostgreSQL via Cloudflare Hyperdrive.
 * Connects to PlanetScale PostgreSQL through Hyperdrive's connection pooler,
 * providing accelerated database access from Cloudflare Workers.
 *
 * This is the L2 (source of truth) storage tier in the multi-tier architecture:
 *   L0: KV (hot cache, edge)
 *   L1: D1 (SQLite, edge read replica)
 *   L2: Hyperdrive -> PlanetScale PostgreSQL (this adapter)
 *   L3: R2 (blob storage)
 *
 * Uses node-postgres (pg) driver which is supported in Cloudflare Workers
 * via the `node_compat` compatibility flag.
 */

import type { IStorageAdapter } from './IStorageAdapter.ts';
import type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './types.ts';
import type {
    CreateApiKey,
    CreateCompilationEvent,
    CreateCompiledOutput,
    CreateFilterListVersion,
    CreateFilterSource,
    CreateSession,
    CreateSourceChangeEvent,
    CreateSourceHealthSnapshot,
    CreateUser,
} from './schemas.ts';
import {
    CreateApiKeySchema,
    CreateCompilationEventSchema,
    CreateCompiledOutputSchema,
    CreateFilterListVersionSchema,
    CreateFilterSourceSchema,
    CreateSessionSchema,
    CreateSourceChangeEventSchema,
    CreateSourceHealthSnapshotSchema,
    CreateUserSchema,
} from './schemas.ts';

// ============================================================================
// Types
// ============================================================================

/**
 * Cloudflare Hyperdrive binding type.
 * Matches the Hyperdrive interface from @cloudflare/workers-types.
 */
export interface HyperdriveBinding {
    connectionString: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

/**
 * Minimal pg Pool-compatible interface.
 * Avoids importing pg types directly — injected at runtime.
 */
interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>;
    end(): Promise<void>;
}

interface PgQueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number | null;
}

/**
 * Factory function type for creating a pg Pool.
 * Injected to avoid hard dependency on pg in environments that don't have it.
 */
export type PgPoolFactory = (connectionString: string) => PgPool;

/**
 * Configuration options for Hyperdrive Storage Adapter
 */
export interface HyperdriveStorageConfig {
    /** Default TTL for cache entries in milliseconds (default: 1 hour) */
    defaultTtlMs?: number;
    /** Enable query logging */
    enableLogging?: boolean;
}

/**
 * Logger interface for Hyperdrive adapter
 */
interface IHyperdriveLogger {
    debug?(message: string): void;
    info?(message: string): void;
    warn?(message: string): void;
    error?(message: string): void;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

/**
 * Hyperdrive-backed PostgreSQL storage adapter.
 *
 * Implements `IStorageAdapter` for backward compatibility with existing
 * storage consumers (KV-style operations, filter caching, compilation metadata).
 *
 * Also provides domain-specific methods for the new PostgreSQL models:
 * users, API keys, sessions, filter sources, compiled outputs, etc.
 *
 * @example
 * ```typescript
 * // In a Cloudflare Worker
 * import { Pool } from 'pg';
 *
 * const adapter = new HyperdriveStorageAdapter(
 *     env.HYPERDRIVE,
 *     (connStr) => new Pool({ connectionString: connStr }),
 *     { enableLogging: true },
 *     console,
 * );
 * await adapter.open();
 * ```
 */
export class HyperdriveStorageAdapter implements IStorageAdapter {
    private pool: PgPool | null = null;
    private readonly hyperdrive: HyperdriveBinding;
    private readonly createPool: PgPoolFactory;
    private readonly config: Required<HyperdriveStorageConfig>;
    private readonly logger?: IHyperdriveLogger;
    private _isOpen = false;

    constructor(
        hyperdrive: HyperdriveBinding,
        createPool: PgPoolFactory,
        config: HyperdriveStorageConfig = {},
        logger?: IHyperdriveLogger,
    ) {
        this.hyperdrive = hyperdrive;
        this.createPool = createPool;
        this.config = {
            defaultTtlMs: config.defaultTtlMs ?? 3600000,
            enableLogging: config.enableLogging ?? false,
        };
        this.logger = logger;
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        if (this.config.enableLogging && this.logger?.[level]) {
            this.logger[level]!(message);
        }
    }

    private ensureOpen(): PgPool {
        if (!this.pool || !this._isOpen) {
            throw new Error('Storage not initialized. Call open() first.');
        }
        return this.pool;
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    async open(): Promise<void> {
        if (this._isOpen) return;

        this.pool = this.createPool(this.hyperdrive.connectionString);
        this._isOpen = true;
        this.log('info', `Hyperdrive storage opened (host: ${this.hyperdrive.host})`);
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this._isOpen = false;
            this.log('info', 'Hyperdrive storage closed');
        }
    }

    isOpen(): boolean {
        return this._isOpen;
    }

    // ========================================================================
    // IStorageAdapter — Core Key-Value Operations
    // ========================================================================

    async set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean> {
        const pool = this.ensureOpen();
        const serializedKey = key.join('/');
        const now = new Date();
        const expiresAt = ttlMs ? new Date(now.getTime() + ttlMs) : null;

        try {
            await pool.query(
                `INSERT INTO storage_entries (key, data, "createdAt", "updatedAt", "expiresAt")
                 VALUES ($1, $2, $3, $3, $4)
                 ON CONFLICT (key) DO UPDATE SET
                     data = EXCLUDED.data,
                     "updatedAt" = EXCLUDED."updatedAt",
                     "expiresAt" = EXCLUDED."expiresAt"`,
                [serializedKey, JSON.stringify(value), now.toISOString(), expiresAt?.toISOString() ?? null],
            );
            this.log('debug', `Stored entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to set key ${serializedKey}: ${message}`);
            return false;
        }
    }

    async get<T>(key: string[]): Promise<StorageEntry<T> | null> {
        const pool = this.ensureOpen();
        const serializedKey = key.join('/');

        try {
            const result = await pool.query<{
                data: string;
                createdAt: string;
                updatedAt: string;
                expiresAt: string | null;
                tags: string | null;
            }>(
                `SELECT data, "createdAt", "updatedAt", "expiresAt", tags
                 FROM storage_entries
                 WHERE key = $1`,
                [serializedKey],
            );

            if (result.rows.length === 0) return null;

            const row = result.rows[0];

            // Check if expired
            if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
                this.log('debug', `Entry at key ${serializedKey} has expired`);
                await this.delete(key);
                return null;
            }

            return {
                data: JSON.parse(row.data),
                createdAt: new Date(row.createdAt).getTime(),
                updatedAt: new Date(row.updatedAt).getTime(),
                expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : undefined,
                tags: row.tags ? JSON.parse(row.tags) : undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get key ${serializedKey}: ${message}`);
            return null;
        }
    }

    async delete(key: string[]): Promise<boolean> {
        const pool = this.ensureOpen();
        const serializedKey = key.join('/');

        try {
            await pool.query(`DELETE FROM storage_entries WHERE key = $1`, [serializedKey]);
            this.log('debug', `Deleted entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to delete key ${serializedKey}: ${message}`);
            return false;
        }
    }

    async list<T>(options: QueryOptions = {}): Promise<Array<{ key: string[]; value: StorageEntry<T> }>> {
        const pool = this.ensureOpen();

        try {
            const conditions: string[] = [`("expiresAt" IS NULL OR "expiresAt" > NOW())`];
            const params: unknown[] = [];
            let paramIdx = 1;

            if (options.prefix) {
                conditions.push(`key LIKE $${paramIdx}`);
                params.push(`${options.prefix.join('/')}%`);
                paramIdx++;
            }
            if (options.start) {
                conditions.push(`key >= $${paramIdx}`);
                params.push(options.start.join('/'));
                paramIdx++;
            }
            if (options.end) {
                conditions.push(`key <= $${paramIdx}`);
                params.push(options.end.join('/'));
                paramIdx++;
            }

            let query = `SELECT key, data, "createdAt", "updatedAt", "expiresAt", tags
                         FROM storage_entries
                         WHERE ${conditions.join(' AND ')}
                         ORDER BY key ${options.reverse ? 'DESC' : 'ASC'}`;

            if (options.limit) {
                query += ` LIMIT $${paramIdx}`;
                params.push(options.limit);
            }

            const result = await pool.query<{
                key: string;
                data: string;
                createdAt: string;
                updatedAt: string;
                expiresAt: string | null;
                tags: string | null;
            }>(query, params);

            return result.rows.map((row) => ({
                key: row.key.split('/'),
                value: {
                    data: JSON.parse(row.data),
                    createdAt: new Date(row.createdAt).getTime(),
                    updatedAt: new Date(row.updatedAt).getTime(),
                    expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : undefined,
                    tags: row.tags ? JSON.parse(row.tags) : undefined,
                },
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to list entries: ${message}`);
            return [];
        }
    }

    async clearExpired(): Promise<number> {
        const pool = this.ensureOpen();

        try {
            const r1 = await pool.query(
                `DELETE FROM storage_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
            );
            const r2 = await pool.query(
                `DELETE FROM filter_cache WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
            );
            const total = (r1.rowCount ?? 0) + (r2.rowCount ?? 0);
            this.log('info', `Cleared ${total} expired entries`);
            return total;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to clear expired entries: ${message}`);
            return 0;
        }
    }

    async getStats(): Promise<StorageStats> {
        const pool = this.ensureOpen();

        try {
            const [totalRes, expiredRes, sizeRes] = await Promise.all([
                pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM storage_entries`),
                pool.query<{ count: string }>(
                    `SELECT COUNT(*) as count FROM storage_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
                ),
                pool.query<{ size: string | null }>(
                    `SELECT SUM(LENGTH(data)) as size FROM storage_entries`,
                ),
            ]);

            return {
                entryCount: parseInt(totalRes.rows[0]?.count ?? '0', 10),
                expiredCount: parseInt(expiredRes.rows[0]?.count ?? '0', 10),
                sizeEstimate: parseInt(sizeRes.rows[0]?.size ?? '0', 10),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get stats: ${message}`);
            return { entryCount: 0, expiredCount: 0, sizeEstimate: 0 };
        }
    }

    // ========================================================================
    // IStorageAdapter — Filter List Caching
    // ========================================================================

    async cacheFilterList(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
        ttlMs: number = this.config.defaultTtlMs,
    ): Promise<boolean> {
        const pool = this.ensureOpen();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        try {
            await pool.query(
                `INSERT INTO filter_cache (source, content, hash, etag, "createdAt", "updatedAt", "expiresAt")
                 VALUES ($1, $2, $3, $4, $5, $5, $6)
                 ON CONFLICT (source) DO UPDATE SET
                     content = EXCLUDED.content,
                     hash = EXCLUDED.hash,
                     etag = EXCLUDED.etag,
                     "updatedAt" = EXCLUDED."updatedAt",
                     "expiresAt" = EXCLUDED."expiresAt"`,
                [source, JSON.stringify(content), hash, etag ?? null, now.toISOString(), expiresAt.toISOString()],
            );
            this.log('debug', `Cached filter list for source: ${source}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to cache filter list: ${message}`);
            return false;
        }
    }

    async getCachedFilterList(source: string): Promise<CacheEntry | null> {
        const pool = this.ensureOpen();

        try {
            const result = await pool.query<{
                source: string;
                content: string;
                hash: string;
                etag: string | null;
                expiresAt: string | null;
            }>(
                `SELECT source, content, hash, etag, "expiresAt"
                 FROM filter_cache WHERE source = $1`,
                [source],
            );

            if (result.rows.length === 0) return null;

            const row = result.rows[0];
            if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
                this.log('debug', `Filter cache for ${source} has expired`);
                await pool.query(`DELETE FROM filter_cache WHERE source = $1`, [source]);
                return null;
            }

            return {
                source: row.source,
                content: JSON.parse(row.content),
                hash: row.hash,
                etag: row.etag ?? undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to get cached filter list: ${message}`);
            return null;
        }
    }

    async storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean> {
        const pool = this.ensureOpen();

        try {
            await pool.query(
                `INSERT INTO compilation_metadata ("configName", timestamp, "sourceCount", "ruleCount", duration, "outputPath")
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    metadata.configName,
                    new Date(metadata.timestamp).toISOString(),
                    metadata.sourceCount,
                    metadata.ruleCount,
                    metadata.duration,
                    metadata.outputPath ?? null,
                ],
            );
            this.log('debug', `Stored compilation metadata for: ${metadata.configName}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to store compilation metadata: ${message}`);
            return false;
        }
    }

    async getCompilationHistory(configName: string, limit: number = 10): Promise<CompilationMetadata[]> {
        const pool = this.ensureOpen();

        try {
            const result = await pool.query<{
                configName: string;
                timestamp: string;
                sourceCount: number;
                ruleCount: number;
                duration: number;
                outputPath: string | null;
            }>(
                `SELECT "configName", timestamp, "sourceCount", "ruleCount", duration, "outputPath"
                 FROM compilation_metadata
                 WHERE "configName" = $1
                 ORDER BY timestamp DESC
                 LIMIT $2`,
                [configName, limit],
            );

            return result.rows.map((r) => ({
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

    async clearCache(): Promise<number> {
        const pool = this.ensureOpen();

        try {
            const r1 = await pool.query(`DELETE FROM storage_entries WHERE key LIKE 'cache/%'`);
            const r2 = await pool.query(`DELETE FROM filter_cache`);
            const total = (r1.rowCount ?? 0) + (r2.rowCount ?? 0);
            this.log('info', `Cleared ${total} cache entries`);
            return total;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to clear cache: ${message}`);
            return 0;
        }
    }

    // ========================================================================
    // Domain-Specific Operations (New PostgreSQL Models)
    // ========================================================================

    /**
     * Creates a user record.
     */
    async createUser(data: CreateUser): Promise<{ id: string }> {
        const validated = CreateUserSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO users (email, display_name, role)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [validated.email, validated.displayName ?? null, validated.role],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Finds a user by email.
     */
    async getUserByEmail(email: string): Promise<{ id: string; email: string; role: string } | null> {
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string; email: string; role: string }>(
            `SELECT id, email, role FROM users WHERE email = $1`,
            [email],
        );
        return result.rows[0] ?? null;
    }

    /**
     * Creates an API key record.
     */
    async createApiKey(data: CreateApiKey): Promise<{ id: string }> {
        const validated = CreateApiKeySchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, rate_limit_per_minute, expires_at)
             VALUES ($1, $2, '', '', $3, $4, $5)
             RETURNING id`,
            [
                validated.userId,
                validated.name,
                validated.scopes,
                validated.rateLimitPerMinute,
                validated.expiresAt?.toISOString() ?? null,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Creates a session record.
     */
    async createSession(data: CreateSession): Promise<{ id: string }> {
        const validated = CreateSessionSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                validated.userId,
                validated.tokenHash,
                validated.ipAddress ?? null,
                validated.userAgent ?? null,
                validated.expiresAt.toISOString(),
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Creates a filter source record.
     */
    async createFilterSource(data: CreateFilterSource): Promise<{ id: string }> {
        const validated = CreateFilterSourceSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO filter_sources (url, name, description, homepage, license, is_public, owner_user_id, refresh_interval_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                validated.url,
                validated.name,
                validated.description ?? null,
                validated.homepage ?? null,
                validated.license ?? null,
                validated.isPublic,
                validated.ownerUserId ?? null,
                validated.refreshIntervalSeconds,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Lists all filter sources, optionally filtering by public visibility.
     */
    async listFilterSources(publicOnly = false): Promise<Array<{ id: string; url: string; name: string; isPublic: boolean }>> {
        const pool = this.ensureOpen();
        const query = publicOnly
            ? `SELECT id, url, name, is_public FROM filter_sources WHERE is_public = true ORDER BY name`
            : `SELECT id, url, name, is_public FROM filter_sources ORDER BY name`;
        const result = await pool.query<{ id: string; url: string; name: string; is_public: boolean }>(query);
        return result.rows.map((r) => ({ id: r.id, url: r.url, name: r.name, isPublic: r.is_public }));
    }

    /**
     * Creates a filter list version record.
     */
    async createFilterListVersion(data: CreateFilterListVersion): Promise<{ id: string }> {
        const validated = CreateFilterListVersionSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO filter_list_versions (source_id, content_hash, rule_count, etag, r2_key, expires_at, is_current)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                validated.sourceId,
                validated.contentHash,
                validated.ruleCount,
                validated.etag ?? null,
                validated.r2Key,
                validated.expiresAt?.toISOString() ?? null,
                validated.isCurrent,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Creates a compiled output record.
     */
    async createCompiledOutput(data: CreateCompiledOutput): Promise<{ id: string }> {
        const validated = CreateCompiledOutputSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO compiled_outputs (config_hash, config_name, config_snapshot, rule_count, source_count, duration_ms, r2_key, owner_user_id, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
                validated.configHash,
                validated.configName,
                JSON.stringify(validated.configSnapshot),
                validated.ruleCount,
                validated.sourceCount,
                validated.durationMs,
                validated.r2Key,
                validated.ownerUserId ?? null,
                validated.expiresAt?.toISOString() ?? null,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Finds a compiled output by config hash (cache lookup).
     */
    async getCompiledOutputByHash(configHash: string): Promise<{ id: string; r2Key: string; ruleCount: number } | null> {
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string; r2_key: string; rule_count: number }>(
            `SELECT id, r2_key, rule_count FROM compiled_outputs
             WHERE config_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC LIMIT 1`,
            [configHash],
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return { id: row.id, r2Key: row.r2_key, ruleCount: row.rule_count };
    }

    /**
     * Records a compilation event (audit log).
     */
    async createCompilationEvent(data: CreateCompilationEvent): Promise<{ id: string }> {
        const validated = CreateCompilationEventSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO compilation_events (compiled_output_id, user_id, api_key_id, request_source, worker_region, duration_ms, cache_hit, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                validated.compiledOutputId ?? null,
                validated.userId ?? null,
                validated.apiKeyId ?? null,
                validated.requestSource,
                validated.workerRegion ?? null,
                validated.durationMs,
                validated.cacheHit,
                validated.errorMessage ?? null,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Creates a source health snapshot.
     */
    async createSourceHealthSnapshot(data: CreateSourceHealthSnapshot): Promise<{ id: string }> {
        const validated = CreateSourceHealthSnapshotSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO source_health_snapshots (source_id, status, total_attempts, successful_attempts, failed_attempts, consecutive_failures, avg_duration_ms, avg_rule_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                validated.sourceId,
                validated.status,
                validated.totalAttempts,
                validated.successfulAttempts,
                validated.failedAttempts,
                validated.consecutiveFailures,
                validated.avgDurationMs,
                validated.avgRuleCount,
            ],
        );
        return { id: result.rows[0].id };
    }

    /**
     * Records a source change event.
     */
    async createSourceChangeEvent(data: CreateSourceChangeEvent): Promise<{ id: string }> {
        const validated = CreateSourceChangeEventSchema.parse(data);
        const pool = this.ensureOpen();
        const result = await pool.query<{ id: string }>(
            `INSERT INTO source_change_events (source_id, previous_version_id, new_version_id, rule_count_delta, content_hash_changed)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                validated.sourceId,
                validated.previousVersionId ?? null,
                validated.newVersionId,
                validated.ruleCountDelta,
                validated.contentHashChanged,
            ],
        );
        return { id: result.rows[0].id };
    }

    // ========================================================================
    // PostgreSQL-Specific Utility Methods
    // ========================================================================

    /**
     * Executes a raw SQL query against PostgreSQL via Hyperdrive.
     * Use with caution — prefer the typed methods above.
     */
    async rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
        const pool = this.ensureOpen();
        const result = await pool.query<T>(sql, params);
        return result.rows;
    }

    /**
     * Health check — verifies connectivity to PlanetScale via Hyperdrive.
     */
    async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
        const pool = this.ensureOpen();
        const start = Date.now();
        try {
            await pool.query('SELECT 1');
            return { ok: true, latencyMs: Date.now() - start };
        } catch {
            return { ok: false, latencyMs: Date.now() - start };
        }
    }
}

/**
 * Creates a Hyperdrive storage adapter from Cloudflare Worker environment.
 *
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 *
 * const storage = createHyperdriveStorage(
 *     env.HYPERDRIVE,
 *     (connStr) => new Pool({ connectionString: connStr }),
 * );
 * await storage.open();
 * ```
 */
export function createHyperdriveStorage(
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
    config?: HyperdriveStorageConfig,
    logger?: IHyperdriveLogger,
): HyperdriveStorageAdapter {
    return new HyperdriveStorageAdapter(hyperdrive, createPool, config, logger);
}
