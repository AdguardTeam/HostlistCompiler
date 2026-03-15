/**
 * Prometheus metric registry.
 *
 * Provides a module-level registry that any Worker handler or service can push
 * custom metric definitions into.  The `GET /metrics/prometheus` handler
 * iterates the registry at scrape time, so new metrics are automatically
 * exposed without modifying `prometheus-metrics.ts`.
 *
 * ## Adding a custom metric
 *
 * ```typescript
 * // In any worker module that loads before the first scrape:
 * import { registerPrometheusMetric } from './prometheus-metric-registry.ts';
 *
 * registerPrometheusMetric({
 *     name: 'adblock_workflow_active',
 *     type: 'gauge',
 *     help: 'Number of active compilation workflows.',
 *     collect: async (env) => {
 *         // query env.COMPILATION_CACHE or D1 to count active workflows
 *         return 42;
 *     },
 * });
 * ```
 *
 * ## Built-in metrics
 *
 * The built-in metrics (compilation requests, cache hit rate, etc.) are
 * registered automatically when `prometheus-metrics.ts` is first imported.
 * They live in the `BUILTIN_METRICS` constant and are never duplicated even if
 * the module is imported multiple times.
 */

import type { Env } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single Prometheus metric definition.
 *
 * The `collect` function is called once per scrape for every registered metric.
 * It receives the Worker `Env` so it can read KV, D1, R2, or other bindings.
 * Return `null` to skip emitting the metric for this scrape cycle.
 */
export interface PrometheusMetricDefinition {
    /**
     * Base metric name.
     * - For counters, do **not** add the `_total` suffix — the registry adds it.
     * - For gauges, use the full name.
     *
     * @example 'adblock_compilation_requests'
     * @example 'adblock_cache_hit_rate'
     */
    name: string;

    /** Prometheus metric type. */
    type: 'counter' | 'gauge';

    /** One-line human-readable description emitted in `# HELP`. */
    help: string;

    /**
     * Called at scrape time to obtain the current value.
     * Return `null` to omit the metric from this scrape.
     */
    collect(env: Env): Promise<number | null> | number | null;

    /**
     * Optional static labels attached to every sample.
     * @example { region: 'us-east' }
     */
    labels?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Registry singleton
// ---------------------------------------------------------------------------

const _registry: PrometheusMetricDefinition[] = [];
const _registered = new Set<string>();

/**
 * Register a custom Prometheus metric.
 *
 * Calling `registerPrometheusMetric` with the same `name` twice is a no-op —
 * the first registration wins.  This prevents duplicate metrics when modules
 * are imported multiple times (e.g., in tests).
 */
export function registerPrometheusMetric(def: PrometheusMetricDefinition): void {
    if (_registered.has(def.name)) return;
    _registered.add(def.name);
    _registry.push(def);
}

/**
 * Return all registered metric definitions (read-only view).
 * Used by `handlePrometheusMetrics` to collect and format output.
 */
export function getRegisteredMetrics(): readonly PrometheusMetricDefinition[] {
    return _registry;
}

/**
 * Clear all registered metrics.
 * Intended for test isolation only — do not call in production code.
 */
export function _clearRegistryForTesting(): void {
    _registry.length = 0;
    _registered.clear();
}

// ---------------------------------------------------------------------------
// Text-format helpers (shared with prometheus-metrics.ts)
// ---------------------------------------------------------------------------

/** Render a Prometheus label set as `{k="v",...}` or empty string. */
export function renderLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return '';
    return '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}';
}

/**
 * Render a registered metric definition as Prometheus text exposition lines.
 * Returns an empty string if `value` is `null` (metric opted out for this scrape).
 */
export function renderMetric(def: PrometheusMetricDefinition, value: number | null): string {
    if (value === null) return '';
    const labelStr = renderLabels(def.labels);
    if (def.type === 'counter') {
        return [
            `# HELP ${def.name}_total ${def.help}`,
            `# TYPE ${def.name}_total counter`,
            `${def.name}_total${labelStr} ${value}`,
        ].join('\n');
    }
    // gauge
    return [
        `# HELP ${def.name} ${def.help}`,
        `# TYPE ${def.name} gauge`,
        `${def.name}${labelStr} ${value}`,
    ].join('\n');
}
