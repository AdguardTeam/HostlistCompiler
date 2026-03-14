/**
 * Admin Config Service — D1 CRUD for tier configs, scope configs,
 * endpoint auth overrides, and admin announcements.
 *
 * All queries use parameterized `.prepare().bind()` (never string interpolation).
 * All row results are Zod-validated before being returned.
 * JSON columns (features, required_scopes) are serialized with JSON.stringify()
 * on write; Zod `.transform()` handles deserialization on read.
 * Boolean columns (is_active, is_public) are stored as 1/0 integers.
 */

import type { D1Database } from '../types';
import {
    type AdminAnnouncementRow,
    AdminAnnouncementRowSchema,
    type CreateAnnouncementRequest,
    type CreateEndpointOverrideRequest,
    type EndpointAuthOverrideRow,
    EndpointAuthOverrideRowSchema,
    type ScopeConfigRow,
    ScopeConfigRowSchema,
    type TierConfigRow,
    TierConfigRowSchema,
    type UpdateAnnouncementRequest,
    type UpdateEndpointOverrideRequest,
    type UpdateScopeConfigRequest,
    type UpdateTierConfigRequest,
} from '../schemas';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw D1 row through the given Zod schema.
 * Returns `null` when the input is nullish.
 */
function parseRow<T>(raw: unknown, schema: { parse: (data: unknown) => T }): T | null {
    if (raw == null) return null;
    return schema.parse(raw);
}

/**
 * Parse an array of raw D1 rows through the given Zod schema.
 */
function parseRows<T>(raw: unknown[], schema: { parse: (data: unknown) => T }): T[] {
    return raw.map((r) => schema.parse(r));
}

// ===========================================================================
// Tier Config CRUD
// ===========================================================================

/**
 * List all tier configs, optionally filtered by active status.
 *
 * @param db         - D1 database binding (ADMIN_DB).
 * @param activeOnly - When `true`, only rows with `is_active = 1` are returned.
 * @returns Array of validated {@link TierConfigRow} objects ordered by `order_rank`.
 */
export async function listTierConfigs(
    db: D1Database,
    activeOnly?: boolean,
): Promise<TierConfigRow[]> {
    const query = activeOnly ? 'SELECT * FROM tier_configs WHERE is_active = 1 ORDER BY order_rank ASC' : 'SELECT * FROM tier_configs ORDER BY order_rank ASC';

    const result = await db.prepare(query).all();
    return parseRows(result.results ?? [], TierConfigRowSchema);
}

/**
 * Get a single tier config by its unique tier name.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param tierName - The `tier_name` to look up.
 * @returns The validated row, or `null` if not found.
 */
export async function getTierConfig(
    db: D1Database,
    tierName: string,
): Promise<TierConfigRow | null> {
    const raw = await db
        .prepare('SELECT * FROM tier_configs WHERE tier_name = ?1')
        .bind(tierName)
        .first();
    return parseRow(raw, TierConfigRowSchema);
}

/**
 * Update an existing tier config by tier name.
 *
 * Only the fields present in `data` are updated; omitted fields are left
 * unchanged. The `features` object is JSON-serialized for storage.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param tierName - The `tier_name` of the tier to update.
 * @param data     - Validated partial update payload.
 * @returns The updated, validated row, or `null` if the tier was not found.
 */
export async function updateTierConfig(
    db: D1Database,
    tierName: string,
    data: UpdateTierConfigRequest,
): Promise<TierConfigRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.rate_limit !== undefined) {
        setClauses.push(`rate_limit = ?${paramIdx}`);
        values.push(data.rate_limit);
        paramIdx++;
    }
    if (data.display_name !== undefined) {
        setClauses.push(`display_name = ?${paramIdx}`);
        values.push(data.display_name);
        paramIdx++;
    }
    if (data.description !== undefined) {
        setClauses.push(`description = ?${paramIdx}`);
        values.push(data.description);
        paramIdx++;
    }
    if (data.features !== undefined) {
        setClauses.push(`features = ?${paramIdx}`);
        values.push(JSON.stringify(data.features));
        paramIdx++;
    }
    if (data.is_active !== undefined) {
        setClauses.push(`is_active = ?${paramIdx}`);
        values.push(data.is_active ? 1 : 0);
        paramIdx++;
    }

    // Nothing to update — just return the current row
    if (setClauses.length === 0) {
        return getTierConfig(db, tierName);
    }

    // Always bump updated_at
    setClauses.push(`updated_at = datetime('now')`);

    // tier_name is the final bind parameter for the WHERE clause
    values.push(tierName);

    const sql = `UPDATE tier_configs SET ${setClauses.join(', ')} WHERE tier_name = ?${paramIdx} RETURNING *`;

    const raw = await db.prepare(sql).bind(...values).first();
    return parseRow(raw, TierConfigRowSchema);
}

// ===========================================================================
// Scope Config CRUD
// ===========================================================================

/**
 * List all scope configs, optionally filtered by active status.
 *
 * @param db         - D1 database binding (ADMIN_DB).
 * @param activeOnly - When `true`, only rows with `is_active = 1` are returned.
 * @returns Array of validated {@link ScopeConfigRow} objects ordered by `scope_name`.
 */
export async function listScopeConfigs(
    db: D1Database,
    activeOnly?: boolean,
): Promise<ScopeConfigRow[]> {
    const query = activeOnly ? 'SELECT * FROM scope_configs WHERE is_active = 1 ORDER BY scope_name ASC' : 'SELECT * FROM scope_configs ORDER BY scope_name ASC';

    const result = await db.prepare(query).all();
    return parseRows(result.results ?? [], ScopeConfigRowSchema);
}

/**
 * Get a single scope config by its unique scope name.
 *
 * @param db        - D1 database binding (ADMIN_DB).
 * @param scopeName - The `scope_name` to look up.
 * @returns The validated row, or `null` if not found.
 */
export async function getScopeConfig(
    db: D1Database,
    scopeName: string,
): Promise<ScopeConfigRow | null> {
    const raw = await db
        .prepare('SELECT * FROM scope_configs WHERE scope_name = ?1')
        .bind(scopeName)
        .first();
    return parseRow(raw, ScopeConfigRowSchema);
}

/**
 * Update an existing scope config by scope name.
 *
 * Only the fields present in `data` are updated; omitted fields are left unchanged.
 *
 * @param db        - D1 database binding (ADMIN_DB).
 * @param scopeName - The `scope_name` of the scope to update.
 * @param data      - Validated partial update payload.
 * @returns The updated, validated row, or `null` if the scope was not found.
 */
export async function updateScopeConfig(
    db: D1Database,
    scopeName: string,
    data: UpdateScopeConfigRequest,
): Promise<ScopeConfigRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.display_name !== undefined) {
        setClauses.push(`display_name = ?${paramIdx}`);
        values.push(data.display_name);
        paramIdx++;
    }
    if (data.description !== undefined) {
        setClauses.push(`description = ?${paramIdx}`);
        values.push(data.description);
        paramIdx++;
    }
    if (data.required_tier !== undefined) {
        setClauses.push(`required_tier = ?${paramIdx}`);
        values.push(data.required_tier);
        paramIdx++;
    }
    if (data.is_active !== undefined) {
        setClauses.push(`is_active = ?${paramIdx}`);
        values.push(data.is_active ? 1 : 0);
        paramIdx++;
    }

    // Nothing to update — just return the current row
    if (setClauses.length === 0) {
        return getScopeConfig(db, scopeName);
    }

    // Always bump updated_at
    setClauses.push(`updated_at = datetime('now')`);

    // scope_name is the final bind parameter for the WHERE clause
    values.push(scopeName);

    const sql = `UPDATE scope_configs SET ${setClauses.join(', ')} WHERE scope_name = ?${paramIdx} RETURNING *`;

    const raw = await db.prepare(sql).bind(...values).first();
    return parseRow(raw, ScopeConfigRowSchema);
}

// ===========================================================================
// Endpoint Auth Overrides CRUD
// ===========================================================================

/**
 * List all endpoint auth overrides, optionally filtered by active status.
 *
 * @param db         - D1 database binding (ADMIN_DB).
 * @param activeOnly - When `true`, only rows with `is_active = 1` are returned.
 * @returns Array of validated {@link EndpointAuthOverrideRow} objects ordered by `path_pattern`.
 */
export async function listEndpointOverrides(
    db: D1Database,
    activeOnly?: boolean,
): Promise<EndpointAuthOverrideRow[]> {
    const query = activeOnly
        ? 'SELECT * FROM endpoint_auth_overrides WHERE is_active = 1 ORDER BY path_pattern ASC'
        : 'SELECT * FROM endpoint_auth_overrides ORDER BY path_pattern ASC';

    const result = await db.prepare(query).all();
    return parseRows(result.results ?? [], EndpointAuthOverrideRowSchema);
}

/**
 * Get a single endpoint auth override by its numeric ID.
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @param id - The auto-increment `id` to look up.
 * @returns The validated row, or `null` if not found.
 */
export async function getEndpointOverride(
    db: D1Database,
    id: number,
): Promise<EndpointAuthOverrideRow | null> {
    const raw = await db
        .prepare('SELECT * FROM endpoint_auth_overrides WHERE id = ?1')
        .bind(id)
        .first();
    return parseRow(raw, EndpointAuthOverrideRowSchema);
}

/**
 * Insert a new endpoint auth override.
 *
 * The `required_scopes` array is JSON-serialized for storage.
 * The boolean `is_public` field is stored as an integer (1/0).
 *
 * @param db   - D1 database binding (ADMIN_DB).
 * @param data - Validated create request payload.
 * @returns The newly inserted, validated {@link EndpointAuthOverrideRow}.
 */
export async function createEndpointOverride(
    db: D1Database,
    data: CreateEndpointOverrideRequest,
): Promise<EndpointAuthOverrideRow> {
    const raw = await db
        .prepare(
            `INSERT INTO endpoint_auth_overrides (path_pattern, method, required_tier, required_scopes, is_public)
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING *`,
        )
        .bind(
            data.path_pattern,
            data.method,
            data.required_tier ?? null,
            data.required_scopes ? JSON.stringify(data.required_scopes) : null,
            data.is_public ? 1 : 0,
        )
        .first();

    return EndpointAuthOverrideRowSchema.parse(raw);
}

/**
 * Update an existing endpoint auth override by ID.
 *
 * Only the fields present in `data` are updated; omitted fields are left unchanged.
 * The `required_scopes` array is JSON-serialized. The boolean `is_public` is stored as 1/0.
 *
 * @param db   - D1 database binding (ADMIN_DB).
 * @param id   - The auto-increment `id` of the override to update.
 * @param data - Validated partial update payload.
 * @returns The updated, validated row, or `null` if the override was not found.
 */
export async function updateEndpointOverride(
    db: D1Database,
    id: number,
    data: UpdateEndpointOverrideRequest,
): Promise<EndpointAuthOverrideRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.required_tier !== undefined) {
        setClauses.push(`required_tier = ?${paramIdx}`);
        values.push(data.required_tier);
        paramIdx++;
    }
    if (data.required_scopes !== undefined) {
        setClauses.push(`required_scopes = ?${paramIdx}`);
        values.push(data.required_scopes ? JSON.stringify(data.required_scopes) : null);
        paramIdx++;
    }
    if (data.is_public !== undefined) {
        setClauses.push(`is_public = ?${paramIdx}`);
        values.push(data.is_public ? 1 : 0);
        paramIdx++;
    }
    if (data.is_active !== undefined) {
        setClauses.push(`is_active = ?${paramIdx}`);
        values.push(data.is_active ? 1 : 0);
        paramIdx++;
    }

    // Nothing to update — just return the current row
    if (setClauses.length === 0) {
        return getEndpointOverride(db, id);
    }

    // Always bump updated_at
    setClauses.push(`updated_at = datetime('now')`);

    // id is the final bind parameter for the WHERE clause
    values.push(id);

    const sql = `UPDATE endpoint_auth_overrides SET ${setClauses.join(', ')} WHERE id = ?${paramIdx} RETURNING *`;

    const raw = await db.prepare(sql).bind(...values).first();
    return parseRow(raw, EndpointAuthOverrideRowSchema);
}

/**
 * Soft-delete an endpoint auth override by setting `is_active = 0`.
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @param id - The auto-increment `id` of the override to deactivate.
 * @returns `true` if a row was updated, `false` otherwise.
 */
export async function deleteEndpointOverride(
    db: D1Database,
    id: number,
): Promise<boolean> {
    const result = await db
        .prepare(`UPDATE endpoint_auth_overrides SET is_active = 0, updated_at = datetime('now') WHERE id = ?1`)
        .bind(id)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

/**
 * Find the best matching endpoint auth override for a given path and HTTP method.
 *
 * Resolution order:
 * 1. Exact match on path_pattern + exact method.
 * 2. Exact match on path_pattern + wildcard method ('*').
 * 3. Wildcard pattern match (patterns ending in '*') + exact method — longest prefix wins.
 * 4. Wildcard pattern match + wildcard method ('*') — longest prefix wins.
 *
 * Only active overrides (`is_active = 1`) are considered.
 *
 * @param db     - D1 database binding (ADMIN_DB).
 * @param path   - The request path, e.g. '/api/rules/123'.
 * @param method - The HTTP method, e.g. 'GET'.
 * @returns The best matching validated row, or `null` if no override matches.
 */
export async function resolveEndpointAuth(
    db: D1Database,
    path: string,
    method: string,
): Promise<EndpointAuthOverrideRow | null> {
    const upperMethod = method.toUpperCase();

    // Step 1: Exact path + exact method
    const exact = await db
        .prepare(
            'SELECT * FROM endpoint_auth_overrides WHERE path_pattern = ?1 AND method = ?2 AND is_active = 1',
        )
        .bind(path, upperMethod)
        .first();
    if (exact) return parseRow(exact, EndpointAuthOverrideRowSchema);

    // Step 2: Exact path + wildcard method
    const exactPathWildcard = await db
        .prepare(
            `SELECT * FROM endpoint_auth_overrides WHERE path_pattern = ?1 AND method = '*' AND is_active = 1`,
        )
        .bind(path)
        .first();
    if (exactPathWildcard) return parseRow(exactPathWildcard, EndpointAuthOverrideRowSchema);

    // Step 3 + 4: Fetch all active wildcard patterns and find the longest matching prefix.
    // Wildcard patterns end with '*', e.g. '/api/rules/*'.
    const wildcardResult = await db
        .prepare(
            `SELECT * FROM endpoint_auth_overrides WHERE path_pattern LIKE '%*' AND is_active = 1 ORDER BY length(path_pattern) DESC`,
        )
        .all();

    const wildcardRows = wildcardResult.results ?? [];
    let bestMethodMatch: unknown = null;
    let bestWildcardMatch: unknown = null;

    for (const row of wildcardRows) {
        const pattern = (row as Record<string, unknown>).path_pattern as string;
        const rowMethod = (row as Record<string, unknown>).method as string;

        // Strip trailing '*' to get the prefix
        const prefix = pattern.slice(0, -1);

        if (!path.startsWith(prefix)) continue;

        // Prefer exact method over wildcard
        if (rowMethod === upperMethod && !bestMethodMatch) {
            bestMethodMatch = row;
            break; // Rows are sorted by length DESC, so first match is longest prefix
        }
        if (rowMethod === '*' && !bestWildcardMatch) {
            bestWildcardMatch = row;
            // Don't break — keep looking for an exact method match with a shorter prefix
        }
    }

    if (bestMethodMatch) return parseRow(bestMethodMatch, EndpointAuthOverrideRowSchema);
    if (bestWildcardMatch) return parseRow(bestWildcardMatch, EndpointAuthOverrideRowSchema);

    return null;
}

// ===========================================================================
// Announcements CRUD
// ===========================================================================

/**
 * List all announcements, optionally filtered by active status.
 *
 * @param db         - D1 database binding (ADMIN_DB).
 * @param activeOnly - When `true`, only rows with `is_active = 1` are returned.
 * @returns Array of validated {@link AdminAnnouncementRow} objects, newest first.
 */
export async function listAnnouncements(
    db: D1Database,
    activeOnly?: boolean,
): Promise<AdminAnnouncementRow[]> {
    const query = activeOnly ? 'SELECT * FROM admin_announcements WHERE is_active = 1 ORDER BY created_at DESC' : 'SELECT * FROM admin_announcements ORDER BY created_at DESC';

    const result = await db.prepare(query).all();
    return parseRows(result.results ?? [], AdminAnnouncementRowSchema);
}

/**
 * Get currently active announcements.
 *
 * An announcement is "currently active" when:
 * - `is_active = 1`
 * - `active_from` is NULL or <= now
 * - `active_until` is NULL or >= now
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @returns Array of validated {@link AdminAnnouncementRow} objects, newest first.
 */
export async function getActiveAnnouncements(
    db: D1Database,
): Promise<AdminAnnouncementRow[]> {
    const result = await db
        .prepare(
            `SELECT * FROM admin_announcements
             WHERE is_active = 1
               AND (active_from IS NULL OR active_from <= datetime('now'))
               AND (active_until IS NULL OR active_until >= datetime('now'))
             ORDER BY created_at DESC`,
        )
        .all();
    return parseRows(result.results ?? [], AdminAnnouncementRowSchema);
}

/**
 * Insert a new announcement.
 *
 * @param db        - D1 database binding (ADMIN_DB).
 * @param data      - Validated create request payload.
 * @param createdBy - Identifier of the admin who created the announcement (e.g. Clerk user ID).
 * @returns The newly inserted, validated {@link AdminAnnouncementRow}.
 */
export async function createAnnouncement(
    db: D1Database,
    data: CreateAnnouncementRequest,
    createdBy: string,
): Promise<AdminAnnouncementRow> {
    const raw = await db
        .prepare(
            `INSERT INTO admin_announcements (title, body, severity, active_from, active_until, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             RETURNING *`,
        )
        .bind(
            data.title,
            data.body,
            data.severity,
            data.active_from ?? null,
            data.active_until ?? null,
            createdBy,
        )
        .first();

    return AdminAnnouncementRowSchema.parse(raw);
}

/**
 * Update an existing announcement by ID.
 *
 * Only the fields present in `data` are updated; omitted fields are left unchanged.
 *
 * @param db   - D1 database binding (ADMIN_DB).
 * @param id   - The auto-increment `id` of the announcement to update.
 * @param data - Validated partial update payload.
 * @returns The updated, validated row, or `null` if the announcement was not found.
 */
export async function updateAnnouncement(
    db: D1Database,
    id: number,
    data: UpdateAnnouncementRequest,
): Promise<AdminAnnouncementRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.title !== undefined) {
        setClauses.push(`title = ?${paramIdx}`);
        values.push(data.title);
        paramIdx++;
    }
    if (data.body !== undefined) {
        setClauses.push(`body = ?${paramIdx}`);
        values.push(data.body);
        paramIdx++;
    }
    if (data.severity !== undefined) {
        setClauses.push(`severity = ?${paramIdx}`);
        values.push(data.severity);
        paramIdx++;
    }
    if (data.active_from !== undefined) {
        setClauses.push(`active_from = ?${paramIdx}`);
        values.push(data.active_from);
        paramIdx++;
    }
    if (data.active_until !== undefined) {
        setClauses.push(`active_until = ?${paramIdx}`);
        values.push(data.active_until);
        paramIdx++;
    }
    if (data.is_active !== undefined) {
        setClauses.push(`is_active = ?${paramIdx}`);
        values.push(data.is_active ? 1 : 0);
        paramIdx++;
    }

    // Nothing to update — just return the current row
    if (setClauses.length === 0) {
        const raw = await db
            .prepare('SELECT * FROM admin_announcements WHERE id = ?1')
            .bind(id)
            .first();
        return parseRow(raw, AdminAnnouncementRowSchema);
    }

    // Always bump updated_at
    setClauses.push(`updated_at = datetime('now')`);

    // id is the final bind parameter for the WHERE clause
    values.push(id);

    const sql = `UPDATE admin_announcements SET ${setClauses.join(', ')} WHERE id = ?${paramIdx} RETURNING *`;

    const raw = await db.prepare(sql).bind(...values).first();
    return parseRow(raw, AdminAnnouncementRowSchema);
}

/**
 * Soft-delete an announcement by setting `is_active = 0`.
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @param id - The auto-increment `id` of the announcement to deactivate.
 * @returns `true` if a row was updated, `false` otherwise.
 */
export async function deleteAnnouncement(
    db: D1Database,
    id: number,
): Promise<boolean> {
    const result = await db
        .prepare(`UPDATE admin_announcements SET is_active = 0, updated_at = datetime('now') WHERE id = ?1`)
        .bind(id)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}
