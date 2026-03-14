/**
 * Admin Role Service — D1 CRUD + KV-cached role resolution for the admin system.
 *
 * All queries use parameterized `.prepare().bind()` (ZTA requirement — no string interpolation).
 * All D1 row results are validated through Zod schemas before returning.
 *
 * KV cache key format: `admin:role:{clerkUserId}`
 * KV cache TTL: 5 minutes (300 seconds)
 */

import { z } from 'zod';
import type { AdminRoleAssignmentRow, AdminRoleRow, AssignRoleRequest, CreateAdminRoleRequest, ResolvedAdminContext, UpdateAdminRoleRequest } from '../schemas';
import { AdminRoleAssignmentRowSchema, AdminRoleRowSchema, ResolvedAdminContextSchema } from '../schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KV key prefix for cached admin role contexts. */
export const KV_PREFIX = 'admin:role:';

/** Time-to-live for KV-cached role contexts, in seconds. */
export const CACHE_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// Env helper type (accepts the bindings we actually need)
// ---------------------------------------------------------------------------

/**
 * Minimal env shape accepted by admin role functions.
 * The middleware casts Env → AdminEnv at the call site to bridge
 * the D1Database interface mismatch between worker/types.ts and
 * @cloudflare/workers-types.
 */
export interface AdminEnv {
    readonly ADMIN_DB?: D1Database;
    readonly RATE_LIMIT?: KVNamespace;
}

// ---------------------------------------------------------------------------
// Role resolution (the critical path)
// ---------------------------------------------------------------------------

/**
 * Resolve a Clerk user ID to their admin role and permissions.
 *
 * 1. Checks KV cache (`admin:role:{clerkUserId}`) first.
 * 2. On cache miss, queries ADMIN_DB for the role assignment + role permissions.
 * 3. Expired assignments (past `expires_at`) are treated as no-role.
 * 4. Valid contexts are cached in KV for {@link CACHE_TTL_SECONDS} seconds.
 *
 * @returns The resolved admin context, or `null` if the user has no active admin role.
 */
export async function resolveAdminContext(
    env: AdminEnv,
    clerkUserId: string,
): Promise<ResolvedAdminContext | null> {
    const kv = env.RATE_LIMIT;
    const db = env.ADMIN_DB;

    // ── KV cache check ────────────────────────────────────────────────────
    if (kv) {
        const cached = await kv.get(`${KV_PREFIX}${clerkUserId}`);
        if (cached !== null) {
            try {
                return ResolvedAdminContextSchema.parse(JSON.parse(cached));
            } catch {
                // Corrupted cache entry — fall through to D1 lookup
            }
        }
    }

    // ── D1 lookup ─────────────────────────────────────────────────────────
    if (!db) {
        return null;
    }

    // Join assignment → role in a single query to avoid round-trips.
    const row = await db
        .prepare(
            `SELECT
				a.clerk_user_id,
				a.role_name,
				a.expires_at,
				r.permissions
			FROM admin_role_assignments a
			JOIN admin_roles r ON r.role_name = a.role_name AND r.is_active = 1
			WHERE a.clerk_user_id = ?`,
        )
        .bind(clerkUserId)
        .first<{
            clerk_user_id: string;
            role_name: string;
            expires_at: string | null;
            permissions: string;
        }>();

    if (!row) {
        return null;
    }

    // ── Check expiration ──────────────────────────────────────────────────
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return null;
    }

    // ── Parse & validate ──────────────────────────────────────────────────
    let permissions: string[];
    try {
        permissions = JSON.parse(row.permissions);
    } catch {
        return null;
    }

    const context = ResolvedAdminContextSchema.parse({
        clerk_user_id: row.clerk_user_id,
        role_name: row.role_name,
        permissions,
        expires_at: row.expires_at,
    });

    // ── Write-through to KV cache ─────────────────────────────────────────
    if (kv) {
        await kv.put(`${KV_PREFIX}${clerkUserId}`, JSON.stringify(context), {
            expirationTtl: CACHE_TTL_SECONDS,
        });
    }

    return context;
}

// ---------------------------------------------------------------------------
// Role CRUD
// ---------------------------------------------------------------------------

/**
 * List all active admin roles.
 *
 * @returns Array of validated role rows, or empty array if ADMIN_DB is unavailable.
 */
export async function listRoles(db: D1Database | undefined): Promise<AdminRoleRow[]> {
    if (!db) {
        return [];
    }

    const result = await db
        .prepare('SELECT * FROM admin_roles WHERE is_active = 1 ORDER BY role_name ASC')
        .all();

    return z.array(AdminRoleRowSchema).parse(result.results ?? []);
}

/**
 * Get a single admin role by its unique name.
 *
 * @returns The validated role row, or `null` if not found.
 */
export async function getRoleByName(
    db: D1Database | undefined,
    roleName: string,
): Promise<AdminRoleRow | null> {
    if (!db) {
        return null;
    }

    const row = await db
        .prepare('SELECT * FROM admin_roles WHERE role_name = ?')
        .bind(roleName)
        .first();

    if (!row) {
        return null;
    }

    return AdminRoleRowSchema.parse(row);
}

/**
 * Create a new admin role.
 *
 * Permissions are stored as a JSON-encoded string in D1.
 *
 * @returns The newly created role row.
 */
export async function createRole(
    db: D1Database | undefined,
    data: CreateAdminRoleRequest,
): Promise<AdminRoleRow | null> {
    if (!db) {
        return null;
    }

    const now = new Date().toISOString();
    const row = await db
        .prepare(
            `INSERT INTO admin_roles (role_name, display_name, description, permissions, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 1, ?, ?)
			 RETURNING *`,
        )
        .bind(
            data.role_name,
            data.display_name,
            data.description ?? '',
            JSON.stringify(data.permissions),
            now,
            now,
        )
        .first();

    if (!row) {
        return null;
    }

    return AdminRoleRowSchema.parse(row);
}

/**
 * Update an existing admin role by name.
 *
 * Only fields present in `data` are updated; absent fields are left unchanged.
 *
 * @returns The updated role row, or `null` if the role was not found.
 */
export async function updateRole(
    db: D1Database | undefined,
    roleName: string,
    data: UpdateAdminRoleRequest,
): Promise<AdminRoleRow | null> {
    if (!db) {
        return null;
    }

    // Build SET clauses dynamically but use parameterized binds for every value.
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.display_name !== undefined) {
        setClauses.push('display_name = ?');
        values.push(data.display_name);
    }
    if (data.description !== undefined) {
        setClauses.push('description = ?');
        values.push(data.description);
    }
    if (data.permissions !== undefined) {
        setClauses.push('permissions = ?');
        values.push(JSON.stringify(data.permissions));
    }
    if (data.is_active !== undefined) {
        setClauses.push('is_active = ?');
        values.push(data.is_active ? 1 : 0);
    }

    if (setClauses.length === 0) {
        // Nothing to update — return the current row.
        return getRoleByName(db, roleName);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());

    // The WHERE param is always last.
    values.push(roleName);

    const row = await db
        .prepare(
            `UPDATE admin_roles SET ${setClauses.join(', ')} WHERE role_name = ? RETURNING *`,
        )
        .bind(...values)
        .first();

    if (!row) {
        return null;
    }

    return AdminRoleRowSchema.parse(row);
}

// ---------------------------------------------------------------------------
// Role assignment CRUD
// ---------------------------------------------------------------------------

/**
 * Assign an admin role to a Clerk user (upsert on conflict).
 *
 * If the user already has the same role, the assignment metadata is updated.
 *
 * @returns The validated assignment row.
 */
export async function assignRole(
    db: D1Database | undefined,
    data: AssignRoleRequest,
    assignedBy: string,
): Promise<AdminRoleAssignmentRow | null> {
    if (!db) {
        return null;
    }

    const now = new Date().toISOString();
    const row = await db
        .prepare(
            `INSERT INTO admin_role_assignments (clerk_user_id, role_name, assigned_by, assigned_at, expires_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(clerk_user_id, role_name) DO UPDATE SET
				assigned_by = excluded.assigned_by,
				assigned_at = excluded.assigned_at,
				expires_at  = excluded.expires_at
			 RETURNING *`,
        )
        .bind(
            data.clerk_user_id,
            data.role_name,
            assignedBy,
            now,
            data.expires_at ?? null,
        )
        .first();

    if (!row) {
        return null;
    }

    return AdminRoleAssignmentRowSchema.parse(row);
}

/**
 * Revoke (delete) a role assignment for a user.
 *
 * @returns `true` if a row was deleted.
 */
export async function revokeRole(
    db: D1Database | undefined,
    clerkUserId: string,
    roleName: string,
): Promise<boolean> {
    if (!db) {
        return false;
    }

    const result = await db
        .prepare('DELETE FROM admin_role_assignments WHERE clerk_user_id = ? AND role_name = ?')
        .bind(clerkUserId, roleName)
        .run();

    return (result.meta?.changes ?? 0) > 0;
}

/** Optional filters for listing role assignments. */
export interface ListAssignmentsFilter {
    readonly clerk_user_id?: string;
    readonly role_name?: string;
}

/**
 * List role assignments with optional filters.
 *
 * @param filters — Narrow by `clerk_user_id` and/or `role_name`.
 * @returns Array of validated assignment rows.
 */
export async function listRoleAssignments(
    db: D1Database | undefined,
    filters?: ListAssignmentsFilter,
): Promise<AdminRoleAssignmentRow[]> {
    if (!db) {
        return [];
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.clerk_user_id) {
        conditions.push('clerk_user_id = ?');
        values.push(filters.clerk_user_id);
    }
    if (filters?.role_name) {
        conditions.push('role_name = ?');
        values.push(filters.role_name);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = 'SELECT * FROM admin_role_assignments ' + where + ' ORDER BY assigned_at DESC';
    const result = await db
        .prepare(sql)
        .bind(...values)
        .all();

    return z.array(AdminRoleAssignmentRowSchema).parse(result.results ?? []);
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/**
 * Delete the KV cache entry for a user's resolved admin context.
 *
 * Call this after assigning or revoking a role so the next `resolveAdminContext`
 * call fetches fresh data from D1.
 */
export async function invalidateRoleCache(
    kv: KVNamespace | undefined,
    clerkUserId: string,
): Promise<void> {
    if (!kv) {
        return;
    }

    await kv.delete(`${KV_PREFIX}${clerkUserId}`);
}
