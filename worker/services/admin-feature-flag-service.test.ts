/**
 * Tests for Admin Feature Flag Service — D1 CRUD and evaluation.
 *
 * Covers:
 *   - listFeatureFlags() — returns all flags / enabled-only
 *   - getFeatureFlag() / getFeatureFlagById() — single flag lookup
 *   - createFeatureFlag() — inserts flag with JSON target fields
 *   - updateFeatureFlag() — partial update
 *   - deleteFeatureFlag() — removes flag
 *   - evaluateFlag() — enabled/disabled, rollout %, tier targeting, user targeting
 *   - Edge cases: flag not found, 0% rollout, 100% rollout
 */

import { assertEquals, assertExists } from 'jsr:@std/assert';
import {
    createFeatureFlag,
    deleteFeatureFlag,
    evaluateFlag,
    evaluateFlags,
    getAllEnabledFlagNames,
    getFeatureFlag,
    listFeatureFlags,
    updateFeatureFlag,
} from './admin-feature-flag-service.ts';

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

/** Well-formed D1 feature flag row (pre-Zod-transform). */
function makeFlagRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        flag_name: 'dark-mode',
        enabled: 1,
        rollout_percentage: 100,
        target_tiers: JSON.stringify([]),
        target_users: JSON.stringify([]),
        description: 'Dark mode feature flag',
        created_by: 'user_admin',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

// ============================================================================
// listFeatureFlags
// ============================================================================

Deno.test('listFeatureFlags - returns all flags', async () => {
    const db = createMockD1({
        all: () => ({
            results: [
                makeFlagRow({ id: 1, flag_name: 'dark-mode' }),
                makeFlagRow({ id: 2, flag_name: 'beta-feature', enabled: 0 }),
            ],
        }),
    });

    const flags = await listFeatureFlags(db);
    assertEquals(flags.length, 2);
    assertEquals(flags[0].flag_name, 'dark-mode');
    // Zod transforms
    assertEquals(typeof flags[0].enabled, 'boolean');
    assertEquals(Array.isArray(flags[0].target_tiers), true);
});

Deno.test('listFeatureFlags - enabledOnly filters query', async () => {
    let capturedSql = '';
    const db = createMockD1({
        all: (sql) => {
            capturedSql = sql;
            return { results: [makeFlagRow()] };
        },
    });

    await listFeatureFlags(db, true);
    assertEquals(capturedSql.includes('WHERE enabled = 1'), true);
});

// ============================================================================
// getFeatureFlag
// ============================================================================

Deno.test('getFeatureFlag - returns flag by name', async () => {
    const db = createMockD1({
        first: () => makeFlagRow(),
    });

    const flag = await getFeatureFlag(db, 'dark-mode');
    assertExists(flag);
    assertEquals(flag!.flag_name, 'dark-mode');
});

Deno.test('getFeatureFlag - returns null when not found', async () => {
    const db = createMockD1({ first: () => null });
    const flag = await getFeatureFlag(db, 'nonexistent');
    assertEquals(flag, null);
});

// ============================================================================
// createFeatureFlag
// ============================================================================

Deno.test('createFeatureFlag - inserts flag and returns created row', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeFlagRow({ flag_name: 'new-flag' });
        },
    });

    const result = await createFeatureFlag(db, {
        flag_name: 'new-flag',
        enabled: true,
        rollout_percentage: 50,
        target_tiers: ['pro', 'admin'],
        target_users: ['user_1'],
        description: 'New feature',
    }, 'user_admin');

    assertExists(result);
    assertEquals(result.flag_name, 'new-flag');
    // Verify JSON serialization of target fields
    assertEquals(capturedBinds[3], JSON.stringify(['pro', 'admin'])); // target_tiers
    assertEquals(capturedBinds[4], JSON.stringify(['user_1'])); // target_users
    assertEquals(capturedBinds[6], 'user_admin'); // created_by
});

// ============================================================================
// updateFeatureFlag
// ============================================================================

Deno.test('updateFeatureFlag - updates partial fields and returns updated row', async () => {
    const db = createMockD1({
        first: () => makeFlagRow({ enabled: 0, rollout_percentage: 25 }),
    });

    const result = await updateFeatureFlag(db, 'dark-mode', {
        enabled: false,
        rollout_percentage: 25,
    });

    assertExists(result);
    assertEquals(result!.enabled, false);
    assertEquals(result!.rollout_percentage, 25);
});

Deno.test('updateFeatureFlag - returns current row when no fields to update', async () => {
    const db = createMockD1({
        first: () => makeFlagRow(),
    });

    const result = await updateFeatureFlag(db, 'dark-mode', {});
    assertExists(result);
    assertEquals(result!.flag_name, 'dark-mode');
});

Deno.test('updateFeatureFlag - returns null when flag not found', async () => {
    const db = createMockD1({ first: () => null });
    const result = await updateFeatureFlag(db, 'nonexistent', { enabled: false });
    assertEquals(result, null);
});

// ============================================================================
// deleteFeatureFlag
// ============================================================================

Deno.test('deleteFeatureFlag - returns true when row deleted', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 1 } }),
    });
    const result = await deleteFeatureFlag(db, 'dark-mode');
    assertEquals(result, true);
});

Deno.test('deleteFeatureFlag - returns false when no row deleted', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 0 } }),
    });
    const result = await deleteFeatureFlag(db, 'nonexistent');
    assertEquals(result, false);
});

// ============================================================================
// evaluateFlag — enabled / disabled
// ============================================================================

Deno.test('evaluateFlag - returns false when flag does not exist', async () => {
    const db = createMockD1({ first: () => null });
    const result = await evaluateFlag(db, 'nonexistent');
    assertEquals(result, false);
});

Deno.test('evaluateFlag - returns false when flag is disabled', async () => {
    const db = createMockD1({
        first: () => makeFlagRow({ enabled: 0 }),
    });
    const result = await evaluateFlag(db, 'dark-mode');
    assertEquals(result, false);
});

// ============================================================================
// evaluateFlag — rollout percentage
// ============================================================================

Deno.test('evaluateFlag - 100% rollout returns true', async () => {
    const db = createMockD1({
        first: () => makeFlagRow({ rollout_percentage: 100 }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_1' });
    assertEquals(result, true);
});

Deno.test('evaluateFlag - 0% rollout returns false', async () => {
    const db = createMockD1({
        first: () => makeFlagRow({ rollout_percentage: 0 }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_1' });
    assertEquals(result, false);
});

Deno.test('evaluateFlag - deterministic hash for same user produces consistent result', async () => {
    const db = createMockD1({
        first: () => makeFlagRow({ rollout_percentage: 50 }),
    });

    const result1 = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_stable' });
    const result2 = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_stable' });
    assertEquals(result1, result2);
});

// ============================================================================
// evaluateFlag — tier targeting
// ============================================================================

Deno.test('evaluateFlag - tier targeting: included tier passes', async () => {
    const db = createMockD1({
        first: () =>
            makeFlagRow({
                target_tiers: JSON.stringify(['pro', 'admin']),
                rollout_percentage: 100,
            }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { userTier: 'pro' });
    assertEquals(result, true);
});

Deno.test('evaluateFlag - tier targeting: excluded tier fails', async () => {
    const db = createMockD1({
        first: () =>
            makeFlagRow({
                target_tiers: JSON.stringify(['pro', 'admin']),
                rollout_percentage: 100,
            }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { userTier: 'free' });
    assertEquals(result, false);
});

Deno.test('evaluateFlag - tier targeting: no userTier fails when tiers specified', async () => {
    const db = createMockD1({
        first: () =>
            makeFlagRow({
                target_tiers: JSON.stringify(['pro']),
                rollout_percentage: 100,
            }),
    });
    const result = await evaluateFlag(db, 'dark-mode', {});
    assertEquals(result, false);
});

// ============================================================================
// evaluateFlag — user targeting
// ============================================================================

Deno.test('evaluateFlag - user targeting: included user always passes', async () => {
    const db = createMockD1({
        first: () =>
            makeFlagRow({
                target_users: JSON.stringify(['user_vip']),
                rollout_percentage: 0, // 0% rollout but user override should win
            }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_vip' });
    assertEquals(result, true);
});

Deno.test('evaluateFlag - user targeting: non-targeted user falls through to rollout', async () => {
    const db = createMockD1({
        first: () =>
            makeFlagRow({
                target_users: JSON.stringify(['user_vip']),
                rollout_percentage: 0,
            }),
    });
    const result = await evaluateFlag(db, 'dark-mode', { clerkUserId: 'user_regular' });
    assertEquals(result, false);
});

// ============================================================================
// evaluateFlags (batch)
// ============================================================================

Deno.test('evaluateFlags - batch evaluates multiple flags', async () => {
    let callCount = 0;
    const db = createMockD1({
        first: () => {
            callCount++;
            return makeFlagRow({ rollout_percentage: 100 });
        },
    });

    const results = await evaluateFlags(db, ['flag-a', 'flag-b'], {});
    assertEquals(results['flag-a'], true);
    assertEquals(results['flag-b'], true);
});

// ============================================================================
// getAllEnabledFlagNames
// ============================================================================

Deno.test('getAllEnabledFlagNames - returns only enabled flag names', async () => {
    const db = createMockD1({
        all: () => ({
            results: [{ flag_name: 'dark-mode' }, { flag_name: 'beta' }],
        }),
    });

    const names = await getAllEnabledFlagNames(db);
    assertEquals(names, ['dark-mode', 'beta']);
});
