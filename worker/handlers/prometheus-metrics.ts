/**
 * Prometheus-format metrics handler.
 *
 * Exposes compilation, cache, and error metrics from Cloudflare Analytics
 * Engine in the Prometheus text exposition format so that Grafana (or any
 * Prometheus-compatible scraper) can consume them directly.
 *
 * Route: GET /metrics/prometheus
 *
 * ## Adding custom metrics
 *
 * Import `registerPrometheusMetric` from `./prometheus-metric-registry.ts` in
 * any Worker module and call it at module load time.  No changes to this file
 * are required:
 *
 *   import { registerPrometheusMetric } from './prometheus-metric-registry.ts';
 *
 *   registerPrometheusMetric({
 *       name: 'adblock_workflow_active',
 *       type: 'gauge',
 *       help: 'Number of active compilation workflows.',
 *       collect: async (env) => countActiveWorkflows(env),
 *   });
 *
 * ## Wiring
 *
 * Add to worker/worker.ts (or worker/router.ts) before the catch-all handler:
 *
 *   if (pathname === '/metrics/prometheus' && request.method === 'GET') {
 *       return handlePrometheusMetrics(request, env);
 *   }
 *
 * ## Secrets required
 *
 *   wrangler secret put ANALYTICS_ACCOUNT_ID
 *   wrangler secret put ANALYTICS_API_TOKEN
 */

import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import { verifyAdminAuth } from '../middleware/index.ts';
import type { Env } from '../types.ts';
import { _clearRegistryForTesting, getRegisteredMetrics, registerPrometheusMetric, renderMetric } from './prometheus-metric-registry.ts';

// Re-export so callers only need one import site for the public API.
export { _clearRegistryForTesting, registerPrometheusMetric };

// ---------------------------------------------------------------------------
// Analytics Engine query helper
// ---------------------------------------------------------------------------

/**
 * Query the Analytics Engine SQL API.
 * The API token must have "Account Analytics Read" permission.
 */
async function queryAnalyticsEngine(
    sql: string,
    accountId: string,
    apiToken: string,
): Promise<{ data: Record<string, unknown>[] }> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
        throw new Error(`Analytics Engine query failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ data: Record<string, unknown>[] }>;
}

// ---------------------------------------------------------------------------
// Built-in metric registration
// ---------------------------------------------------------------------------
// These run once at module load time.  They query the Analytics Engine SQL API
// in a single batched request for efficiency.

/** Shared in-flight query promise to avoid N parallel requests on a single scrape. */
let _pendingQuery: Promise<Record<string, number>> | null = null;

// DATASET is a compile-time constant matching the binding name in wrangler.toml.
// It is not derived from user input and cannot be overridden at runtime,
// so template interpolation here is not a SQL injection risk.
const DATASET = 'adguard-compiler-analytics-engine';
const SQL = `
    SELECT
        countIf(index1 IN ('compilation_success', 'api_request')) AS total_requests,
        countIf(index1 = 'compilation_success')                   AS success_requests,
        countIf(index1 = 'compilation_error')                     AS error_requests,
        avgIf(double1, index1 = 'compilation_success')            AS avg_latency_ms,
        quantileIf(0.95)(double1, index1 = 'compilation_success') AS p95_latency_ms,
        countIf(index1 = 'cache_hit')                             AS cache_hits,
        countIf(index1 = 'cache_miss')                            AS cache_misses,
        countIf(index1 = 'rate_limit_exceeded')                   AS rate_limit_events,
        countIf(index1 = 'source_fetch_error')                    AS source_errors
    FROM \`${DATASET}\`
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
`;

async function fetchRow(env: Env): Promise<Record<string, number>> {
    if (!_pendingQuery) {
        _pendingQuery = (async () => {
            try {
                const result = await queryAnalyticsEngine(
                    SQL,
                    env.ANALYTICS_ACCOUNT_ID!,
                    env.ANALYTICS_API_TOKEN!,
                );
                const row = result.data[0] ?? {};
                return Object.fromEntries(
                    Object.entries(row).map(([k, v]) => [k, Number(v ?? 0)]),
                );
            } finally {
                // Reset so the next scrape gets fresh data
                _pendingQuery = null;
            }
        })();
    }
    return _pendingQuery;
}

// Register built-in metrics — each calls fetchRow() which is de-duplicated.
registerPrometheusMetric({
    name: 'adblock_compilation_requests',
    type: 'counter',
    help: 'Total number of compilation requests in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).total_requests ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_compilation_errors',
    type: 'counter',
    help: 'Total number of compilation errors in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).error_requests ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_compilation_error_rate',
    type: 'gauge',
    help: 'Compilation error rate (0–1) over the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        const row = await fetchRow(env);
        const total = row.total_requests ?? 0;
        return total > 0 ? (row.error_requests ?? 0) / total : 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_compilation_latency_avg_ms',
    type: 'gauge',
    help: 'Average successful compilation latency in milliseconds over the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).avg_latency_ms ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_compilation_latency_p95_ms',
    type: 'gauge',
    help: 'P95 compilation latency in milliseconds over the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).p95_latency_ms ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_cache_hits',
    type: 'counter',
    help: 'Total cache hits in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).cache_hits ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_cache_misses',
    type: 'counter',
    help: 'Total cache misses in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).cache_misses ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_cache_hit_rate',
    type: 'gauge',
    help: 'Cache hit rate (0–1) over the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        const row = await fetchRow(env);
        const total = (row.cache_hits ?? 0) + (row.cache_misses ?? 0);
        return total > 0 ? (row.cache_hits ?? 0) / total : 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_rate_limit_events',
    type: 'counter',
    help: 'Total rate limit exceeded events in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).rate_limit_events ?? 0;
    },
});

registerPrometheusMetric({
    name: 'adblock_source_fetch_errors',
    type: 'counter',
    help: 'Total source fetch errors in the last 24 hours.',
    collect: async (env) => {
        if (!env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) return null;
        return (await fetchRow(env)).source_errors ?? 0;
    },
});

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

/**
 * Handle GET /metrics/prometheus
 *
 * Iterates all registered metrics (built-in + custom) and renders them as
 * Prometheus text exposition format (version 0.0.4).
 *
 * Protected by admin key — callers must supply `X-Admin-Key` header.
 */
export async function handlePrometheusMetrics(request: Request, env: Env): Promise<Response> {
    const auth = await verifyAdminAuth(request, env);
    if (!auth.authorized) {
        // ZTA: emit security event for auth failures on this endpoint.
        // AnalyticsService is no-op when env.ANALYTICS_ENGINE is undefined.
        new AnalyticsService(env.ANALYTICS_ENGINE).trackSecurityEvent({
            eventType: 'auth_failure',
            path: '/metrics/prometheus',
            method: request.method,
            reason: auth.error ?? 'Unauthorized',
        });
        return new Response(auth.error ?? 'Unauthorized', { status: 401 });
    }

    const defs = getRegisteredMetrics();
    const secretsMissing = !env.ANALYTICS_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN;

    // Collect all metrics in parallel
    const values = await Promise.all(defs.map((def) => {
        try {
            return Promise.resolve(def.collect(env));
        } catch {
            return Promise.resolve(null);
        }
    }));

    const lines: string[] = [];
    for (let i = 0; i < defs.length; i++) {
        const rendered = renderMetric(defs[i], values[i] ?? null);
        if (rendered) lines.push(rendered);
    }

    if (secretsMissing) {
        lines.push(
            '# note: ANALYTICS_ACCOUNT_ID or ANALYTICS_API_TOKEN not configured — all values are zero',
        );
    }

    // Trailing newline required by Prometheus spec
    lines.push('');

    return new Response(lines.join('\n'), {
        headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
