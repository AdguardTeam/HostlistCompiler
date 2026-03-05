/**
 * D1 → PlanetScale Migration Handler
 *
 * One-time migration endpoint that reads data from Cloudflare D1 (SQLite)
 * and writes it to PlanetScale PostgreSQL via Hyperdrive.
 *
 * Migrates the 3 shared tables:
 *   - storage_entries (KV store)
 *   - filter_cache (cached filter downloads)
 *   - compilation_metadata (build history)
 *
 * Tables that remain D1-only (not migrated):
 *   - source_snapshots, source_health, source_attempts (edge-local)
 *   - deployment_history, deployment_counter (edge-local)
 *
 * Safety:
 *   - Idempotent: uses ON CONFLICT DO NOTHING for storage_entries/filter_cache
 *   - Batched: processes rows in chunks to avoid memory issues
 *   - Read-only on D1: never modifies the source database
 *   - Resumable: can be re-run safely if interrupted
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

interface MigrationStats {
    table: string;
    sourceCount: number;
    migratedCount: number;
    skippedCount: number;
    errorCount: number;
    durationMs: number;
}

interface MigrationResult {
    success: boolean;
    startedAt: string;
    completedAt: string;
    totalDurationMs: number;
    tables: MigrationStats[];
    errors: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 100;

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Migrates storage_entries from D1 to PostgreSQL.
 */
async function migrateStorageEntries(
    db: Env['DB'],
    pool: PgPool,
): Promise<MigrationStats> {
    const start = Date.now();
    const stats: MigrationStats = {
        table: 'storage_entries',
        sourceCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        durationMs: 0,
    };

    if (!db) return stats;

    // Count total rows
    const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM storage_entries`)
        .first<{ count: number }>();
    stats.sourceCount = countResult?.count ?? 0;

    if (stats.sourceCount === 0) {
        stats.durationMs = Date.now() - start;
        return stats;
    }

    // Migrate in batches
    let offset = 0;
    while (offset < stats.sourceCount) {
        const batch = await db
            .prepare(`SELECT key, data, createdAt, updatedAt, expiresAt, tags FROM storage_entries LIMIT ? OFFSET ?`)
            .bind(BATCH_SIZE, offset)
            .all<{
                key: string;
                data: string;
                createdAt: string;
                updatedAt: string;
                expiresAt: string | null;
                tags: string | null;
            }>();

        const rows = batch.results ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
            try {
                const result = await pool.query(
                    `INSERT INTO storage_entries (key, data, "createdAt", "updatedAt", "expiresAt", tags)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (key) DO NOTHING`,
                    [
                        row.key,
                        row.data,
                        row.createdAt,
                        row.updatedAt,
                        row.expiresAt,
                        row.tags,
                    ],
                );
                if ((result.rowCount ?? 0) > 0) {
                    stats.migratedCount++;
                } else {
                    stats.skippedCount++;
                }
            } catch {
                stats.errorCount++;
            }
        }

        offset += rows.length;
    }

    stats.durationMs = Date.now() - start;
    return stats;
}

/**
 * Migrates filter_cache from D1 to PostgreSQL.
 */
async function migrateFilterCache(
    db: Env['DB'],
    pool: PgPool,
): Promise<MigrationStats> {
    const start = Date.now();
    const stats: MigrationStats = {
        table: 'filter_cache',
        sourceCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        durationMs: 0,
    };

    if (!db) return stats;

    const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM filter_cache`)
        .first<{ count: number }>();
    stats.sourceCount = countResult?.count ?? 0;

    if (stats.sourceCount === 0) {
        stats.durationMs = Date.now() - start;
        return stats;
    }

    let offset = 0;
    while (offset < stats.sourceCount) {
        const batch = await db
            .prepare(`SELECT source, content, hash, etag, createdAt, updatedAt, expiresAt FROM filter_cache LIMIT ? OFFSET ?`)
            .bind(BATCH_SIZE, offset)
            .all<{
                source: string;
                content: string;
                hash: string;
                etag: string | null;
                createdAt: string;
                updatedAt: string;
                expiresAt: string | null;
            }>();

        const rows = batch.results ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
            try {
                const result = await pool.query(
                    `INSERT INTO filter_cache (source, content, hash, etag, "createdAt", "updatedAt", "expiresAt")
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (source) DO NOTHING`,
                    [
                        row.source,
                        row.content,
                        row.hash,
                        row.etag,
                        row.createdAt,
                        row.updatedAt,
                        row.expiresAt,
                    ],
                );
                if ((result.rowCount ?? 0) > 0) {
                    stats.migratedCount++;
                } else {
                    stats.skippedCount++;
                }
            } catch {
                stats.errorCount++;
            }
        }

        offset += rows.length;
    }

    stats.durationMs = Date.now() - start;
    return stats;
}

/**
 * Migrates compilation_metadata from D1 to PostgreSQL.
 * Uses configName+timestamp as a natural dedup key since the table has no unique constraint
 * other than the PK.
 */
async function migrateCompilationMetadata(
    db: Env['DB'],
    pool: PgPool,
): Promise<MigrationStats> {
    const start = Date.now();
    const stats: MigrationStats = {
        table: 'compilation_metadata',
        sourceCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        durationMs: 0,
    };

    if (!db) return stats;

    const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM compilation_metadata`)
        .first<{ count: number }>();
    stats.sourceCount = countResult?.count ?? 0;

    if (stats.sourceCount === 0) {
        stats.durationMs = Date.now() - start;
        return stats;
    }

    let offset = 0;
    while (offset < stats.sourceCount) {
        const batch = await db
            .prepare(`SELECT configName, timestamp, sourceCount, ruleCount, duration, outputPath FROM compilation_metadata ORDER BY timestamp ASC LIMIT ? OFFSET ?`)
            .bind(BATCH_SIZE, offset)
            .all<{
                configName: string;
                timestamp: string;
                sourceCount: number;
                ruleCount: number;
                duration: number;
                outputPath: string | null;
            }>();

        const rows = batch.results ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
            try {
                // Check for existing record with same configName+timestamp to avoid duplicates
                const existing = await pool.query<{ count: string }>(
                    `SELECT COUNT(*) as count FROM compilation_metadata
                     WHERE "configName" = $1 AND timestamp = $2`,
                    [row.configName, row.timestamp],
                );

                if (parseInt(existing.rows[0]?.count ?? '0', 10) > 0) {
                    stats.skippedCount++;
                    continue;
                }

                await pool.query(
                    `INSERT INTO compilation_metadata ("configName", timestamp, "sourceCount", "ruleCount", duration, "outputPath")
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        row.configName,
                        row.timestamp,
                        row.sourceCount,
                        row.ruleCount,
                        row.duration,
                        row.outputPath,
                    ],
                );
                stats.migratedCount++;
            } catch {
                stats.errorCount++;
            }
        }

        offset += rows.length;
    }

    stats.durationMs = Date.now() - start;
    return stats;
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Handles POST /admin/migrate/d1-to-pg
 *
 * Reads all data from D1 and writes it to PostgreSQL via Hyperdrive.
 * Requires both DB (D1) and HYPERDRIVE bindings to be configured.
 * Admin authentication is enforced by the router.
 *
 * Query params:
 *   ?dryRun=true  — Count rows without writing (default: false)
 *   ?tables=storage_entries,filter_cache  — Migrate specific tables only
 */
export async function handleMigrateD1ToPg(
    request: Request,
    env: Env,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    if (!env.DB) {
        return JsonResponse.serviceUnavailable('D1 database not configured');
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const tablesParam = url.searchParams.get('tables');
    const requestedTables = tablesParam
        ? tablesParam.split(',').map((t) => t.trim())
        : ['storage_entries', 'filter_cache', 'compilation_metadata'];

    const validTables = new Set(['storage_entries', 'filter_cache', 'compilation_metadata']);
    const invalidTables = requestedTables.filter((t) => !validTables.has(t));
    if (invalidTables.length > 0) {
        return JsonResponse.badRequest(`Invalid table(s): ${invalidTables.join(', ')}. Valid: ${[...validTables].join(', ')}`);
    }

    const startedAt = new Date();
    const result: MigrationResult = {
        success: true,
        startedAt: startedAt.toISOString(),
        completedAt: '',
        totalDurationMs: 0,
        tables: [],
        errors: [],
    };

    if (dryRun) {
        // Dry run: just count rows
        for (const table of requestedTables) {
            const countResult = await env.DB
                .prepare(`SELECT COUNT(*) as count FROM ${table}`)
                .first<{ count: number }>();

            result.tables.push({
                table,
                sourceCount: countResult?.count ?? 0,
                migratedCount: 0,
                skippedCount: 0,
                errorCount: 0,
                durationMs: 0,
            });
        }

        result.completedAt = new Date().toISOString();
        result.totalDurationMs = Date.now() - startedAt.getTime();

        return JsonResponse.success({
            dryRun: true,
            ...result,
            message: 'Dry run complete. No data was written.',
        });
    }

    const pool = createPool(hyperdrive.connectionString);

    // Verify PostgreSQL connectivity
    try {
        await pool.query('SELECT 1');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.serviceUnavailable(`Cannot connect to PostgreSQL: ${message}`);
    }

    // Run migrations
    try {
        if (requestedTables.includes('storage_entries')) {
            const stats = await migrateStorageEntries(env.DB, pool);
            result.tables.push(stats);
            if (stats.errorCount > 0) {
                result.errors.push(`${stats.errorCount} errors in storage_entries`);
            }
        }

        if (requestedTables.includes('filter_cache')) {
            const stats = await migrateFilterCache(env.DB, pool);
            result.tables.push(stats);
            if (stats.errorCount > 0) {
                result.errors.push(`${stats.errorCount} errors in filter_cache`);
            }
        }

        if (requestedTables.includes('compilation_metadata')) {
            const stats = await migrateCompilationMetadata(env.DB, pool);
            result.tables.push(stats);
            if (stats.errorCount > 0) {
                result.errors.push(`${stats.errorCount} errors in compilation_metadata`);
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Migration failed: ${message}`);
        result.success = false;
    }

    result.completedAt = new Date().toISOString();
    result.totalDurationMs = Date.now() - startedAt.getTime();
    result.success = result.errors.length === 0;

    const totalMigrated = result.tables.reduce((sum, t) => sum + t.migratedCount, 0);
    const totalSkipped = result.tables.reduce((sum, t) => sum + t.skippedCount, 0);

    return JsonResponse.success({
        ...result,
        summary: `Migrated ${totalMigrated} rows, skipped ${totalSkipped} duplicates across ${result.tables.length} tables`,
    });
}
