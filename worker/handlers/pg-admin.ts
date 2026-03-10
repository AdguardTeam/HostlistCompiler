/**
 * PostgreSQL Admin Handlers (via Hyperdrive)
 *
 * Admin endpoints for the PostgreSQL backend. These complement the existing
 * D1 admin handlers in admin.ts. During the transition period, both sets
 * of endpoints are available:
 *
 *   /admin/storage/*     → D1 (SQLite)
 *   /admin/pg/*          → PostgreSQL (via Hyperdrive)
 *   /admin/backends      → Health status of both backends
 *
 * After full cutover, the D1 endpoints can be deprecated.
 */

import type { Env, HyperdriveBinding } from '../types.ts';
import { JsonResponse } from '../utils/response.ts';

// ============================================================================
// Types
// ============================================================================

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ============================================================================
// Backend Health
// ============================================================================

/**
 * GET /admin/backends
 *
 * Returns health and status of both D1 and PostgreSQL backends.
 * Useful during the migration to verify both are operational.
 */
export async function handleBackendStatus(
    env: Env,
    createPool?: PgPoolFactory,
): Promise<Response> {
    const status: {
        d1: { available: boolean; latencyMs?: number; error?: string };
        postgresql: { available: boolean; latencyMs?: number; host?: string; error?: string };
    } = {
        d1: { available: false },
        postgresql: { available: false },
    };

    // Check D1
    if (env.DB) {
        const start = Date.now();
        try {
            await env.DB.prepare('SELECT 1').first();
            status.d1 = { available: true, latencyMs: Date.now() - start };
        } catch (error) {
            status.d1 = {
                available: false,
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // Check PostgreSQL via Hyperdrive
    if (env.HYPERDRIVE && createPool) {
        const start = Date.now();
        try {
            const pool = createPool(env.HYPERDRIVE.connectionString);
            await pool.query('SELECT 1');
            status.postgresql = {
                available: true,
                latencyMs: Date.now() - start,
                host: env.HYPERDRIVE.host,
            };
        } catch (error) {
            status.postgresql = {
                available: false,
                latencyMs: Date.now() - start,
                host: env.HYPERDRIVE.host,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    return JsonResponse.success({
        backends: status,
        primary: env.HYPERDRIVE ? 'postgresql' : 'd1',
        timestamp: new Date().toISOString(),
    });
}

// ============================================================================
// PostgreSQL Storage Stats
// ============================================================================

/**
 * GET /admin/pg/stats
 *
 * Storage statistics from PostgreSQL (mirrors /admin/storage/stats for D1).
 */
export async function handlePgStorageStats(
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(hyperdrive.connectionString);

    try {
        const [storageRes, cacheRes, compilationRes, expiredStorageRes, expiredCacheRes, usersRes, apiKeysRes] = await Promise.all([
            pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM storage_entries`),
            pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM filter_cache`),
            pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM compilation_metadata`),
            pool.query<{ count: string }>(
                `SELECT COUNT(*) as count FROM storage_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
            ),
            pool.query<{ count: string }>(
                `SELECT COUNT(*) as count FROM filter_cache WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
            ),
            pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM users`),
            pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM api_keys WHERE revoked_at IS NULL`),
        ]);

        return JsonResponse.success({
            stats: {
                storage_entries: parseInt(storageRes.rows[0]?.count ?? '0', 10),
                filter_cache: parseInt(cacheRes.rows[0]?.count ?? '0', 10),
                compilation_metadata: parseInt(compilationRes.rows[0]?.count ?? '0', 10),
                expired_storage: parseInt(expiredStorageRes.rows[0]?.count ?? '0', 10),
                expired_cache: parseInt(expiredCacheRes.rows[0]?.count ?? '0', 10),
                users: parseInt(usersRes.rows[0]?.count ?? '0', 10),
                active_api_keys: parseInt(apiKeysRes.rows[0]?.count ?? '0', 10),
            },
            backend: 'postgresql',
            host: hyperdrive.host,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

// ============================================================================
// PostgreSQL Data Export
// ============================================================================

/**
 * GET /admin/pg/export
 *
 * Export data from PostgreSQL (mirrors /admin/storage/export for D1).
 */
export async function handlePgExport(
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(hyperdrive.connectionString);

    try {
        const [storageRes, cacheRes, compilationRes] = await Promise.all([
            pool.query(`SELECT key, data, "createdAt", "updatedAt", "expiresAt" FROM storage_entries LIMIT 1000`),
            pool.query(`SELECT source, hash, etag, "createdAt", "updatedAt", "expiresAt" FROM filter_cache LIMIT 100`),
            pool.query(
                `SELECT "configName", timestamp, "sourceCount", "ruleCount", duration, "outputPath"
                 FROM compilation_metadata ORDER BY timestamp DESC LIMIT 100`,
            ),
        ]);

        return JsonResponse.success({
            exportedAt: new Date().toISOString(),
            backend: 'postgresql',
            storage_entries: storageRes.rows,
            filter_cache: cacheRes.rows,
            compilation_metadata: compilationRes.rows,
        }, {
            headers: {
                'Content-Disposition': `attachment; filename="pg-export-${Date.now()}.json"`,
            },
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

// ============================================================================
// PostgreSQL Cache Management
// ============================================================================

/**
 * POST /admin/pg/clear-expired
 */
export async function handlePgClearExpired(
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(hyperdrive.connectionString);

    try {
        const [storageRes, cacheRes] = await Promise.all([
            pool.query(`DELETE FROM storage_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`),
            pool.query(`DELETE FROM filter_cache WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`),
        ]);

        const deleted = (storageRes.rowCount ?? 0) + (cacheRes.rowCount ?? 0);

        return JsonResponse.success({
            deleted,
            message: `Cleared ${deleted} expired entries from PostgreSQL`,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

/**
 * POST /admin/pg/clear-cache
 */
export async function handlePgClearCache(
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(hyperdrive.connectionString);

    try {
        const [storageRes, cacheRes] = await Promise.all([
            pool.query(`DELETE FROM storage_entries WHERE key LIKE 'cache/%'`),
            pool.query(`DELETE FROM filter_cache`),
        ]);

        const deleted = (storageRes.rowCount ?? 0) + (cacheRes.rowCount ?? 0);

        return JsonResponse.success({
            deleted,
            message: `Cleared ${deleted} cache entries from PostgreSQL`,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

/**
 * POST /admin/pg/query
 * Read-only SQL queries against PostgreSQL (for debugging).
 */
export async function handlePgQuery(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: { sql?: string };
    try {
        body = await request.json() as { sql?: string };
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    const { sql } = body;
    if (!sql || typeof sql !== 'string') {
        return JsonResponse.badRequest('Missing or invalid SQL query');
    }

    // Strip comments before validation to prevent bypass
    const sanitized = sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // multi-line comments
        .replace(/--[^\n]*/g, ' '); // single-line comments

    const normalizedSql = sanitized.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT')) {
        return JsonResponse.badRequest('Only SELECT queries are allowed');
    }

    const dangerousPatterns = [
        /;\s*(DELETE|UPDATE|INSERT|DROP|ALTER|CREATE|TRUNCATE)/i,
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(sanitized)) {
            return JsonResponse.badRequest('Query contains disallowed SQL statements');
        }
    }

    // Enforce row limit to prevent resource exhaustion
    const limitedSql = /\bLIMIT\b/i.test(sanitized) ? sql : `${sql} LIMIT 1000`;

    const pool = createPool(hyperdrive.connectionString);

    try {
        const result = await pool.query(limitedSql);
        return JsonResponse.success({
            rows: result.rows,
            rowCount: result.rows.length,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}
