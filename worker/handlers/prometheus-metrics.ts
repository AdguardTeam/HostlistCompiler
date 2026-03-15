/**
 * Prometheus-format metrics handler.
 *
 * Exposes compilation, cache, and error metrics from Cloudflare Analytics
 * Engine in the Prometheus text exposition format so that Grafana (or any
 * Prometheus-compatible scraper) can consume them directly.
 *
 * Route: GET /metrics/prometheus
 *
 * TODO: Wire this handler into worker/router.ts (or worker/worker.ts) at the
 * /metrics/prometheus path, e.g.:
 *
 *   if (pathname === '/metrics/prometheus' && request.method === 'GET') {
 *       return handlePrometheusMetrics(env);
 *   }
 *
 * TODO: Add ANALYTICS_ACCOUNT_ID and ANALYTICS_API_TOKEN to Worker secrets
 * so the Analytics Engine SQL API can be queried at runtime.
 */

import type { Env } from '../types.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import { verifyAdminAuth } from '../middleware/index.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricsSummary {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    errorRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    rateLimitEvents: number;
    sourceErrors: number;
    /** True when ANALYTICS_ACCOUNT_ID or ANALYTICS_API_TOKEN are missing. */
    secretsMissing?: boolean;
}

// ---------------------------------------------------------------------------
// Analytics Engine SQL query helpers
// ---------------------------------------------------------------------------

/**
 * Query the Analytics Engine SQL API.
 *
 * TODO: Replace the account ID placeholder with your real Cloudflare account ID.
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

/**
 * Fetch a summary of the last 24 hours from Analytics Engine.
 */
async function fetchMetricsSummary(env: Env): Promise<MetricsSummary> {
    const accountId = env.ANALYTICS_ACCOUNT_ID;
    const apiToken = env.ANALYTICS_API_TOKEN;

    if (!accountId || !apiToken) {
        // Fall back to zeroed summary when secrets are not yet configured
        return {
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            errorRate: 0,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheHitRate: 0,
            rateLimitEvents: 0,
            sourceErrors: 0,
            secretsMissing: true,
        };
    }

    // TODO(#analytics-dataset): Replace 'adguard-compiler-analytics-engine' with your dataset name
    // if it differs from the one in wrangler.toml.
    const dataset = 'adguard-compiler-analytics-engine';

    const sql = `
        SELECT
            countIf(index1 IN ('compilation_success', 'api_request')) AS total_requests,
            countIf(index1 = 'compilation_success') AS success_requests,
            countIf(index1 = 'compilation_error') AS error_requests,
            avgIf(double1, index1 = 'compilation_success') AS avg_latency_ms,
            quantileIf(0.95)(double1, index1 = 'compilation_success') AS p95_latency_ms,
            countIf(index1 = 'cache_hit') AS cache_hits,
            countIf(index1 = 'cache_miss') AS cache_misses,
            countIf(index1 = 'rate_limit_exceeded') AS rate_limit_events,
            countIf(index1 = 'source_fetch_error') AS source_errors
        FROM ${dataset}
        WHERE timestamp > NOW() - INTERVAL '24' HOUR
    `;

    try {
        const result = await queryAnalyticsEngine(sql, accountId, apiToken);
        const row = result.data[0] ?? {};

        const totalRequests = Number(row.total_requests ?? 0);
        const errorRequests = Number(row.error_requests ?? 0);
        const cacheHits = Number(row.cache_hits ?? 0);
        const cacheMisses = Number(row.cache_misses ?? 0);
        const cacheTotal = cacheHits + cacheMisses;

        return {
            totalRequests,
            successRequests: Number(row.success_requests ?? 0),
            errorRequests,
            errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
            avgLatencyMs: Number(row.avg_latency_ms ?? 0),
            p95LatencyMs: Number(row.p95_latency_ms ?? 0),
            cacheHits,
            cacheMisses,
            cacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
            rateLimitEvents: Number(row.rate_limit_events ?? 0),
            sourceErrors: Number(row.source_errors ?? 0),
        };
    } catch (_err) {
        // Return zeroed metrics rather than surfacing query errors to scrapers
        return {
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            errorRate: 0,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheHitRate: 0,
            rateLimitEvents: 0,
            sourceErrors: 0,
        };
    }
}

// ---------------------------------------------------------------------------
// Prometheus text format helpers
// ---------------------------------------------------------------------------

function gauge(name: string, help: string, value: number, labels?: Record<string, string>): string {
    const labelStr = labels ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : '';
    return [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} gauge`,
        `${name}${labelStr} ${value}`,
    ].join('\n');
}

function counter(name: string, help: string, value: number, labels?: Record<string, string>): string {
    const labelStr = labels ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : '';
    // HELP and TYPE must reference the full metric name including _total suffix
    // per the Prometheus text format spec (section 2.3).
    return [
        `# HELP ${name}_total ${help}`,
        `# TYPE ${name}_total counter`,
        `${name}_total${labelStr} ${value}`,
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

/**
 * Handle GET /metrics/prometheus
 *
 * Returns metrics in Prometheus text exposition format (version 0.0.4).
 * Suitable for scraping by Grafana Agent, Prometheus, or any compatible tool.
 *
 * Protected by admin key — callers must supply `X-Admin-Key` header.
 */
export async function handlePrometheusMetrics(request: Request, env: Env): Promise<Response> {
    const auth = await verifyAdminAuth(request, env);
    if (!auth.authorized) {
        // ZTA: emit security event for auth failures on this endpoint
        new AnalyticsService(env.ANALYTICS_ENGINE).trackSecurityEvent({
            eventType: 'auth_failure',
            path: '/metrics/prometheus',
            method: request.method,
            reason: auth.error ?? 'Unauthorized',
        });
        return new Response(auth.error ?? 'Unauthorized', { status: 401 });
    }

    const metrics = await fetchMetricsSummary(env);

    const lines = [
        counter(
            'adblock_compilation_requests',
            'Total number of compilation requests in the last 24 hours.',
            metrics.totalRequests,
        ),
        counter(
            'adblock_compilation_errors',
            'Total number of compilation errors in the last 24 hours.',
            metrics.errorRequests,
        ),
        gauge(
            'adblock_compilation_error_rate',
            'Compilation error rate (0–1) over the last 24 hours.',
            metrics.errorRate,
        ),
        gauge(
            'adblock_compilation_latency_avg_ms',
            'Average successful compilation latency in milliseconds over the last 24 hours.',
            metrics.avgLatencyMs,
        ),
        gauge(
            'adblock_compilation_latency_p95_ms',
            'P95 compilation latency in milliseconds over the last 24 hours.',
            metrics.p95LatencyMs,
        ),
        gauge(
            'adblock_cache_hit_rate',
            'Cache hit rate (0–1) over the last 24 hours.',
            metrics.cacheHitRate,
        ),
        counter(
            'adblock_cache_hits',
            'Total cache hits in the last 24 hours.',
            metrics.cacheHits,
        ),
        counter(
            'adblock_cache_misses',
            'Total cache misses in the last 24 hours.',
            metrics.cacheMisses,
        ),
        counter(
            'adblock_rate_limit_events',
            'Total rate limit exceeded events in the last 24 hours.',
            metrics.rateLimitEvents,
        ),
        counter(
            'adblock_source_fetch_errors',
            'Total source fetch errors in the last 24 hours.',
            metrics.sourceErrors,
        ),
        // Indicate degraded mode to operators when secrets are not configured
        ...(metrics.secretsMissing ? ['# note: ANALYTICS_ACCOUNT_ID or ANALYTICS_API_TOKEN not configured — all values are zero'] : []),
        // Trailing newline required by Prometheus spec
        '',
    ];

    return new Response(lines.join('\n'), {
        headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
