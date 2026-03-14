/**
 * Tests for Admin Config Service — D1 CRUD for tier configs, scope configs,
 * endpoint auth overrides, and admin announcements.
 *
 * Covers:
 *   - listTierConfigs() / updateTierConfig()
 *   - listScopeConfigs() / updateScopeConfig()
 *   - listEndpointOverrides() / createEndpointOverride() / resolveEndpointAuth()
 *   - listAnnouncements() / createAnnouncement() / updateAnnouncement() / deleteAnnouncement()
 */

import { assertEquals, assertExists } from '@std/assert';
import {
    createAnnouncement,
    createEndpointOverride,
    deleteAnnouncement,
    deleteEndpointOverride,
    listAnnouncements,
    listEndpointOverrides,
    listScopeConfigs,
    listTierConfigs,
    resolveEndpointAuth,
    updateAnnouncement,
    updateScopeConfig,
    updateTierConfig,
} from './admin-config-service.ts';

// ============================================================================
// Mock factories
// ============================================================================

function createMockD1(handlers: {
    first?: (sql: string, binds: unknown[]) => unknown;
    all?: (sql: string, binds: unknown[]) => { results: unknown[] };
    run?: (sql: string, binds: unknown[]) => { success: boolean; meta: { changes: number } };
}) {
    return {
        prepare: (sql: string) => {
            let boundArgs: unknown[] = [];
            const stmt = {
                bind: (...args: unknown[]) => {
                    boundArgs = args;
                    return stmt;
                },
                first: async () => handlers.first?.(sql, boundArgs) ?? null,
                all: async () => handlers.all?.(sql, boundArgs) ?? { results: [] },
                run: async () => handlers.run?.(sql, boundArgs) ?? { success: true, meta: { changes: 0 } },
            };
            return stmt;
        },
    } as unknown as import('../types.ts').D1Database;
}

/** Well-formed D1 tier config row (pre-Zod-transform). */
function makeTierRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        tier_name: 'free',
        order_rank: 0,
        rate_limit: 100,
        display_name: 'Free',
        description: 'Free tier',
        features: JSON.stringify({ compile: true }),
        is_active: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Well-formed D1 scope config row (pre-Zod-transform). */
function makeScopeRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        scope_name: 'compile',
        display_name: 'Compile',
        description: 'Compile scope',
        required_tier: 'free',
        is_active: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Well-formed D1 endpoint override row (pre-Zod-transform). */
function makeEndpointRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        path_pattern: '/api/rules',
        method: 'GET',
        required_tier: 'free',
        required_scopes: JSON.stringify(['compile']),
        is_public: 0,
        is_active: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Well-formed D1 announcement row (pre-Zod-transform). */
function makeAnnouncementRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        title: 'System Maintenance',
        body: 'Scheduled downtime tonight.',
        severity: 'info',
        active_from: null,
        active_until: null,
        is_active: 1,
        created_by: 'user_admin',
        created_at: '2025-01-15T10:00:00.000Z',
        updated_at: '2025-01-15T10:00:00.000Z',
        ...overrides,
    };
}

// ============================================================================
// Tier Config
// ============================================================================

Deno.test('listTierConfigs - returns all tiers ordered by order_rank', async () => {
    const db = createMockD1({
        all: () => ({
            results: [
                makeTierRow({ id: 1, tier_name: 'free', order_rank: 0 }),
                makeTierRow({ id: 2, tier_name: 'pro', order_rank: 1 }),
            ],
        }),
    });

    const tiers = await listTierConfigs(db);
    assertEquals(tiers.length, 2);
    assertEquals(tiers[0].tier_name, 'free');
    assertEquals(typeof tiers[0].features, 'object'); // Zod transforms JSON string
    assertEquals(typeof tiers[0].is_active, 'boolean');
});

Deno.test('listTierConfigs - activeOnly filters query', async () => {
    let capturedSql = '';
    const db = createMockD1({
        all: (sql) => {
            capturedSql = sql;
            return { results: [makeTierRow()] };
        },
    });

    await listTierConfigs(db, true);
    assertEquals(capturedSql.includes('WHERE is_active = 1'), true);
});

Deno.test('updateTierConfig - updates and returns row', async () => {
    const db = createMockD1({
        first: () => makeTierRow({ rate_limit: 200 }),
    });

    const result = await updateTierConfig(db, 'free', { rate_limit: 200 });
    assertExists(result);
    assertEquals(result!.rate_limit, 200);
});

Deno.test('updateTierConfig - returns current row when no fields to update', async () => {
    const db = createMockD1({
        first: () => makeTierRow(),
    });

    const result = await updateTierConfig(db, 'free', {});
    assertExists(result);
    assertEquals(result!.tier_name, 'free');
});

Deno.test('updateTierConfig - returns null when tier not found', async () => {
    const db = createMockD1({ first: () => null });
    const result = await updateTierConfig(db, 'nonexistent', { rate_limit: 999 });
    assertEquals(result, null);
});

// ============================================================================
// Scope Config
// ============================================================================

Deno.test('listScopeConfigs - returns scopes', async () => {
    const db = createMockD1({
        all: () => ({
            results: [makeScopeRow(), makeScopeRow({ id: 2, scope_name: 'rules' })],
        }),
    });

    const scopes = await listScopeConfigs(db);
    assertEquals(scopes.length, 2);
});

Deno.test('listScopeConfigs - activeOnly filters query', async () => {
    let capturedSql = '';
    const db = createMockD1({
        all: (sql) => {
            capturedSql = sql;
            return { results: [] };
        },
    });

    await listScopeConfigs(db, true);
    assertEquals(capturedSql.includes('WHERE is_active = 1'), true);
});

Deno.test('updateScopeConfig - updates and returns row', async () => {
    const db = createMockD1({
        first: () => makeScopeRow({ display_name: 'Updated Compile' }),
    });

    const result = await updateScopeConfig(db, 'compile', { display_name: 'Updated Compile' });
    assertExists(result);
    assertEquals(result!.display_name, 'Updated Compile');
});

Deno.test('updateScopeConfig - returns current row when no fields to update', async () => {
    const db = createMockD1({
        first: () => makeScopeRow(),
    });

    const result = await updateScopeConfig(db, 'compile', {});
    assertExists(result);
});

// ============================================================================
// Endpoint Auth Overrides
// ============================================================================

Deno.test('listEndpointOverrides - returns all overrides', async () => {
    const db = createMockD1({
        all: () => ({
            results: [makeEndpointRow(), makeEndpointRow({ id: 2, path_pattern: '/api/compile' })],
        }),
    });

    const overrides = await listEndpointOverrides(db);
    assertEquals(overrides.length, 2);
    assertEquals(typeof overrides[0].is_public, 'boolean');
    assertEquals(typeof overrides[0].is_active, 'boolean');
});

Deno.test('listEndpointOverrides - activeOnly filters query', async () => {
    let capturedSql = '';
    const db = createMockD1({
        all: (sql) => {
            capturedSql = sql;
            return { results: [] };
        },
    });

    await listEndpointOverrides(db, true);
    assertEquals(capturedSql.includes('WHERE is_active = 1'), true);
});

Deno.test('createEndpointOverride - inserts and returns row', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, _binds) => {
            capturedBinds = _binds;
            return makeEndpointRow({ path_pattern: '/api/new', method: 'POST' });
        },
    });

    const result = await createEndpointOverride(db, {
        path_pattern: '/api/new',
        method: 'POST',
        required_tier: 'pro',
        required_scopes: ['compile', 'rules'],
        is_public: false,
    });

    assertExists(result);
    assertEquals(result.path_pattern, '/api/new');
    assertEquals(capturedBinds[3], JSON.stringify(['compile', 'rules'])); // required_scopes
    assertEquals(capturedBinds[4], 0); // is_public = false → 0
});

Deno.test('deleteEndpointOverride - returns true when row updated', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 1 } }),
    });
    const result = await deleteEndpointOverride(db, 1);
    assertEquals(result, true);
});

Deno.test('deleteEndpointOverride - returns false when no row updated', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 0 } }),
    });
    const result = await deleteEndpointOverride(db, 999);
    assertEquals(result, false);
});

// ============================================================================
// resolveEndpointAuth — cascade resolution
// ============================================================================

Deno.test('resolveEndpointAuth - exact match on path + method', async () => {
    const db = createMockD1({
        first: (sql, _binds) => {
            // First query: exact path + exact method
            if (sql.includes('path_pattern = ?1 AND method = ?2')) {
                return makeEndpointRow({ path_pattern: '/api/rules', method: 'GET' });
            }
            return null;
        },
        all: () => ({ results: [] }),
    });

    const result = await resolveEndpointAuth(db, '/api/rules', 'GET');
    assertExists(result);
    assertEquals(result!.path_pattern, '/api/rules');
});

Deno.test('resolveEndpointAuth - exact path + wildcard method', async () => {
    let callCount = 0;
    const db = createMockD1({
        first: (_sql) => {
            callCount++;
            // First query (exact method) returns null
            if (callCount === 1) return null;
            // Second query (wildcard method) returns a match
            if (callCount === 2) {
                return makeEndpointRow({ path_pattern: '/api/rules', method: '*' });
            }
            return null;
        },
        all: () => ({ results: [] }),
    });

    const result = await resolveEndpointAuth(db, '/api/rules', 'POST');
    assertExists(result);
    assertEquals(result!.method, '*');
});

Deno.test('resolveEndpointAuth - wildcard pattern match with exact method', async () => {
    const db = createMockD1({
        first: () => null, // No exact matches
        all: (sql) => {
            if (sql.includes("LIKE '%*'")) {
                return {
                    results: [
                        makeEndpointRow({
                            id: 10,
                            path_pattern: '/api/rules/*',
                            method: 'GET',
                        }),
                    ],
                };
            }
            return { results: [] };
        },
    });

    const result = await resolveEndpointAuth(db, '/api/rules/123', 'GET');
    assertExists(result);
    assertEquals(result!.path_pattern, '/api/rules/*');
});

Deno.test('resolveEndpointAuth - returns null when no match', async () => {
    const db = createMockD1({
        first: () => null,
        all: () => ({ results: [] }),
    });

    const result = await resolveEndpointAuth(db, '/unknown/path', 'GET');
    assertEquals(result, null);
});

// ============================================================================
// Announcements
// ============================================================================

Deno.test('listAnnouncements - returns all announcements', async () => {
    const db = createMockD1({
        all: () => ({
            results: [
                makeAnnouncementRow({ id: 1 }),
                makeAnnouncementRow({ id: 2, title: 'Second' }),
            ],
        }),
    });

    const announcements = await listAnnouncements(db);
    assertEquals(announcements.length, 2);
    assertEquals(typeof announcements[0].is_active, 'boolean');
});

Deno.test('listAnnouncements - activeOnly filters query', async () => {
    let capturedSql = '';
    const db = createMockD1({
        all: (sql) => {
            capturedSql = sql;
            return { results: [] };
        },
    });

    await listAnnouncements(db, true);
    assertEquals(capturedSql.includes('WHERE is_active = 1'), true);
});

Deno.test('createAnnouncement - inserts and returns announcement', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeAnnouncementRow({ title: 'New Alert', severity: 'warning' });
        },
    });

    const result = await createAnnouncement(
        db,
        {
            title: 'New Alert',
            body: 'Important update',
            severity: 'warning',
        },
        'user_admin',
    );

    assertExists(result);
    assertEquals(result.title, 'New Alert');
    assertEquals(result.severity, 'warning');
    assertEquals(capturedBinds[5], 'user_admin'); // created_by
});

Deno.test('updateAnnouncement - updates partial fields', async () => {
    const db = createMockD1({
        first: () => makeAnnouncementRow({ title: 'Updated Title' }),
    });

    const result = await updateAnnouncement(db, 1, { title: 'Updated Title' });
    assertExists(result);
    assertEquals(result!.title, 'Updated Title');
});

Deno.test('updateAnnouncement - returns null when not found', async () => {
    const db = createMockD1({ first: () => null });
    const result = await updateAnnouncement(db, 999, { title: 'X' });
    assertEquals(result, null);
});

Deno.test('deleteAnnouncement - returns true when row soft-deleted', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 1 } }),
    });
    const result = await deleteAnnouncement(db, 1);
    assertEquals(result, true);
});

Deno.test('deleteAnnouncement - returns false when no row found', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 0 } }),
    });
    const result = await deleteAnnouncement(db, 999);
    assertEquals(result, false);
});
