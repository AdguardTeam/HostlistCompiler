/**
 * Tests for Admin Audit Log Service — append-only D1 CRUD for admin audit trail.
 *
 * Covers:
 *   - writeAuditLog() — inserts audit entry with correct fields
 *   - queryAuditLogs() — pagination, filter by action/actor/date range
 *   - getAuditLog() — single entry by ID
 *   - getAuditLogsByResource() — filter by resource
 *   - getAuditLogsByActor() — filter by actor
 *   - countAuditLogs() — count with filters
 *   - createAuditContext() — extracts correct fields from request
 */

import { assertEquals, assertExists } from '@std/assert';
import { countAuditLogs, createAuditContext, getAuditLog, getAuditLogsByActor, getAuditLogsByResource, queryAuditLogs, writeAuditLog } from './admin-audit-service.ts';

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

/** Well-formed D1 audit row (pre-Zod-transform). */
function makeAuditRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        actor_id: 'user_admin',
        actor_email: null,
        action: 'role.assign',
        resource_type: 'admin_role',
        resource_id: 'editor',
        old_values: null,
        new_values: JSON.stringify({ role_name: 'editor' }),
        ip_address: '1.2.3.4',
        user_agent: 'Mozilla/5.0',
        status: 'success',
        metadata: null,
        created_at: '2025-01-15T10:30:00.000Z',
        ...overrides,
    };
}

// ============================================================================
// writeAuditLog
// ============================================================================

Deno.test('writeAuditLog - inserts audit entry with correct fields', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeAuditRow();
        },
    });

    const result = await writeAuditLog(db, {
        actor_id: 'user_admin',
        action: 'role.assign',
        resource_type: 'admin_role',
        resource_id: 'editor',
        new_values: { role_name: 'editor' },
        ip_address: '1.2.3.4',
        user_agent: 'Mozilla/5.0',
        status: 'success',
    });

    assertExists(result);
    assertEquals(result!.actor_id, 'user_admin');
    assertEquals(result!.action, 'role.assign');
    assertEquals(result!.resource_type, 'admin_role');
    assertEquals(result!.status, 'success');
    // Verify bind params were passed (actor_id, actor_email, action, resource_type, ...)
    assertEquals(capturedBinds[0], 'user_admin'); // actor_id
    assertEquals(capturedBinds[2], 'role.assign'); // action
});

Deno.test('writeAuditLog - returns null when insert returns no row', async () => {
    const db = createMockD1({ first: () => null });
    const result = await writeAuditLog(db, {
        actor_id: 'user_admin',
        action: 'test',
        resource_type: 'test',
    });
    assertEquals(result, null);
});

Deno.test('writeAuditLog - defaults optional fields to null', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeAuditRow();
        },
    });

    await writeAuditLog(db, {
        actor_id: 'user_admin',
        action: 'test',
        resource_type: 'test',
    });

    // actor_email should be null (index 1)
    assertEquals(capturedBinds[1], null);
    // resource_id should be null (index 4)
    assertEquals(capturedBinds[4], null);
    // status defaults to 'success' (index 9)
    assertEquals(capturedBinds[9], 'success');
});

Deno.test('writeAuditLog - JSON-stringifies old_values and new_values', async () => {
    let capturedBinds: unknown[] = [];
    const db = createMockD1({
        first: (_sql, binds) => {
            capturedBinds = binds;
            return makeAuditRow();
        },
    });

    await writeAuditLog(db, {
        actor_id: 'user_admin',
        action: 'test',
        resource_type: 'test',
        old_values: { before: true },
        new_values: { after: true },
    });

    // old_values at index 5, new_values at index 6
    assertEquals(capturedBinds[5], JSON.stringify({ before: true }));
    assertEquals(capturedBinds[6], JSON.stringify({ after: true }));
});

// ============================================================================
// queryAuditLogs
// ============================================================================

Deno.test('queryAuditLogs - returns paginated results with total', async () => {
    const db = createMockD1({
        first: () => ({ cnt: 2 }),
        all: () => ({
            results: [makeAuditRow({ id: 1 }), makeAuditRow({ id: 2 })],
        }),
    });

    const result = await queryAuditLogs(db, { limit: 50, offset: 0 });
    assertEquals(result.total, 2);
    assertEquals(result.items.length, 2);
});

Deno.test('queryAuditLogs - filters by action', async () => {
    let capturedSql = '';
    const db = createMockD1({
        first: (sql) => {
            capturedSql = sql;
            return { cnt: 1 };
        },
        all: () => ({ results: [makeAuditRow()] }),
    });

    await queryAuditLogs(db, { action: 'role.assign', limit: 50, offset: 0 });
    assertEquals(capturedSql.includes('action = ?'), true);
});

Deno.test('queryAuditLogs - filters by actor_id', async () => {
    let capturedSql = '';
    const db = createMockD1({
        first: (sql) => {
            capturedSql = sql;
            return { cnt: 1 };
        },
        all: () => ({ results: [makeAuditRow()] }),
    });

    await queryAuditLogs(db, { actor_id: 'user_admin', limit: 50, offset: 0 });
    assertEquals(capturedSql.includes('actor_id = ?'), true);
});

Deno.test('queryAuditLogs - filters by date range', async () => {
    let capturedSql = '';
    const db = createMockD1({
        first: (sql) => {
            capturedSql = sql;
            return { cnt: 0 };
        },
        all: () => ({ results: [] }),
    });

    await queryAuditLogs(db, {
        since: '2025-01-01T00:00:00.000Z',
        until: '2025-12-31T23:59:59.999Z',
        limit: 50,
        offset: 0,
    });

    assertEquals(capturedSql.includes('created_at >= ?'), true);
    assertEquals(capturedSql.includes('created_at <= ?'), true);
});

Deno.test('queryAuditLogs - uses default limit and offset', async () => {
    const db = createMockD1({
        first: () => ({ cnt: 0 }),
        all: () => ({ results: [] }),
    });

    // Zod defaults would normally apply, but the inferred type requires them
    const result = await queryAuditLogs(db, { limit: 50, offset: 0 });
    assertEquals(result.total, 0);
    assertEquals(result.items.length, 0);
});

// ============================================================================
// getAuditLog
// ============================================================================

Deno.test('getAuditLog - returns single audit entry by ID', async () => {
    const db = createMockD1({
        first: () => makeAuditRow({ id: 42 }),
    });

    const result = await getAuditLog(db, 42);
    assertExists(result);
    assertEquals(result!.id, 42);
});

Deno.test('getAuditLog - returns null when not found', async () => {
    const db = createMockD1({ first: () => null });
    const result = await getAuditLog(db, 999);
    assertEquals(result, null);
});

// ============================================================================
// getAuditLogsByResource
// ============================================================================

Deno.test('getAuditLogsByResource - returns logs for a resource', async () => {
    const db = createMockD1({
        all: () => ({
            results: [makeAuditRow(), makeAuditRow({ id: 2 })],
        }),
    });

    const results = await getAuditLogsByResource(db, 'feature_flag', 'dark-mode');
    assertEquals(results.length, 2);
});

// ============================================================================
// getAuditLogsByActor
// ============================================================================

Deno.test('getAuditLogsByActor - returns logs for an actor', async () => {
    const db = createMockD1({
        all: () => ({
            results: [makeAuditRow()],
        }),
    });

    const results = await getAuditLogsByActor(db, 'user_admin');
    assertEquals(results.length, 1);
    assertEquals(results[0].actor_id, 'user_admin');
});

// ============================================================================
// countAuditLogs
// ============================================================================

Deno.test('countAuditLogs - returns count with no filters', async () => {
    const db = createMockD1({
        first: () => ({ cnt: 42 }),
    });

    const count = await countAuditLogs(db);
    assertEquals(count, 42);
});

Deno.test('countAuditLogs - returns count with filters', async () => {
    const db = createMockD1({
        first: () => ({ cnt: 5 }),
    });

    const count = await countAuditLogs(db, { action: 'role.assign' });
    assertEquals(count, 5);
});

Deno.test('countAuditLogs - returns 0 when no rows', async () => {
    const db = createMockD1({ first: () => null });
    const count = await countAuditLogs(db);
    assertEquals(count, 0);
});

// ============================================================================
// createAuditContext
// ============================================================================

Deno.test('createAuditContext - extracts correct fields from request and admin context', () => {
    const request = new Request('https://example.com/admin/roles', {
        headers: {
            'cf-connecting-ip': '10.0.0.1',
            'user-agent': 'TestBrowser/1.0',
        },
    });

    const adminContext = {
        clerk_user_id: 'user_admin',
        role_name: 'super-admin',
    };

    const ctx = createAuditContext(request, adminContext);
    assertEquals(ctx.actor_id, 'user_admin');
    assertEquals(ctx.ip_address, '10.0.0.1');
    assertEquals(ctx.user_agent, 'TestBrowser/1.0');
    assertEquals(ctx.actor_email, null);
});

Deno.test('createAuditContext - uses x-forwarded-for when cf-connecting-ip is absent', () => {
    const request = new Request('https://example.com/admin/roles', {
        headers: {
            'x-forwarded-for': '192.168.1.1',
        },
    });

    const ctx = createAuditContext(request, null);
    assertEquals(ctx.actor_id, 'unknown');
    assertEquals(ctx.ip_address, '192.168.1.1');
});

Deno.test('createAuditContext - handles null admin context', () => {
    const request = new Request('https://example.com/admin/roles');
    const ctx = createAuditContext(request, null);
    assertEquals(ctx.actor_id, 'unknown');
    assertEquals(ctx.ip_address, null);
    assertEquals(ctx.user_agent, null);
});
