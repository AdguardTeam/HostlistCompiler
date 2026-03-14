/**
 * Admin Audit Log Service — append-only D1 CRUD operations for admin audit trail.
 *
 * All admin mutations (role changes, tier updates, feature flag toggles, etc.)
 * are recorded here for compliance and debugging.
 *
 * Uses the ADMIN_DB (D1) binding. All queries are parameterized via
 * `.prepare().bind()` — never string interpolation (ZTA).
 *
 * The audit_logs table is **append-only**: no UPDATE or DELETE operations exist.
 */

import { type AdminAuditLogRow, AdminAuditLogRowSchema, type AuditLogQuery, AuditLogQuerySchema } from '../schemas';
import type { D1Database } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entry payload for writing a new audit log record. */
export interface AuditLogEntry {
    readonly actor_id: string;
    readonly actor_email?: string | null;
    /** Dot-notation action identifier, e.g. 'role.assign', 'tier.update'. */
    readonly action: string;
    /** Resource kind, e.g. 'admin_role', 'tier_config', 'feature_flag'. */
    readonly resource_type: string;
    readonly resource_id?: string | null;
    /** Previous state — will be JSON.stringify'd before storage. */
    readonly old_values?: unknown;
    /** New state — will be JSON.stringify'd before storage. */
    readonly new_values?: unknown;
    readonly ip_address?: string | null;
    readonly user_agent?: string | null;
    readonly status?: 'success' | 'failure' | 'denied';
    readonly metadata?: Record<string, unknown> | null;
}

/** Paginated result set returned by {@link queryAuditLogs}. */
export interface AuditLogResult {
    items: AdminAuditLogRow[];
    total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely JSON-stringify a value for storage, returning `null` for nullish inputs.
 */
function jsonOrNull(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
}

/**
 * Validate an array of raw D1 rows through the AdminAuditLogRowSchema.
 * Rows that fail validation are silently dropped (should never happen
 * with well-formed data, but keeps the API surface safe).
 */
function validateRows(rows: unknown[]): AdminAuditLogRow[] {
    const validated: AdminAuditLogRow[] = [];
    for (const row of rows) {
        const parsed = AdminAuditLogRowSchema.safeParse(row);
        if (parsed.success) {
            validated.push(parsed.data);
        }
    }
    return validated;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Append a new audit log entry.
 *
 * This is the primary write path — called from every admin mutation handler.
 * The table is append-only; rows are never updated or deleted.
 *
 * @param db    - ADMIN_DB D1 binding
 * @param entry - Audit log payload
 * @returns The inserted row (Zod-validated), or `null` if the insert somehow returned no row.
 */
export async function writeAuditLog(
    db: D1Database,
    entry: AuditLogEntry,
): Promise<AdminAuditLogRow | null> {
    const stmt = db.prepare(
        `INSERT INTO admin_audit_logs
			(actor_id, actor_email, action, resource_type, resource_id,
			 old_values, new_values, ip_address, user_agent, status, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING *`,
    );

    const row = await stmt
        .bind(
            entry.actor_id,
            entry.actor_email ?? null,
            entry.action,
            entry.resource_type,
            entry.resource_id ?? null,
            jsonOrNull(entry.old_values),
            jsonOrNull(entry.new_values),
            entry.ip_address ?? null,
            entry.user_agent ?? null,
            entry.status ?? 'success',
            jsonOrNull(entry.metadata),
        )
        .first();

    if (!row) return null;

    const parsed = AdminAuditLogRowSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Read — paginated query
// ---------------------------------------------------------------------------

/**
 * Query audit logs with optional filters and pagination.
 *
 * Builds WHERE clauses dynamically from the provided filter object.
 * Results are ordered by `created_at DESC` (newest first).
 *
 * @param db      - ADMIN_DB D1 binding
 * @param filters - Optional filters (actor, action, resource, date range, pagination)
 * @returns Paginated result with Zod-validated items and a total count.
 */
export async function queryAuditLogs(
    db: D1Database,
    filters: AuditLogQuery,
): Promise<AuditLogResult> {
    // Normalise defaults via Zod (limit=50, offset=0)
    const query = AuditLogQuerySchema.parse(filters);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.actor_id !== undefined) {
        conditions.push('actor_id = ?');
        params.push(query.actor_id);
    }
    if (query.action !== undefined) {
        conditions.push('action = ?');
        params.push(query.action);
    }
    if (query.resource_type !== undefined) {
        conditions.push('resource_type = ?');
        params.push(query.resource_type);
    }
    if (query.resource_id !== undefined) {
        conditions.push('resource_id = ?');
        params.push(query.resource_id);
    }
    if (query.status !== undefined) {
        conditions.push('status = ?');
        params.push(query.status);
    }
    if (query.since !== undefined) {
        conditions.push('created_at >= ?');
        params.push(query.since);
    }
    if (query.until !== undefined) {
        conditions.push('created_at <= ?');
        params.push(query.until);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // --- total count (same WHERE, no LIMIT/OFFSET) ---
    const countResult = await db
        .prepare(`SELECT COUNT(*) AS cnt FROM admin_audit_logs ${whereClause}`)
        .bind(...params)
        .first<{ cnt: number }>();
    const total = countResult?.cnt ?? 0;

    // --- paginated rows ---
    const rowsResult = await db
        .prepare(
            `SELECT * FROM admin_audit_logs ${whereClause}
			 ORDER BY created_at DESC
			 LIMIT ? OFFSET ?`,
        )
        .bind(...params, query.limit, query.offset)
        .all();

    const items = validateRows(rowsResult.results ?? []);

    return { items, total };
}

// ---------------------------------------------------------------------------
// Read — single entry
// ---------------------------------------------------------------------------

/**
 * Retrieve a single audit log entry by its primary key.
 *
 * @param db - ADMIN_DB D1 binding
 * @param id - Audit log row ID
 * @returns The Zod-validated row, or `null` if not found.
 */
export async function getAuditLog(
    db: D1Database,
    id: number,
): Promise<AdminAuditLogRow | null> {
    const row = await db
        .prepare('SELECT * FROM admin_audit_logs WHERE id = ?')
        .bind(id)
        .first();

    if (!row) return null;

    const parsed = AdminAuditLogRowSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Read — by resource
// ---------------------------------------------------------------------------

/**
 * Get the audit trail for a specific resource (e.g. all changes to a feature flag).
 *
 * Results are ordered newest-first.
 *
 * @param db           - ADMIN_DB D1 binding
 * @param resourceType - Resource kind (e.g. 'feature_flag')
 * @param resourceId   - Resource identifier
 * @param limit        - Max rows to return (default 50)
 */
export async function getAuditLogsByResource(
    db: D1Database,
    resourceType: string,
    resourceId: string,
    limit: number = 50,
): Promise<AdminAuditLogRow[]> {
    const result = await db
        .prepare(
            `SELECT * FROM admin_audit_logs
			 WHERE resource_type = ? AND resource_id = ?
			 ORDER BY created_at DESC
			 LIMIT ?`,
        )
        .bind(resourceType, resourceId, limit)
        .all();

    return validateRows(result.results ?? []);
}

// ---------------------------------------------------------------------------
// Read — by actor
// ---------------------------------------------------------------------------

/**
 * Get all audit log entries created by a specific admin user.
 *
 * Results are ordered newest-first.
 *
 * @param db      - ADMIN_DB D1 binding
 * @param actorId - Clerk user ID of the admin
 * @param limit   - Max rows to return (default 50)
 */
export async function getAuditLogsByActor(
    db: D1Database,
    actorId: string,
    limit: number = 50,
): Promise<AdminAuditLogRow[]> {
    const result = await db
        .prepare(
            `SELECT * FROM admin_audit_logs
			 WHERE actor_id = ?
			 ORDER BY created_at DESC
			 LIMIT ?`,
        )
        .bind(actorId, limit)
        .all();

    return validateRows(result.results ?? []);
}

// ---------------------------------------------------------------------------
// Count
// ---------------------------------------------------------------------------

/**
 * Count audit log entries matching the given filters.
 *
 * Useful for dashboard statistics (e.g. "42 admin actions today").
 * Accepts the same filter shape as {@link queryAuditLogs} but ignores
 * `limit` and `offset`.
 *
 * @param db      - ADMIN_DB D1 binding
 * @param filters - Optional filters (same shape as AuditLogQuery)
 */
export async function countAuditLogs(
    db: D1Database,
    filters?: Partial<AuditLogQuery>,
): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters) {
        if (filters.actor_id !== undefined) {
            conditions.push('actor_id = ?');
            params.push(filters.actor_id);
        }
        if (filters.action !== undefined) {
            conditions.push('action = ?');
            params.push(filters.action);
        }
        if (filters.resource_type !== undefined) {
            conditions.push('resource_type = ?');
            params.push(filters.resource_type);
        }
        if (filters.resource_id !== undefined) {
            conditions.push('resource_id = ?');
            params.push(filters.resource_id);
        }
        if (filters.status !== undefined) {
            conditions.push('status = ?');
            params.push(filters.status);
        }
        if (filters.since !== undefined) {
            conditions.push('created_at >= ?');
            params.push(filters.since);
        }
        if (filters.until !== undefined) {
            conditions.push('created_at <= ?');
            params.push(filters.until);
        }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const row = await db
        .prepare(`SELECT COUNT(*) AS cnt FROM admin_audit_logs ${whereClause}`)
        .bind(...params)
        .first<{ cnt: number }>();

    return row?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// Context helper
// ---------------------------------------------------------------------------

/**
 * Extract audit metadata from an incoming request and admin context.
 *
 * Call this at the top of every admin mutation handler and spread the result
 * into the {@link AuditLogEntry} passed to {@link writeAuditLog}:
 *
 * ```ts
 * const ctx = createAuditContext(request, adminContext);
 * await writeAuditLog(db, { ...ctx, action: 'role.assign', ... });
 * ```
 *
 * @param request      - Incoming Cloudflare Worker request
 * @param adminContext  - Authenticated admin context (from auth middleware)
 */
export function createAuditContext(
    request: Request,
    adminContext: { clerk_user_id: string; role_name: string } | null,
): {
    actor_id: string;
    actor_email: string | null;
    ip_address: string | null;
    user_agent: string | null;
} {
    const actorId = adminContext?.clerk_user_id ?? 'unknown';
    const ipAddress = request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for') ??
        null;
    const userAgent = request.headers.get('user-agent') ?? null;

    return {
        actor_id: actorId,
        actor_email: null,
        ip_address: ipAddress,
        user_agent: userAgent,
    };
}
