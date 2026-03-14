/**
 * Admin Analytics Events — fire-and-forget helpers that write admin-specific
 * security and audit events to the Cloudflare Analytics Engine binding.
 *
 * These helpers sit *alongside* the existing {@link AnalyticsService} class
 * (in `src/services/AnalyticsService.ts`).  Rather than instantiating that
 * class, they call `env.ANALYTICS_ENGINE?.writeDataPoint()` directly, keeping
 * the admin layer decoupled from the compilation-focused analytics service.
 *
 * **Design constraints**
 * - Function-based, no classes.
 * - If `ANALYTICS_ENGINE` is undefined the call silently no-ops (never throws).
 * - All helpers are fire-and-forget — they never return a promise or throw.
 * - IP addresses are hashed before being written (privacy).
 *
 * @module admin-analytics-events
 */

import type { Env } from '../types.ts';

// ---------------------------------------------------------------------------
// Index constants (Analytics Engine `indexes[0]` — max 32 bytes)
// ---------------------------------------------------------------------------

/** @internal */ const IDX_ADMIN_ACTION = 'admin_action';
/** @internal */ const IDX_ADMIN_AUTH_FAILURE = 'admin_auth_failure';
/** @internal */ const IDX_ADMIN_CONFIG_CHANGE = 'admin_config_change';
/** @internal */ const IDX_FLAG_EVALUATION = 'flag_evaluation';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Privacy-preserving IP hash (mirrors `AnalyticsService.hashIp`).
 *
 * Produces a deterministic, non-reversible hex string prefixed with `ip_`.
 * @internal
 */
function hashIp(ip: string): string {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
        const char = ip.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return `ip_${Math.abs(hash).toString(16)}`;
}

/**
 * Safely write a data-point to Analytics Engine.
 *
 * Swallows all errors so callers never need try/catch.
 * @internal
 */
function safeWrite(
    env: Env,
    index: string,
    doubles: number[],
    blobs: (string | null)[],
): void {
    try {
        env.ANALYTICS_ENGINE?.writeDataPoint({
            indexes: [index],
            doubles,
            blobs,
        });
    } catch (_) {
        // Intentionally swallowed — analytics must never break the request path.
    }
}

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

/** Payload for {@link trackAdminAction}. */
export interface AdminActionEvent {
    /** Dot-notation action identifier, e.g. `'role.assign'`, `'tier.update'`. */
    action: string;
    /** Resource kind, e.g. `'admin_role'`, `'tier_config'`, `'feature_flag'`. */
    resourceType: string;
    /** Primary key / slug of the mutated resource. */
    resourceId: string;
    /** Clerk user-ID (or API-key identity) of the actor. */
    actorId: string;
    /** Raw client IP — will be hashed before storage. */
    ip: string;
    /** Whether the mutation succeeded. */
    success: boolean;
    /** Arbitrary key/value metadata (written as a JSON blob). */
    metadata?: Record<string, string>;
}

/** Payload for {@link trackAdminAuthFailure}. */
export interface AdminAuthFailureEvent {
    /** Human-readable reason for the failure. */
    reason: string;
    /** Permission that was required but missing (e.g. `'admin.write'`). */
    requiredPermission?: string;
    /** Clerk user-ID if the caller was partially identified. */
    actorId?: string;
    /** Raw client IP — will be hashed before storage. */
    ip: string;
    /** Request path that was denied. */
    endpoint: string;
}

/** Payload for {@link trackAdminConfigChange}. */
export interface AdminConfigChangeEvent {
    /** Kind of config being mutated. */
    configType: 'tier' | 'scope' | 'flag' | 'endpoint' | 'announcement';
    /** CRUD verb. */
    action: 'create' | 'update' | 'delete';
    /** Primary key / slug of the config entry. */
    configId: string;
    /** Clerk user-ID of the actor. */
    actorId: string;
}

/** Payload for {@link trackFeatureFlagEvaluation}. */
export interface FeatureFlagEvaluationEvent {
    /** Flag key, e.g. `'dark-mode'`. */
    flagName: string;
    /** Resolved boolean result of the evaluation. */
    result: boolean;
    /** User tier used during evaluation. */
    tier?: string;
    /** Clerk user-ID used during evaluation. */
    userId?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track an admin CRUD action (create / update / delete on any admin resource).
 *
 * **Data-point layout**
 * | Slot       | Value                                                  |
 * |------------|--------------------------------------------------------|
 * | indexes[0] | `'admin_action'`                                       |
 * | doubles[0] | `1` (success) or `0` (failure)                         |
 * | blobs[0]   | action (`'role.assign'`)                               |
 * | blobs[1]   | resourceType (`'admin_role'`)                          |
 * | blobs[2]   | resourceId                                             |
 * | blobs[3]   | hashed IP                                              |
 * | blobs[4]   | actorId                                                |
 * | blobs[5]   | JSON metadata (or `null`)                              |
 * | blobs[6]   | ISO timestamp                                          |
 *
 * @param env   - Worker `Env` (needs `ANALYTICS_ENGINE` binding)
 * @param event - Action details
 */
export function trackAdminAction(env: Env, event: AdminActionEvent): void {
    const doubles = [event.success ? 1 : 0];
    const blobs: (string | null)[] = [
        event.action,
        event.resourceType,
        event.resourceId,
        hashIp(event.ip),
        event.actorId,
        event.metadata ? JSON.stringify(event.metadata) : null,
        new Date().toISOString(),
    ];
    safeWrite(env, IDX_ADMIN_ACTION, doubles, blobs);
}

/**
 * Track an admin authentication or authorisation failure.
 *
 * **Data-point layout**
 * | Slot       | Value                                                  |
 * |------------|--------------------------------------------------------|
 * | indexes[0] | `'admin_auth_failure'`                                 |
 * | doubles[0] | `0` (always a failure)                                 |
 * | blobs[0]   | reason                                                 |
 * | blobs[1]   | requiredPermission (or `null`)                         |
 * | blobs[2]   | actorId (or `null`)                                    |
 * | blobs[3]   | hashed IP                                              |
 * | blobs[4]   | endpoint                                               |
 * | blobs[5]   | ISO timestamp                                          |
 *
 * @param env   - Worker `Env` (needs `ANALYTICS_ENGINE` binding)
 * @param event - Failure details
 */
export function trackAdminAuthFailure(env: Env, event: AdminAuthFailureEvent): void {
    const doubles = [0]; // always a failure
    const blobs: (string | null)[] = [
        event.reason,
        event.requiredPermission ?? null,
        event.actorId ?? null,
        hashIp(event.ip),
        event.endpoint,
        new Date().toISOString(),
    ];
    safeWrite(env, IDX_ADMIN_AUTH_FAILURE, doubles, blobs);
}

/**
 * Track an admin config mutation (tier / scope / flag / endpoint / announcement).
 *
 * **Data-point layout**
 * | Slot       | Value                                                  |
 * |------------|--------------------------------------------------------|
 * | indexes[0] | `'admin_config_change'`                                |
 * | doubles[0] | `1` (success — config changes are recorded post-commit)|
 * | blobs[0]   | configType (`'tier'`, `'scope'`, …)                    |
 * | blobs[1]   | action (`'create'`, `'update'`, `'delete'`)            |
 * | blobs[2]   | configId                                               |
 * | blobs[3]   | actorId                                                |
 * | blobs[4]   | ISO timestamp                                          |
 *
 * @param env   - Worker `Env` (needs `ANALYTICS_ENGINE` binding)
 * @param event - Config change details
 */
export function trackAdminConfigChange(env: Env, event: AdminConfigChangeEvent): void {
    const doubles = [1]; // recorded after successful commit
    const blobs: (string | null)[] = [
        event.configType,
        event.action,
        event.configId,
        event.actorId,
        new Date().toISOString(),
    ];
    safeWrite(env, IDX_ADMIN_CONFIG_CHANGE, doubles, blobs);
}

/**
 * Track a feature-flag evaluation (intended to be sampled, not called on
 * every request).
 *
 * **Data-point layout**
 * | Slot       | Value                                                  |
 * |------------|--------------------------------------------------------|
 * | indexes[0] | `'flag_evaluation'`                                    |
 * | doubles[0] | `1` (flag resolved to `true`) or `0` (`false`)         |
 * | blobs[0]   | flagName                                               |
 * | blobs[1]   | tier (or `null`)                                       |
 * | blobs[2]   | userId (or `null`)                                     |
 * | blobs[3]   | ISO timestamp                                          |
 *
 * @param env   - Worker `Env` (needs `ANALYTICS_ENGINE` binding)
 * @param event - Evaluation details
 */
export function trackFeatureFlagEvaluation(env: Env, event: FeatureFlagEvaluationEvent): void {
    const doubles = [event.result ? 1 : 0];
    const blobs: (string | null)[] = [
        event.flagName,
        event.tier ?? null,
        event.userId ?? null,
        new Date().toISOString(),
    ];
    safeWrite(env, IDX_FLAG_EVALUATION, doubles, blobs);
}
