/**
 * Metrics handling for the Cloudflare Worker.
 * Provides functions for recording and retrieving metrics.
 */

import { WORKER_DEFAULTS } from '../../src/config/defaults.ts';
import { JsonResponse } from '../utils/index.ts';
import type {
    AggregatedMetrics,
    EndpointMetrics,
    EndpointMetricsDisplay,
    Env,
} from '../types.ts';

// ============================================================================
// Configuration
// ============================================================================

const METRICS_WINDOW = WORKER_DEFAULTS.METRICS_WINDOW_SECONDS;
const METRICS_ENDPOINTS = ['/compile', '/compile/stream', '/compile/batch'];

// ============================================================================
// Metrics Recording
// ============================================================================

/**
 * Record request metrics for an endpoint.
 *
 * @param env - Environment bindings
 * @param endpoint - The endpoint path
 * @param duration - Request duration in milliseconds
 * @param success - Whether the request succeeded
 * @param error - Optional error message
 */
export async function recordMetric(
    env: Env,
    endpoint: string,
    duration: number,
    success: boolean,
    error?: string,
): Promise<void> {
    try {
        const now = Date.now();
        const windowKey = Math.floor(now / (METRICS_WINDOW * 1000));
        const metricKey = `metrics:${windowKey}:${endpoint}`;

        // Get existing metrics
        const existing = await env.METRICS.get(metricKey, 'json') as EndpointMetrics | null;

        const metrics: EndpointMetrics = existing || {
            count: 0,
            success: 0,
            failed: 0,
            totalDuration: 0,
            errors: {},
        };

        // Update metrics
        metrics.count++;
        metrics.totalDuration += duration;

        if (success) {
            metrics.success++;
        } else {
            metrics.failed++;
            if (error) {
                metrics.errors[error] = (metrics.errors[error] || 0) + 1;
            }
        }

        // Store updated metrics
        await env.METRICS.put(
            metricKey,
            JSON.stringify(metrics),
            { expirationTtl: METRICS_WINDOW * 2 },
        );
    } catch (error) {
        // Don't fail requests if metrics fail
        // deno-lint-ignore no-console
        console.error('Failed to record metrics:', error);
    }
}

// ============================================================================
// Metrics Retrieval
// ============================================================================

/**
 * Get aggregated metrics for all endpoints.
 *
 * @param env - Environment bindings
 * @returns Aggregated metrics object
 */
export async function getMetrics(env: Env): Promise<AggregatedMetrics> {
    const now = Date.now();
    const currentWindow = Math.floor(now / (METRICS_WINDOW * 1000));

    const stats: Record<string, EndpointMetricsDisplay> = {};

    // Get metrics from last 6 windows (30 minutes)
    for (let i = 0; i < 6; i++) {
        const windowKey = currentWindow - i;

        for (const endpoint of METRICS_ENDPOINTS) {
            const metricKey = `metrics:${windowKey}:${endpoint}`;
            const data = await env.METRICS.get(metricKey, 'json') as EndpointMetrics | null;

            if (data) {
                if (!stats[endpoint]) {
                    stats[endpoint] = {
                        count: 0,
                        success: 0,
                        failed: 0,
                        avgDuration: 0,
                        errors: {},
                    };
                }

                const endpointStats = stats[endpoint];
                const prevCount = endpointStats.count;

                endpointStats.count += data.count;
                endpointStats.success += data.success;
                endpointStats.failed += data.failed;

                // Calculate running average
                if (data.count > 0) {
                    const dataAvgDuration = data.totalDuration / data.count;
                    endpointStats.avgDuration = prevCount > 0
                        ? (endpointStats.avgDuration * prevCount + dataAvgDuration * data.count) /
                            endpointStats.count
                        : dataAvgDuration;
                }

                // Merge errors
                for (const [err, count] of Object.entries(data.errors)) {
                    endpointStats.errors[err] = (endpointStats.errors[err] || 0) + (count as number);
                }
            }
        }
    }

    return {
        window: '30 minutes',
        timestamp: new Date().toISOString(),
        endpoints: stats,
    };
}

// ============================================================================
// HTTP Handlers
// ============================================================================

/**
 * Handle GET /metrics request.
 */
export async function handleMetrics(env: Env): Promise<Response> {
    const metrics = await getMetrics(env);
    return JsonResponse.noCache(metrics);
}
