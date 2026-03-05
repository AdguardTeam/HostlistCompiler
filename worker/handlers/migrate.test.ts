/**
 * Tests for the D1 → PostgreSQL migration handler.
 *
 * Covers test plan item: POST /admin/migrate/d1-to-pg?dryRun=true
 * These tests run without a live database by mocking D1 and the PgPool factory.
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { handleMigrateD1ToPg } from './migrate.ts';
import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result, Env, HyperdriveBinding } from '../types.ts';

// ============================================================================
// Fixtures
// ============================================================================

const MOCK_HYPERDRIVE: HyperdriveBinding = {
    connectionString: 'postgresql://test:test@localhost:5432/testdb',
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'test',
    database: 'testdb',
};

type MockPgPool = {
    query<T>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

type MockPgFactory = (connectionString: string) => MockPgPool;

/**
 * Creates a D1 mock backed by in-memory table data.
 * Supports COUNT(*) queries (via `first()`) and paginated SELECT queries (via `bind().all()`).
 */
function createMockD1(tableData: Record<string, Array<Record<string, unknown>>>): D1Database {
    return {
        prepare(query: string): D1PreparedStatement {
            let boundValues: unknown[] = [];
            const stmt: D1PreparedStatement = {
                bind(...values: unknown[]): D1PreparedStatement {
                    boundValues = [...values];
                    return stmt;
                },
                async first<T>(): Promise<T | null> {
                    const countMatch = query.match(/SELECT COUNT\(\*\) as count FROM (\w+)/i);
                    if (countMatch) {
                        const rows = tableData[countMatch[1]] ?? [];
                        return { count: rows.length } as T;
                    }
                    return null;
                },
                async all<T>(): Promise<D1Result<T>> {
                    const tableMatch = query.match(/FROM\s+(\w+)/i);
                    const tableName = tableMatch?.[1];
                    const allRows = (tableName && tableData[tableName]) ? tableData[tableName] : [];
                    const limit = typeof boundValues[0] === 'number' ? boundValues[0] : allRows.length;
                    const offset = typeof boundValues[1] === 'number' ? boundValues[1] : 0;
                    return { results: allRows.slice(offset, offset + limit) as T[], success: true };
                },
                async run(): Promise<D1Result> {
                    return { success: true };
                },
                async raw<T>(): Promise<T[]> {
                    return [];
                },
            };
            return stmt;
        },
        async dump(): Promise<ArrayBuffer> {
            return new ArrayBuffer(0);
        },
        async batch<T>(): Promise<D1Result<T>[]> {
            return [];
        },
        async exec(): Promise<D1ExecResult> {
            return { count: 0, duration: 0 };
        },
    };
}

/** Builds a minimal Env with an optional D1 database binding. */
function makeEnv(db?: D1Database): Env {
    return {
        COMPILER_VERSION: 'test',
        COMPILATION_CACHE: {} as KVNamespace,
        RATE_LIMIT: {} as KVNamespace,
        METRICS: {} as KVNamespace,
        DB: db,
    };
}

// Row factories for test data
function makeStorageRow(i: number) {
    return { key: `key-${i}`, data: '{}', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', expiresAt: null, tags: null };
}
function makeFilterCacheRow(i: number) {
    return {
        source: `https://example.com/list-${i}.txt`,
        content: '||example.com',
        hash: 'a'.repeat(64),
        etag: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: null,
    };
}
function makeCompilationMetaRow(i: number) {
    return { configName: `config-${i}`, timestamp: `2024-01-0${i + 1}T00:00:00Z`, sourceCount: 2, ruleCount: 100, duration: 500, outputPath: null };
}

// ============================================================================
// dryRun=true — test plan item: POST /admin/migrate/d1-to-pg?dryRun=true
// ============================================================================

Deno.test('handleMigrateD1ToPg - dryRun returns row counts without writing to PostgreSQL', async () => {
    const mockDb = createMockD1({
        storage_entries: [makeStorageRow(0), makeStorageRow(1), makeStorageRow(2)],
        filter_cache: [makeFilterCacheRow(0), makeFilterCacheRow(1)],
        compilation_metadata: [makeCompilationMetaRow(0)],
    });
    let pgCallCount = 0;
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            pgCallCount++;
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?dryRun=true', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.dryRun, true);
    assertEquals(pgCallCount, 0, 'dryRun must not make any PostgreSQL calls');

    const tables = body.tables as Array<{ table: string; sourceCount: number; migratedCount: number }>;
    assertEquals(tables.length, 3);
    assertEquals(tables[0].table, 'storage_entries');
    assertEquals(tables[0].sourceCount, 3);
    assertEquals(tables[0].migratedCount, 0);
    assertEquals(tables[1].table, 'filter_cache');
    assertEquals(tables[1].sourceCount, 2);
    assertEquals(tables[2].table, 'compilation_metadata');
    assertEquals(tables[2].sourceCount, 1);
});

Deno.test('handleMigrateD1ToPg - dryRun with ?tables= filters to requested tables only', async () => {
    const mockDb = createMockD1({
        storage_entries: [makeStorageRow(0), makeStorageRow(1)],
        filter_cache: [makeFilterCacheRow(0)],
        compilation_metadata: [makeCompilationMetaRow(0)],
    });
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?dryRun=true&tables=storage_entries', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    const tables = body.tables as Array<{ table: string; sourceCount: number }>;
    assertEquals(tables.length, 1);
    assertEquals(tables[0].table, 'storage_entries');
    assertEquals(tables[0].sourceCount, 2);
});

Deno.test('handleMigrateD1ToPg - dryRun on empty tables returns zero counts', async () => {
    const mockDb = createMockD1({ storage_entries: [], filter_cache: [], compilation_metadata: [] });
    let pgCallCount = 0;
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            pgCallCount++;
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?dryRun=true', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.dryRun, true);
    assertEquals(pgCallCount, 0);
    const tables = body.tables as Array<{ sourceCount: number }>;
    assertEquals(tables.every((t) => t.sourceCount === 0), true);
});

// ============================================================================
// Input validation
// ============================================================================

Deno.test('handleMigrateD1ToPg - returns 503 when D1 not configured', async () => {
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(undefined), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 503);
});

Deno.test('handleMigrateD1ToPg - returns 400 for invalid table name', async () => {
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?tables=bad_table', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(createMockD1({})), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assertStringIncludes(body.error as string, 'bad_table');
});

Deno.test('handleMigrateD1ToPg - returns 503 when PostgreSQL is unreachable', async () => {
    const mockDb = createMockD1({ storage_entries: [makeStorageRow(0)] });
    const createPool: MockPgFactory = (_cs) => ({
        async query() {
            throw new Error('connection refused');
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 503);
    const body = await res.json() as Record<string, unknown>;
    assertStringIncludes(body.error as string, 'connection refused');
});

// ============================================================================
// Actual migration
// ============================================================================

Deno.test('handleMigrateD1ToPg - migrates rows and reports correct counts', async () => {
    const mockDb = createMockD1({
        storage_entries: [makeStorageRow(0), makeStorageRow(1)],
        filter_cache: [makeFilterCacheRow(0)],
        compilation_metadata: [makeCompilationMetaRow(0)],
    });
    const createPool: MockPgFactory = (_cs) => ({
        async query<T>(text: string): Promise<{ rows: T[]; rowCount: number | null }> {
            if (text.trim() === 'SELECT 1') return { rows: [], rowCount: 1 };
            // ON CONFLICT DO NOTHING: rowCount=1 → new row inserted
            if (text.includes('ON CONFLICT')) return { rows: [], rowCount: 1 };
            // compilation_metadata duplicate check → no existing row
            if (text.includes('SELECT COUNT(*)')) return { rows: [{ count: '0' }] as T[], rowCount: 1 };
            // compilation_metadata insert
            return { rows: [], rowCount: 1 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);

    const tables = body.tables as Array<{ table: string; migratedCount: number; skippedCount: number; errorCount: number }>;
    assertEquals(tables[0].table, 'storage_entries');
    assertEquals(tables[0].migratedCount, 2);
    assertEquals(tables[0].skippedCount, 0);
    assertEquals(tables[1].table, 'filter_cache');
    assertEquals(tables[1].migratedCount, 1);
    assertEquals(tables[2].table, 'compilation_metadata');
    assertEquals(tables[2].migratedCount, 1);
});

Deno.test('handleMigrateD1ToPg - skips duplicate rows (idempotent ON CONFLICT)', async () => {
    const mockDb = createMockD1({
        storage_entries: [makeStorageRow(0), makeStorageRow(1)],
        filter_cache: [],
        compilation_metadata: [],
    });
    const createPool: MockPgFactory = (_cs) => ({
        async query<T>(text: string): Promise<{ rows: T[]; rowCount: number | null }> {
            if (text.trim() === 'SELECT 1') return { rows: [], rowCount: 1 };
            // ON CONFLICT DO NOTHING: rowCount=0 → already existed (skipped)
            if (text.includes('ON CONFLICT')) return { rows: [], rowCount: 0 };
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?tables=storage_entries', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    const tables = body.tables as Array<{ migratedCount: number; skippedCount: number }>;
    assertEquals(tables[0].migratedCount, 0);
    assertEquals(tables[0].skippedCount, 2);
});

Deno.test('handleMigrateD1ToPg - skips existing compilation_metadata rows', async () => {
    const mockDb = createMockD1({
        storage_entries: [],
        filter_cache: [],
        compilation_metadata: [makeCompilationMetaRow(0)],
    });
    const createPool: MockPgFactory = (_cs) => ({
        async query<T>(text: string): Promise<{ rows: T[]; rowCount: number | null }> {
            if (text.trim() === 'SELECT 1') return { rows: [], rowCount: 1 };
            // Duplicate check → row already exists
            if (text.includes('SELECT COUNT(*)')) return { rows: [{ count: '1' }] as T[], rowCount: 1 };
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/admin/migrate/d1-to-pg?tables=compilation_metadata', { method: 'POST' });
    const res = await handleMigrateD1ToPg(req, makeEnv(mockDb), MOCK_HYPERDRIVE, createPool);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    const tables = body.tables as Array<{ migratedCount: number; skippedCount: number }>;
    assertEquals(tables[0].migratedCount, 0);
    assertEquals(tables[0].skippedCount, 1);
});
