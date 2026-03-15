/**
 * Tests for the Prometheus metrics handler and metric registry.
 *
 * Covers:
 *  - 401 on missing/wrong admin key
 *  - Content-Type header
 *  - Fallback zeroed metrics when secrets are absent
 *  - # note: comment present when secrets are missing
 *  - Custom metric registration via registerPrometheusMetric
 *  - renderMetric() output format (counter and gauge)
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import type { Env } from '../types.ts';
import { _clearRegistryForTesting, handlePrometheusMetrics, registerPrometheusMetric } from './prometheus-metrics.ts';
import { renderMetric } from './prometheus-metric-registry.ts';

// ---------------------------------------------------------------------------
// Minimal env stub
// ---------------------------------------------------------------------------

function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
        ADMIN_KEY: 'secret-admin-key',
        COMPILER_VERSION: '1.0.0-test',
        ...overrides,
    } as unknown as Env;
}

function makeRequest(
    overrides: { headers?: Record<string, string>; method?: string } = {},
): Request {
    return new Request('https://worker.example.com/metrics/prometheus', {
        method: overrides.method ?? 'GET',
        headers: overrides.headers ?? { 'X-Admin-Key': 'secret-admin-key' },
    });
}

// ---------------------------------------------------------------------------
// renderMetric helpers
// ---------------------------------------------------------------------------

Deno.test('renderMetric — counter emits _total in HELP, TYPE, and sample', () => {
    const out = renderMetric(
        { name: 'my_counter', type: 'counter', help: 'A counter.', collect: () => 0 },
        42,
    );
    assertStringIncludes(out, '# HELP my_counter_total A counter.');
    assertStringIncludes(out, '# TYPE my_counter_total counter');
    assertStringIncludes(out, 'my_counter_total 42');
});

Deno.test('renderMetric — gauge emits name without _total', () => {
    const out = renderMetric(
        { name: 'my_gauge', type: 'gauge', help: 'A gauge.', collect: () => 0 },
        3.14,
    );
    assertStringIncludes(out, '# HELP my_gauge A gauge.');
    assertStringIncludes(out, '# TYPE my_gauge gauge');
    assertStringIncludes(out, 'my_gauge 3.14');
});

Deno.test('renderMetric — null value returns empty string (metric opted out)', () => {
    const out = renderMetric(
        { name: 'my_gauge', type: 'gauge', help: 'A gauge.', collect: () => null },
        null,
    );
    assertEquals(out, '');
});

Deno.test('renderMetric — labels are rendered correctly', () => {
    const out = renderMetric(
        {
            name: 'my_gauge',
            type: 'gauge',
            help: 'Labelled gauge.',
            collect: () => 1,
            labels: { env: 'prod', region: 'us-east' },
        },
        1,
    );
    assertStringIncludes(out, 'my_gauge{env="prod",region="us-east"} 1');
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

Deno.test('handlePrometheusMetrics — missing admin key returns 401', async () => {
    const req = new Request('https://worker.example.com/metrics/prometheus', {
        method: 'GET',
        // No X-Admin-Key header
    });
    const res = await handlePrometheusMetrics(req, makeEnv());
    assertEquals(res.status, 401);
});

Deno.test('handlePrometheusMetrics — wrong admin key returns 401', async () => {
    const req = makeRequest({ headers: { 'X-Admin-Key': 'wrong-key' } });
    const res = await handlePrometheusMetrics(req, makeEnv());
    assertEquals(res.status, 401);
});

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

Deno.test('handlePrometheusMetrics — correct Content-Type on 200', async () => {
    const req = makeRequest();
    const res = await handlePrometheusMetrics(req, makeEnv());
    assertEquals(res.status, 200);
    assertStringIncludes(res.headers.get('Content-Type') ?? '', 'text/plain');
    assertStringIncludes(res.headers.get('Content-Type') ?? '', '0.0.4');
    assertEquals(res.headers.get('Cache-Control'), 'no-store');
});

// ---------------------------------------------------------------------------
// Missing secrets → fallback zeroed output
// ---------------------------------------------------------------------------

Deno.test('handlePrometheusMetrics — missing secrets emits # note comment', async () => {
    const req = makeRequest();
    const res = await handlePrometheusMetrics(req, makeEnv()); // no ANALYTICS_* keys
    const body = await res.text();
    assertStringIncludes(body, '# note: ANALYTICS_ACCOUNT_ID or ANALYTICS_API_TOKEN not configured');
});

// ---------------------------------------------------------------------------
// Custom metric registration
// ---------------------------------------------------------------------------

Deno.test('registerPrometheusMetric — custom metric appears in output', async () => {
    _clearRegistryForTesting();

    registerPrometheusMetric({
        name: 'test_custom_gauge',
        type: 'gauge',
        help: 'A custom test gauge.',
        collect: () => 99,
    });

    const req = makeRequest();
    const res = await handlePrometheusMetrics(req, makeEnv());
    const body = await res.text();

    assertStringIncludes(body, '# HELP test_custom_gauge A custom test gauge.');
    assertStringIncludes(body, 'test_custom_gauge 99');
});

Deno.test('registerPrometheusMetric — duplicate name is a no-op (first wins)', async () => {
    _clearRegistryForTesting();

    registerPrometheusMetric({ name: 'dup_metric', type: 'gauge', help: 'First.', collect: () => 1 });
    registerPrometheusMetric({ name: 'dup_metric', type: 'gauge', help: 'Second.', collect: () => 2 });

    const req = makeRequest();
    const res = await handlePrometheusMetrics(req, makeEnv());
    const body = await res.text();

    // Only one occurrence
    const matches = body.match(/dup_metric/g) ?? [];
    assertEquals(matches.length, 3); // HELP + TYPE + sample — exactly one set
});

Deno.test('registerPrometheusMetric — collect returning null omits metric', async () => {
    _clearRegistryForTesting();

    registerPrometheusMetric({ name: 'null_metric', type: 'gauge', help: 'Null.', collect: () => null });

    const req = makeRequest();
    const res = await handlePrometheusMetrics(req, makeEnv());
    const body = await res.text();

    assertEquals(body.includes('null_metric'), false);
});
