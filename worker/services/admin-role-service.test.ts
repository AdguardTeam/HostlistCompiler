/**
 * Tests for Admin Role Service — D1 CRUD + KV-cached role resolution.
 *
 * Covers:
 *   - listRoles() — returns all active roles from D1
 *   - createRole() — inserts a new role
 *   - updateRole() — partial update of role fields
 *   - resolveAdminContext() — KV cache hit, KV cache miss → D1, no assignment
 *   - assignRole() — creates/upserts role assignment
 *   - revokeRole() — deletes assignment
 *   - invalidateRoleCache() — removes KV entry
 *   - Edge cases: undefined DB, expired assignment
 */

import { assertEquals, assertExists } from '@std/assert';
import {
    assignRole,
    CACHE_TTL_SECONDS,
    createRole,
    invalidateRoleCache,
    KV_PREFIX,
    listRoleAssignments,
    listRoles,
    resolveAdminContext,
    revokeRole,
    updateRole,
} from './admin-role-service.ts';

// ============================================================================
// Mock factories
// ============================================================================

/**
 * Flexible D1 mock: routes SQL → responses based on substring matching.
 * Supports `.first()`, `.all()`, and `.run()`.
 */
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
    } as unknown as D1Database;
}

/** KV mock backed by an in-memory Map. */
function createMockKV() {
    const store = new Map<string, string>();
    return {
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string, _opts?: unknown) => {
            store.set(key, value);
        },
        delete: async (key: string) => {
            store.delete(key);
        },
        _store: store,
    } as unknown as KVNamespace & { _store: Map<string, string> };
}

/** Well-formed D1 role row (pre-Zod-transform). */
function makeRoleRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        role_name: 'editor',
        display_name: 'Editor',
        description: 'Can edit things',
        permissions: JSON.stringify(['config:read', 'config:write']),
        is_active: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Well-formed D1 role assignment row (pre-Zod-transform). */
function makeAssignmentRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        clerk_user_id: 'user_abc',
        role_name: 'editor',
        assigned_by: 'user_admin',
        assigned_at: '2025-01-01T00:00:00.000Z',
        expires_at: null,
        ...overrides,
    };
}

// ============================================================================
// listRoles
// ============================================================================

Deno.test('listRoles - returns all active roles from D1', async () => {
    const db = createMockD1({
        all: () => ({
            results: [
                makeRoleRow({ id: 1, role_name: 'viewer' }),
                makeRoleRow({ id: 2, role_name: 'editor' }),
            ],
        }),
    });

    const roles = await listRoles(db);
    assertEquals(roles.length, 2);
    assertEquals(roles[0].role_name, 'viewer');
    assertEquals(roles[1].role_name, 'editor');
    // Zod transforms: permissions should be parsed array, is_active should be boolean
    assertEquals(Array.isArray(roles[0].permissions), true);
    assertEquals(typeof roles[0].is_active, 'boolean');
});

Deno.test('listRoles - returns empty array when db is undefined', async () => {
    const roles = await listRoles(undefined);
    assertEquals(roles, []);
});

Deno.test('listRoles - returns empty array when D1 returns no results', async () => {
    const db = createMockD1({ all: () => ({ results: [] }) });
    const roles = await listRoles(db);
    assertEquals(roles, []);
});

// ============================================================================
// createRole
// ============================================================================

Deno.test('createRole - inserts role and returns created row', async () => {
    const db = createMockD1({
        first: () => makeRoleRow({ role_name: 'super-admin' }),
    });

    const result = await createRole(db, {
        role_name: 'super-admin',
        display_name: 'Super Admin',
        description: 'Full access',
        permissions: ['admin:read', 'admin:write'],
    });

    assertExists(result);
    assertEquals(result!.role_name, 'super-admin');
});

Deno.test('createRole - returns null when db is undefined', async () => {
    const result = await createRole(undefined, {
        role_name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access',
        permissions: ['admin:read'],
    });
    assertEquals(result, null);
});

Deno.test('createRole - returns null when D1 returns no row', async () => {
    const db = createMockD1({ first: () => null });
    const result = await createRole(db, {
        role_name: 'viewer',
        display_name: 'Viewer',
        description: 'Read-only access',
        permissions: ['admin:read'],
    });
    assertEquals(result, null);
});

// ============================================================================
// updateRole
// ============================================================================

Deno.test('updateRole - updates existing role and returns updated row', async () => {
    const db = createMockD1({
        first: (sql) => {
            if (sql.includes('UPDATE')) {
                return makeRoleRow({ display_name: 'Updated Editor' });
            }
            return makeRoleRow();
        },
    });

    const result = await updateRole(db, 'editor', { display_name: 'Updated Editor' });
    assertExists(result);
    assertEquals(result!.display_name, 'Updated Editor');
});

Deno.test('updateRole - returns null when db is undefined', async () => {
    const result = await updateRole(undefined, 'editor', { display_name: 'X' });
    assertEquals(result, null);
});

Deno.test('updateRole - returns current row when no fields to update', async () => {
    const db = createMockD1({
        first: () => makeRoleRow(),
    });

    const result = await updateRole(db, 'editor', {});
    assertExists(result);
    assertEquals(result!.role_name, 'editor');
});

Deno.test('updateRole - handles multiple fields', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeRoleRow({
                display_name: 'New Name',
                description: 'New Desc',
                permissions: JSON.stringify(['admin:read']),
                is_active: 0,
            });
        },
    });

    await updateRole(db, 'editor', {
        display_name: 'New Name',
        description: 'New Desc',
        permissions: ['admin:read'],
        is_active: false,
    });
    // display_name, description, JSON permissions, is_active (0), updated_at, roleName
    assertEquals(capturedBinds.length >= 6, true);
});

// ============================================================================
// resolveAdminContext — KV cache hit
// ============================================================================

Deno.test('resolveAdminContext - returns cached context from KV on hit', async () => {
    const kv = createMockKV();
    const cached = {
        clerk_user_id: 'user_abc',
        role_name: 'editor',
        permissions: ['config:read', 'config:write'],
        expires_at: null,
    };
    kv._store.set(`${KV_PREFIX}user_abc`, JSON.stringify(cached));

    const result = await resolveAdminContext({ RATE_LIMIT: kv as unknown as KVNamespace }, 'user_abc');
    assertExists(result);
    assertEquals(result!.clerk_user_id, 'user_abc');
    assertEquals(result!.role_name, 'editor');
    assertEquals(result!.permissions.length, 2);
});

// ============================================================================
// resolveAdminContext — KV miss → D1 lookup
// ============================================================================

Deno.test('resolveAdminContext - falls through to D1 on KV miss and caches result', async () => {
    const kv = createMockKV();
    const db = createMockD1({
        first: () => ({
            clerk_user_id: 'user_abc',
            role_name: 'editor',
            expires_at: null,
            permissions: JSON.stringify(['config:read', 'config:write']),
        }),
    });

    const result = await resolveAdminContext({ ADMIN_DB: db, RATE_LIMIT: kv as unknown as KVNamespace }, 'user_abc');
    assertExists(result);
    assertEquals(result!.role_name, 'editor');
    // Verify it was cached in KV
    const cachedVal = kv._store.get(`${KV_PREFIX}user_abc`);
    assertExists(cachedVal);
});

// ============================================================================
// resolveAdminContext — no assignment
// ============================================================================

Deno.test('resolveAdminContext - returns null when no assignment found in D1', async () => {
    const kv = createMockKV();
    const db = createMockD1({ first: () => null });

    const result = await resolveAdminContext({ ADMIN_DB: db, RATE_LIMIT: kv as unknown as KVNamespace }, 'user_nobody');
    assertEquals(result, null);
});

Deno.test('resolveAdminContext - returns null when db is undefined', async () => {
    const result = await resolveAdminContext({}, 'user_abc');
    assertEquals(result, null);
});

Deno.test('resolveAdminContext - returns null for expired assignment', async () => {
    const db = createMockD1({
        first: () => ({
            clerk_user_id: 'user_abc',
            role_name: 'editor',
            expires_at: '2020-01-01T00:00:00.000Z', // In the past
            permissions: JSON.stringify(['config:read']),
        }),
    });

    const result = await resolveAdminContext({ ADMIN_DB: db }, 'user_abc');
    assertEquals(result, null);
});

Deno.test('resolveAdminContext - returns null for corrupt permissions JSON', async () => {
    const db = createMockD1({
        first: () => ({
            clerk_user_id: 'user_abc',
            role_name: 'editor',
            expires_at: null,
            permissions: 'NOT_JSON{{{',
        }),
    });

    const result = await resolveAdminContext({ ADMIN_DB: db }, 'user_abc');
    assertEquals(result, null);
});

Deno.test('resolveAdminContext - falls through on corrupt KV cache', async () => {
    const kv = createMockKV();
    kv._store.set(`${KV_PREFIX}user_abc`, 'NOT_VALID_JSON{{{');

    const db = createMockD1({
        first: () => ({
            clerk_user_id: 'user_abc',
            role_name: 'editor',
            expires_at: null,
            permissions: JSON.stringify(['config:read']),
        }),
    });

    const result = await resolveAdminContext({ ADMIN_DB: db, RATE_LIMIT: kv as unknown as KVNamespace }, 'user_abc');
    assertExists(result);
    assertEquals(result!.role_name, 'editor');
});

// ============================================================================
// assignRole
// ============================================================================

Deno.test('assignRole - creates assignment and returns row', async () => {
    const db = createMockD1({
        first: () => makeAssignmentRow(),
    });

    const result = await assignRole(
        db,
        { clerk_user_id: 'user_abc', role_name: 'editor' },
        'user_admin',
    );
    assertExists(result);
    assertEquals(result!.clerk_user_id, 'user_abc');
    assertEquals(result!.role_name, 'editor');
    assertEquals(result!.assigned_by, 'user_admin');
});

Deno.test('assignRole - returns null when db is undefined', async () => {
    const result = await assignRole(
        undefined,
        { clerk_user_id: 'user_abc', role_name: 'editor' },
        'user_admin',
    );
    assertEquals(result, null);
});

// ============================================================================
// revokeRole
// ============================================================================

Deno.test('revokeRole - deletes assignment and returns true', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 1 } }),
    });

    const result = await revokeRole(db, 'user_abc', 'editor');
    assertEquals(result, true);
});

Deno.test('revokeRole - returns false when no row deleted', async () => {
    const db = createMockD1({
        run: () => ({ success: true, meta: { changes: 0 } }),
    });

    const result = await revokeRole(db, 'user_nobody', 'editor');
    assertEquals(result, false);
});

Deno.test('revokeRole - returns false when db is undefined', async () => {
    const result = await revokeRole(undefined, 'user_abc', 'editor');
    assertEquals(result, false);
});

// ============================================================================
// invalidateRoleCache
// ============================================================================

Deno.test('invalidateRoleCache - deletes KV entry', async () => {
    const kv = createMockKV();
    kv._store.set(`${KV_PREFIX}user_abc`, 'cached_data');

    await invalidateRoleCache(kv as unknown as KVNamespace, 'user_abc');
    assertEquals(kv._store.has(`${KV_PREFIX}user_abc`), false);
});

Deno.test('invalidateRoleCache - no-op when kv is undefined', async () => {
    // Should not throw
    await invalidateRoleCache(undefined, 'user_abc');
});

// ============================================================================
// listRoleAssignments
// ============================================================================

Deno.test('listRoleAssignments - returns all assignments', async () => {
    const db = createMockD1({
        all: () => ({
            results: [
                makeAssignmentRow({ id: 1 }),
                makeAssignmentRow({ id: 2, clerk_user_id: 'user_def' }),
            ],
        }),
    });

    const assignments = await listRoleAssignments(db);
    assertEquals(assignments.length, 2);
});

Deno.test('listRoleAssignments - returns empty array when db undefined', async () => {
    const result = await listRoleAssignments(undefined);
    assertEquals(result, []);
});

// ============================================================================
// KV_PREFIX and CACHE_TTL_SECONDS exports
// ============================================================================

Deno.test('KV_PREFIX - is correct format', () => {
    assertEquals(KV_PREFIX, 'admin:role:');
});

Deno.test('CACHE_TTL_SECONDS - is 300', () => {
    assertEquals(CACHE_TTL_SECONDS, 300);
});
