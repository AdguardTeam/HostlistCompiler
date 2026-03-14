/**
 * Admin Feature Flag Service — D1 CRUD and evaluation for feature flags.
 *
 * All queries use parameterized `.prepare().bind()` (never string interpolation).
 * All row results are Zod-validated before being returned.
 * JSON array columns (target_tiers, target_users) are serialized on write and
 * deserialized via Zod transforms on read.
 */

import type { D1Database } from '../types';
import { type CreateFeatureFlagRequest, type FeatureFlagRow, FeatureFlagRowSchema, type UpdateFeatureFlagRequest } from '../schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context passed to flag evaluation for targeting decisions. */
export interface FlagEvaluationContext {
    /** User tier, e.g. 'free', 'pro', 'admin'. */
    userTier?: string;
    /** Clerk user ID for user-level targeting. */
    clerkUserId?: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash: sum of character codes modulo 100.
 * Returns a value in 0-99, used for rollout percentage bucketing.
 */
function simpleHash(str: string): number {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
        sum += str.charCodeAt(i);
    }
    return sum % 100;
}

/**
 * Parse and validate a raw D1 row through the FeatureFlagRow Zod schema.
 * Returns `null` when the input is nullish.
 */
function parseRow(raw: unknown): FeatureFlagRow | null {
    if (raw == null) return null;
    return FeatureFlagRowSchema.parse(raw);
}

/**
 * Parse an array of raw D1 rows through the FeatureFlagRow Zod schema.
 */
function parseRows(raw: unknown[]): FeatureFlagRow[] {
    return raw.map((r) => FeatureFlagRowSchema.parse(r));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * List all feature flags, optionally filtering to enabled-only.
 *
 * @param db          - D1 database binding (ADMIN_DB).
 * @param enabledOnly - When `true`, only flags with `enabled = 1` are returned.
 * @returns Array of validated {@link FeatureFlagRow} objects.
 */
export async function listFeatureFlags(
    db: D1Database,
    enabledOnly?: boolean,
): Promise<FeatureFlagRow[]> {
    const query = enabledOnly ? 'SELECT * FROM feature_flags WHERE enabled = 1 ORDER BY flag_name ASC' : 'SELECT * FROM feature_flags ORDER BY flag_name ASC';

    const result = await db.prepare(query).all();
    return parseRows(result.results ?? []);
}

/**
 * Get a single feature flag by its unique name.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param flagName - The `flag_name` to look up.
 * @returns The validated row, or `null` if not found.
 */
export async function getFeatureFlag(
    db: D1Database,
    flagName: string,
): Promise<FeatureFlagRow | null> {
    const raw = await db
        .prepare('SELECT * FROM feature_flags WHERE flag_name = ?1')
        .bind(flagName)
        .first();
    return parseRow(raw);
}

/**
 * Get a single feature flag by its numeric ID.
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @param id - The auto-increment `id` to look up.
 * @returns The validated row, or `null` if not found.
 */
export async function getFeatureFlagById(
    db: D1Database,
    id: number,
): Promise<FeatureFlagRow | null> {
    const raw = await db
        .prepare('SELECT * FROM feature_flags WHERE id = ?1')
        .bind(id)
        .first();
    return parseRow(raw);
}

/**
 * Insert a new feature flag.
 *
 * Array fields (`target_tiers`, `target_users`) are JSON-serialized for storage.
 * The boolean `enabled` field is stored as an integer (1/0).
 *
 * @param db        - D1 database binding (ADMIN_DB).
 * @param data      - Validated create request payload.
 * @param createdBy - Identifier of the admin who created the flag (e.g. Clerk user ID).
 * @returns The newly inserted, validated {@link FeatureFlagRow}.
 */
export async function createFeatureFlag(
    db: D1Database,
    data: CreateFeatureFlagRequest,
    createdBy: string,
): Promise<FeatureFlagRow> {
    const raw = await db
        .prepare(
            `INSERT INTO feature_flags (flag_name, enabled, rollout_percentage, target_tiers, target_users, description, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             RETURNING *`,
        )
        .bind(
            data.flag_name,
            data.enabled ? 1 : 0,
            data.rollout_percentage,
            JSON.stringify(data.target_tiers),
            JSON.stringify(data.target_users),
            data.description,
            createdBy,
        )
        .first();

    return FeatureFlagRowSchema.parse(raw);
}

/**
 * Update an existing feature flag by name.
 *
 * Only the fields present in `data` are updated; omitted fields are left unchanged.
 * Array fields are JSON-serialized. The boolean `enabled` is stored as 1/0.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param flagName - The `flag_name` of the flag to update.
 * @param data     - Validated partial update payload.
 * @returns The updated, validated row, or `null` if the flag was not found.
 */
export async function updateFeatureFlag(
    db: D1Database,
    flagName: string,
    data: UpdateFeatureFlagRequest,
): Promise<FeatureFlagRow | null> {
    // Build SET clauses dynamically from provided fields
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.enabled !== undefined) {
        setClauses.push(`enabled = ?${paramIdx}`);
        values.push(data.enabled ? 1 : 0);
        paramIdx++;
    }
    if (data.rollout_percentage !== undefined) {
        setClauses.push(`rollout_percentage = ?${paramIdx}`);
        values.push(data.rollout_percentage);
        paramIdx++;
    }
    if (data.target_tiers !== undefined) {
        setClauses.push(`target_tiers = ?${paramIdx}`);
        values.push(JSON.stringify(data.target_tiers));
        paramIdx++;
    }
    if (data.target_users !== undefined) {
        setClauses.push(`target_users = ?${paramIdx}`);
        values.push(JSON.stringify(data.target_users));
        paramIdx++;
    }
    if (data.description !== undefined) {
        setClauses.push(`description = ?${paramIdx}`);
        values.push(data.description);
        paramIdx++;
    }

    // Nothing to update — just return the current row
    if (setClauses.length === 0) {
        return getFeatureFlag(db, flagName);
    }

    // Always bump updated_at
    setClauses.push(`updated_at = datetime('now')`);

    // Flag name is the final bind parameter for the WHERE clause
    values.push(flagName);

    const sql = `UPDATE feature_flags SET ${setClauses.join(', ')} WHERE flag_name = ?${paramIdx} RETURNING *`;

    const raw = await db.prepare(sql).bind(...values).first();
    return parseRow(raw);
}

/**
 * Hard-delete a feature flag by name.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param flagName - The `flag_name` of the flag to delete.
 * @returns `true` if a row was deleted, `false` otherwise.
 */
export async function deleteFeatureFlag(
    db: D1Database,
    flagName: string,
): Promise<boolean> {
    const result = await db
        .prepare('DELETE FROM feature_flags WHERE flag_name = ?1')
        .bind(flagName)
        .run();
    return (result.meta?.changes ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a feature flag is active for the given context.
 *
 * Evaluation order:
 * 1. If the flag does not exist or is disabled → `false`.
 * 2. If `target_users` is non-empty and includes `clerkUserId` → `true` (user override).
 * 3. If `target_tiers` is non-empty and does NOT include `userTier` → `false`.
 * 4. Rollout percentage: deterministically hash `flagName + clerkUserId` (or a random
 *    seed when no user ID is available) and check if the bucket < rollout_percentage.
 *
 * @param db       - D1 database binding (ADMIN_DB).
 * @param flagName - The `flag_name` to evaluate.
 * @param context  - Targeting context (tier, user ID).
 * @returns `true` if the flag is active for this context, `false` otherwise.
 */
export async function evaluateFlag(
    db: D1Database,
    flagName: string,
    context: FlagEvaluationContext = {},
): Promise<boolean> {
    const flag = await getFeatureFlag(db, flagName);

    // Step 1: flag missing or disabled
    if (!flag || !flag.enabled) return false;

    // Step 2: explicit user-level override
    if (flag.target_users.length > 0 && context.clerkUserId) {
        if (flag.target_users.includes(context.clerkUserId)) return true;
    }

    // Step 3: tier targeting
    if (flag.target_tiers.length > 0) {
        if (!context.userTier || !flag.target_tiers.includes(context.userTier)) {
            return false;
        }
    }

    // Step 4: rollout percentage
    if (flag.rollout_percentage >= 100) return true;
    if (flag.rollout_percentage <= 0) return false;

    // Anonymous users without a stable identity are not eligible for percentage rollout
    // to ensure deterministic behavior (no random flicker between requests).
    if (!context.clerkUserId) return false;
    const seed = `${flagName}${context.clerkUserId}`;
    const bucket = simpleHash(seed);
    return bucket < flag.rollout_percentage;
}

/**
 * Batch-evaluate multiple feature flags for the same context.
 *
 * @param db        - D1 database binding (ADMIN_DB).
 * @param flagNames - Array of flag names to evaluate.
 * @param context   - Targeting context (tier, user ID).
 * @returns Map of flag name → boolean result.
 */
export async function evaluateFlags(
    db: D1Database,
    flagNames: string[],
    context: FlagEvaluationContext = {},
): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    await Promise.all(
        flagNames.map(async (name) => {
            results[name] = await evaluateFlag(db, name, context);
        }),
    );
    return results;
}

/**
 * Return the names of all currently enabled feature flags.
 *
 * Useful for lightweight "is any of these flags on?" checks without fetching
 * full row data.
 *
 * @param db - D1 database binding (ADMIN_DB).
 * @returns Array of `flag_name` strings for all enabled flags.
 */
export async function getAllEnabledFlagNames(db: D1Database): Promise<string[]> {
    const result = await db
        .prepare('SELECT flag_name FROM feature_flags WHERE enabled = 1 ORDER BY flag_name ASC')
        .all<{ flag_name: string }>();
    return (result.results ?? []).map((r: { flag_name: string }) => r.flag_name);
}
