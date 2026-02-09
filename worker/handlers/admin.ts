/**
 * Admin handlers for the Cloudflare Worker.
 * Provides storage management and database administration endpoints.
 */

import { JsonResponse } from '../utils/index.ts';
import type { AdminQueryRequest, Env, StorageStats, TableInfo } from '../types.ts';

// ============================================================================
// Storage Statistics
// ============================================================================

/**
 * Handle GET /admin/storage/stats request.
 */
export async function handleAdminStorageStats(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const [storageCount, filterCacheCount, compilationCount, expiredStorage, expiredCache] = await env.DB.batch([
            env.DB.prepare(`SELECT COUNT(*) as count FROM storage_entries`),
            env.DB.prepare(`SELECT COUNT(*) as count FROM filter_cache`),
            env.DB.prepare(`SELECT COUNT(*) as count FROM compilation_metadata`),
            env.DB.prepare(`SELECT COUNT(*) as count FROM storage_entries WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')`),
            env.DB.prepare(`SELECT COUNT(*) as count FROM filter_cache WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')`),
        ]);

        const stats: StorageStats = {
            storage_entries: ((storageCount.results as Array<{ count: number }>) || [])[0]?.count || 0,
            filter_cache: ((filterCacheCount.results as Array<{ count: number }>) || [])[0]?.count || 0,
            compilation_metadata: ((compilationCount.results as Array<{ count: number }>) || [])[0]?.count || 0,
            expired_storage: ((expiredStorage.results as Array<{ count: number }>) || [])[0]?.count || 0,
            expired_cache: ((expiredCache.results as Array<{ count: number }>) || [])[0]?.count || 0,
        };

        return JsonResponse.success({
            stats,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Handle POST /admin/storage/clear-expired request.
 */
export async function handleAdminClearExpired(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const [storageResult, cacheResult] = await env.DB.batch([
            env.DB.prepare(`DELETE FROM storage_entries WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')`),
            env.DB.prepare(`DELETE FROM filter_cache WHERE expiresAt IS NOT NULL AND expiresAt < datetime('now')`),
        ]);

        const deleted = (storageResult.meta?.changes || 0) + (cacheResult.meta?.changes || 0);

        return JsonResponse.success({
            deleted,
            message: `Cleared ${deleted} expired entries`,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

/**
 * Handle POST /admin/storage/clear-cache request.
 */
export async function handleAdminClearCache(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const [storageResult, cacheResult] = await env.DB.batch([
            env.DB.prepare(`DELETE FROM storage_entries WHERE key LIKE 'cache/%'`),
            env.DB.prepare(`DELETE FROM filter_cache`),
        ]);

        const deleted = (storageResult.meta?.changes || 0) + (cacheResult.meta?.changes || 0);

        return JsonResponse.success({
            deleted,
            message: `Cleared ${deleted} cache entries`,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

// ============================================================================
// Data Export/Import
// ============================================================================

/**
 * Handle GET /admin/storage/export request.
 */
export async function handleAdminExport(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const [storageEntries, filterCache, compilationMetadata] = await env.DB.batch([
            env.DB.prepare(`SELECT * FROM storage_entries LIMIT 1000`),
            env.DB.prepare(`SELECT * FROM filter_cache LIMIT 100`),
            env.DB.prepare(`SELECT * FROM compilation_metadata ORDER BY timestamp DESC LIMIT 100`),
        ]);

        const exportData = {
            exportedAt: new Date().toISOString(),
            storage_entries: storageEntries.results || [],
            filter_cache: filterCache.results || [],
            compilation_metadata: compilationMetadata.results || [],
        };

        return JsonResponse.success(exportData, {
            headers: {
                'Content-Disposition': `attachment; filename="storage-export-${Date.now()}.json"`,
            },
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

// ============================================================================
// Database Maintenance
// ============================================================================

/**
 * Handle POST /admin/storage/vacuum request.
 */
export async function handleAdminVacuum(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        await env.DB.exec('VACUUM');

        return JsonResponse.success({
            message: 'Database vacuum completed',
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

/**
 * Handle GET /admin/storage/tables request.
 */
export async function handleAdminListTables(env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const result = await env.DB
            .prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name`)
            .all<TableInfo>();

        return JsonResponse.success({
            tables: result.results || [],
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}

/**
 * Handle POST /admin/storage/query request.
 * Allows read-only SQL queries for debugging.
 */
export async function handleAdminQuery(request: Request, env: Env): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    try {
        const body = await request.json() as AdminQueryRequest;
        const { sql } = body;

        if (!sql || typeof sql !== 'string') {
            return JsonResponse.badRequest('Missing or invalid SQL query');
        }

        // Validate that the query is read-only (SELECT only)
        const normalizedSql = sql.trim().toUpperCase();
        if (!normalizedSql.startsWith('SELECT')) {
            return JsonResponse.badRequest('Only SELECT queries are allowed');
        }

        // Additional safety checks - block dangerous patterns
        const dangerousPatterns = [
            /;\s*DELETE/i,
            /;\s*UPDATE/i,
            /;\s*INSERT/i,
            /;\s*DROP/i,
            /;\s*ALTER/i,
            /;\s*CREATE/i,
            /;\s*TRUNCATE/i,
            /;\s*ATTACH/i,
            /;\s*DETACH/i,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(sql)) {
                return JsonResponse.badRequest('Query contains disallowed SQL statements');
            }
        }

        const result = await env.DB.prepare(sql).all();

        return JsonResponse.success({
            rows: result.results || [],
            rowCount: result.results?.length || 0,
            meta: result.meta,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}
