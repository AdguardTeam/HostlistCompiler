/**
 * Tests for Admin Registry Service — D1-backed tier & scope registries with KV caching.
 *
 * Covers:
 *   - loadTierRegistry() — KV cache hit, D1 query + write-through, hardcoded fallback
 *   - loadScopeRegistry() — KV cache hit, D1 query + write-through, hardcoded fallback
 *   - invalidateTierCache() — deletes KV key
 *   - invalidateScopeCache() — deletes KV key
 *   - isTierSufficientDynamic() — uses dynamic registry, falls back to static
 *   - getTierRateLimit() — reads from dynamic registry, falls back to TIER_RATE_LIMITS
 */

import { assertEquals } from '@std/assert';
import { SCOPE_REGISTRY, TIER_RATE_LIMITS, TIER_REGISTRY, UserTier } from '../types';
import { getTierRateLimit, invalidateScopeCache, invalidateTierCache, isTierSufficientDynamic, loadScopeRegistry, loadTierRegistry } from './admin-registry-service';
import type { Env } from '../types';

// ============================================================================
// Mock KV Namespace
// ============================================================================

interface MockKVEntry {
    value: string;
    ttl?: number;
}

function createMockKV(initialJson?: Record<string, unknown>) {
    const store = new Map<string, MockKVEntry>();
    if (initialJson) {
        for (const [k, v] of Object.entries(initialJson)) {
            store.set(k, { value: JSON.stringify(v) });
        }
    }

    return {
        store,
        async get<T>(key: string, type?: string): Promise<T | null> {
            const entry = store.get(key);
            if (!entry) return null;
            if (type === 'json') return JSON.parse(entry.value) as T;
            return entry.value as unknown as T;
        },
        async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
            store.set(key, { value, ttl: opts?.expirationTtl });
        },
        async delete(key: string): Promise<void> {
            store.delete(key);
        },
        // stubs required by KVNamespace interface
        async list() {
            return { keys: [], list_complete: true, cacheStatus: null };
        },
        async getWithMetadata<T>(key: string, type?: string) {
            const val = await this.get<T>(key, type);
            return { value: val, metadata: null, cacheStatus: null };
        },
    };
}

/** A KV mock that always throws on reads (to trigger fallback paths). */
function createThrowingKV() {
    return {
        async get(): Promise<never> {
            throw new Error('KV unavailable');
        },
        async put(): Promise<void> {},
        async delete(): Promise<void> {},
        async list() {
            return { keys: [], list_complete: true, cacheStatus: null };
        },
        async getWithMetadata() {
            return { value: null, metadata: null, cacheStatus: null };
        },
    };
}

// ============================================================================
// Mock D1 for tier / scope list queries
// ============================================================================

type RawRow = Record<string, unknown>;

function createMockD1WithTiers(tierRows: RawRow[], scopeRows: RawRow[]) {
    function makeStmt(rows: RawRow[]) {
        const stmt = {
            bind(..._vals: unknown[]) {
                return stmt;
            },
            async first<T>(): Promise<T | null> {
                return rows[0] as T ?? null;
            },
            async all<T>(): Promise<{ results: T[]; success: boolean }> {
                return { results: rows as T[], success: true };
            },
            async run() {
                return { success: true, meta: { changes: 0 } };
            },
            async raw<T>(): Promise<T[]> {
                return [];
            },
        };
        return stmt;
    }

    return {
        prepare(sql: string) {
            if (/tier_configs/i.test(sql)) return makeStmt(tierRows);
            if (/scope_configs/i.test(sql)) return makeStmt(scopeRows);
            return makeStmt([]);
        },
        async dump() {
            return new ArrayBuffer(0);
        },
        async batch() {
            return [];
        },
        async exec() {
            return { count: 0, duration: 0 };
        },
    };
}

// ============================================================================
// Helper to build minimal Env
// ============================================================================

function makeEnv(kv: ReturnType<typeof createMockKV> | ReturnType<typeof createThrowingKV>, adminDb?: unknown): Env {
    return {
        RATE_LIMIT: kv as unknown as KVNamespace,
        ADMIN_DB: adminDb as Env['ADMIN_DB'],
    } as unknown as Env;
}

// ============================================================================
// loadTierRegistry
// ============================================================================

Deno.test('loadTierRegistry - returns KV-cached value when available', async () => {
    const cached = { pro: { order: 2, rateLimit: 300, displayName: 'Pro', description: 'Pro tier' } };
    const kv = createMockKV({ 'admin:registry:tiers': cached });
    const result = await loadTierRegistry(makeEnv(kv));
    assertEquals(result.pro.order, 2);
    assertEquals(result.pro.rateLimit, 300);
});

Deno.test('loadTierRegistry - falls back to hardcoded TIER_REGISTRY when KV empty and no ADMIN_DB', async () => {
    const kv = createMockKV();
    const result = await loadTierRegistry(makeEnv(kv));
    assertEquals(result[UserTier.Free].order, TIER_REGISTRY[UserTier.Free].order);
    assertEquals(result[UserTier.Pro].rateLimit, TIER_REGISTRY[UserTier.Pro].rateLimit);
});

Deno.test('loadTierRegistry - queries D1 when KV is empty and ADMIN_DB available', async () => {
    const kv = createMockKV();
    const tierRows = [
        {
            tier_name: 'free',
            order_rank: 1,
            rate_limit: 60,
            display_name: 'Free',
            description: 'Free tier',
            features: '[]',
            is_active: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        },
        {
            tier_name: 'pro',
            order_rank: 2,
            rate_limit: 300,
            display_name: 'Pro',
            description: 'Pro tier',
            features: '["compile"]',
            is_active: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        },
    ];
    const db = createMockD1WithTiers(tierRows, []);
    const result = await loadTierRegistry(makeEnv(kv, db));
    assertEquals(result['free'].order, 1);
    assertEquals(result['pro'].rateLimit, 300);
});

Deno.test('loadTierRegistry - falls back to hardcoded when KV throws', async () => {
    const result = await loadTierRegistry(makeEnv(createThrowingKV()));
    assertEquals(result[UserTier.Free].order, TIER_REGISTRY[UserTier.Free].order);
});

// ============================================================================
// loadScopeRegistry
// ============================================================================

Deno.test('loadScopeRegistry - returns KV-cached value when available', async () => {
    const cached = { compile: { displayName: 'Compile', description: 'Compile rules', requiredTier: 'free' } };
    const kv = createMockKV({ 'admin:registry:scopes': cached });
    const result = await loadScopeRegistry(makeEnv(kv));
    assertEquals(result.compile.displayName, 'Compile');
});

Deno.test('loadScopeRegistry - falls back to hardcoded SCOPE_REGISTRY when KV empty and no ADMIN_DB', async () => {
    const kv = createMockKV();
    const result = await loadScopeRegistry(makeEnv(kv));
    // SCOPE_REGISTRY keys should be present
    const registryKeys = Object.keys(SCOPE_REGISTRY);
    for (const key of registryKeys.slice(0, 2)) {
        assertEquals(result[key] !== undefined, true);
    }
});

Deno.test('loadScopeRegistry - queries D1 when KV is empty and ADMIN_DB available', async () => {
    const kv = createMockKV();
    const scopeRows = [
        {
            scope_name: 'compile',
            display_name: 'Compile',
            description: 'Compile rules',
            required_tier: 'free',
            is_public: 1,
            is_active: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        },
    ];
    const db = createMockD1WithTiers([], scopeRows);
    const result = await loadScopeRegistry(makeEnv(kv, db));
    assertEquals(result['compile'].requiredTier, 'free');
});

// ============================================================================
// invalidateTierCache
// ============================================================================

Deno.test('invalidateTierCache - deletes the tier KV key', async () => {
    const kv = createMockKV({ 'admin:registry:tiers': { pro: {} } });
    assertEquals(kv.store.has('admin:registry:tiers'), true);
    await invalidateTierCache(kv as unknown as KVNamespace);
    assertEquals(kv.store.has('admin:registry:tiers'), false);
});

// ============================================================================
// invalidateScopeCache
// ============================================================================

Deno.test('invalidateScopeCache - deletes the scope KV key', async () => {
    const kv = createMockKV({ 'admin:registry:scopes': { compile: {} } });
    assertEquals(kv.store.has('admin:registry:scopes'), true);
    await invalidateScopeCache(kv as unknown as KVNamespace);
    assertEquals(kv.store.has('admin:registry:scopes'), false);
});

// ============================================================================
// isTierSufficientDynamic
// ============================================================================

Deno.test('isTierSufficientDynamic - returns true when actual tier order >= required', async () => {
    const registry = {
        [UserTier.Free]: { order: 1, rateLimit: 60, displayName: 'Free', description: '' },
        [UserTier.Pro]: { order: 2, rateLimit: 300, displayName: 'Pro', description: '' },
    };
    const kv = createMockKV({ 'admin:registry:tiers': registry });
    const result = await isTierSufficientDynamic(makeEnv(kv), UserTier.Pro, UserTier.Free);
    assertEquals(result, true);
});

Deno.test('isTierSufficientDynamic - returns false when actual tier order < required', async () => {
    const registry = {
        [UserTier.Free]: { order: 1, rateLimit: 60, displayName: 'Free', description: '' },
        [UserTier.Pro]: { order: 2, rateLimit: 300, displayName: 'Pro', description: '' },
    };
    const kv = createMockKV({ 'admin:registry:tiers': registry });
    const result = await isTierSufficientDynamic(makeEnv(kv), UserTier.Free, UserTier.Pro);
    assertEquals(result, false);
});

Deno.test('isTierSufficientDynamic - falls back to static isTierSufficient on KV error', async () => {
    // Throwing KV causes fallback to static isTierSufficient(pro, free) → true
    const result = await isTierSufficientDynamic(makeEnv(createThrowingKV()), UserTier.Pro, UserTier.Free);
    assertEquals(result, true);
});

// ============================================================================
// getTierRateLimit
// ============================================================================

Deno.test('getTierRateLimit - returns rate limit for tier from dynamic registry', async () => {
    const registry = {
        [UserTier.Pro]: { order: 2, rateLimit: 500, displayName: 'Pro', description: '' },
    };
    const kv = createMockKV({ 'admin:registry:tiers': registry });
    const result = await getTierRateLimit(makeEnv(kv), UserTier.Pro);
    assertEquals(result, 500);
});

Deno.test('getTierRateLimit - falls back to TIER_RATE_LIMITS when KV throws', async () => {
    const result = await getTierRateLimit(makeEnv(createThrowingKV()), UserTier.Free);
    assertEquals(result, TIER_RATE_LIMITS[UserTier.Free]);
});
