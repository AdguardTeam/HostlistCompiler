/**
 * Admin Registry Service — D1-backed tier & scope registries with KV caching.
 *
 * Read path (for both tiers and scopes):
 *   1. KV cache hit  → return immediately (avoids D1 round-trip)
 *   2. KV miss + D1  → query active rows, write-through to KV (300 s TTL)
 *   3. D1 unavailable or throws → fall back to hardcoded constants in ../types
 *
 * The hardcoded constants (`TIER_REGISTRY` / `SCOPE_REGISTRY`) remain the
 * canonical compile-time source of truth; this service layers a dynamic
 * override on top so that admin CRUD mutations are reflected without a deploy.
 *
 * All functions are pure (no module-level state) and safe to call concurrently.
 */

import type { Env } from '../types';
import { type IScopeConfig, isTierSufficient, type ITierConfig, SCOPE_REGISTRY, TIER_RATE_LIMITS, TIER_REGISTRY, UserTier } from '../types';
import { listScopeConfigs, listTierConfigs } from './admin-config-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KV key for the cached tier registry. */
const KV_KEY_TIERS = 'admin:registry:tiers';

/** KV key for the cached scope registry. */
const KV_KEY_SCOPES = 'admin:registry:scopes';

/** KV write-through TTL in seconds (5 minutes). */
const CACHE_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// Tier Registry
// ---------------------------------------------------------------------------

/**
 * Load the tier registry, preferring KV cache → D1 → hardcoded fallback.
 *
 * The returned record is keyed by the tier name string (e.g. `"anonymous"`)
 * and each value conforms to `ITierConfig`.
 *
 * @param env - Worker `Env` bindings (needs `RATE_LIMIT` KV and optional `ADMIN_DB`).
 * @returns Resolved tier registry — dynamic if D1 is available, static otherwise.
 */
export async function loadTierRegistry(
    env: Env,
): Promise<Record<string, ITierConfig>> {
    // 1. KV cache hit
    try {
        const cached = await env.RATE_LIMIT.get<Record<string, ITierConfig>>(
            KV_KEY_TIERS,
            'json',
        );
        if (cached) return cached;
    } catch {
        // KV read failure — continue to D1.
    }

    // 2. D1 query (only if binding exists)
    if (env.ADMIN_DB) {
        try {
            const rows = await listTierConfigs(env.ADMIN_DB, true);
            const registry: Record<string, ITierConfig> = {};
            for (const row of rows) {
                registry[row.tier_name] = {
                    order: row.order_rank,
                    rateLimit: row.rate_limit,
                    displayName: row.display_name,
                    description: row.description,
                };
            }

            // Write-through to KV (fire-and-forget — failures are non-fatal).
            env.RATE_LIMIT.put(KV_KEY_TIERS, JSON.stringify(registry), {
                expirationTtl: CACHE_TTL_SECONDS,
            }).catch(() => {});

            return registry;
        } catch {
            // D1 failure — fall through to hardcoded.
        }
    }

    // 3. Hardcoded fallback
    return { ...TIER_REGISTRY };
}

// ---------------------------------------------------------------------------
// Scope Registry
// ---------------------------------------------------------------------------

/**
 * Load the scope registry, preferring KV cache → D1 → hardcoded fallback.
 *
 * The returned record is keyed by the scope name string (e.g. `"compile"`)
 * and each value conforms to `IScopeConfig`.
 *
 * @param env - Worker `Env` bindings (needs `RATE_LIMIT` KV and optional `ADMIN_DB`).
 * @returns Resolved scope registry — dynamic if D1 is available, static otherwise.
 */
export async function loadScopeRegistry(
    env: Env,
): Promise<Record<string, IScopeConfig>> {
    // 1. KV cache hit
    try {
        const cached = await env.RATE_LIMIT.get<Record<string, IScopeConfig>>(
            KV_KEY_SCOPES,
            'json',
        );
        if (cached) return cached;
    } catch {
        // KV read failure — continue to D1.
    }

    // 2. D1 query (only if binding exists)
    if (env.ADMIN_DB) {
        try {
            const rows = await listScopeConfigs(env.ADMIN_DB, true);
            const registry: Record<string, IScopeConfig> = {};
            for (const row of rows) {
                registry[row.scope_name] = {
                    displayName: row.display_name,
                    description: row.description,
                    requiredTier: row.required_tier as UserTier,
                };
            }

            // Write-through to KV (fire-and-forget).
            env.RATE_LIMIT.put(KV_KEY_SCOPES, JSON.stringify(registry), {
                expirationTtl: CACHE_TTL_SECONDS,
            }).catch(() => {});

            return registry;
        } catch {
            // D1 failure — fall through to hardcoded.
        }
    }

    // 3. Hardcoded fallback
    return { ...SCOPE_REGISTRY };
}

// ---------------------------------------------------------------------------
// Cache Invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate the KV-cached tier registry.
 *
 * Call this after any admin CRUD mutation that modifies tier configs so the
 * next `loadTierRegistry()` call re-fetches from D1.
 *
 * @param kv - The `RATE_LIMIT` KV namespace binding.
 */
export async function invalidateTierCache(kv: KVNamespace): Promise<void> {
    await kv.delete(KV_KEY_TIERS);
}

/**
 * Invalidate the KV-cached scope registry.
 *
 * Call this after any admin CRUD mutation that modifies scope configs so the
 * next `loadScopeRegistry()` call re-fetches from D1.
 *
 * @param kv - The `RATE_LIMIT` KV namespace binding.
 */
export async function invalidateScopeCache(kv: KVNamespace): Promise<void> {
    await kv.delete(KV_KEY_SCOPES);
}

// ---------------------------------------------------------------------------
// Dynamic Tier Helpers
// ---------------------------------------------------------------------------

/**
 * Dynamically check whether `actual` tier meets or exceeds `required` tier.
 *
 * Uses the D1-backed tier registry (via `loadTierRegistry`) to resolve order
 * values.  If the dynamic registry cannot be loaded or the tier names are not
 * present in the resolved registry, falls back to the compile-time static
 * `isTierSufficient()` from `../types`.
 *
 * @param env      - Worker `Env` bindings.
 * @param actual   - The user's current tier.
 * @param required - The minimum tier required.
 * @returns `true` when the user's tier order is ≥ the required tier order.
 */
export async function isTierSufficientDynamic(
    env: Env,
    actual: UserTier,
    required: UserTier,
): Promise<boolean> {
    try {
        const registry = await loadTierRegistry(env);
        const actualConfig = registry[actual];
        const requiredConfig = registry[required];

        if (actualConfig && requiredConfig) {
            return actualConfig.order >= requiredConfig.order;
        }
    } catch {
        // Registry load failed — use static fallback.
    }

    return isTierSufficient(actual, required);
}

/**
 * Look up the rate-limit value for a given tier from the dynamic registry.
 *
 * Falls back to the compile-time `TIER_RATE_LIMITS` if the dynamic registry
 * is unavailable or does not contain the requested tier.
 *
 * @param env  - Worker `Env` bindings.
 * @param tier - The tier whose rate limit to retrieve.
 * @returns Requests-per-window limit for the tier.
 */
export async function getTierRateLimit(
    env: Env,
    tier: UserTier,
): Promise<number> {
    try {
        const registry = await loadTierRegistry(env);
        const config = registry[tier];
        if (config) return config.rateLimit;
    } catch {
        // Registry load failed — use static fallback.
    }

    return TIER_RATE_LIMITS[tier];
}
