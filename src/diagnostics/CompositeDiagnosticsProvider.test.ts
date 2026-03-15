/**
 * Tests for CompositeDiagnosticsProvider.
 */

import { assertEquals, assertStrictEquals } from '@std/assert';
import { CompositeDiagnosticsProvider } from './CompositeDiagnosticsProvider.ts';
import type { IDiagnosticsProvider, ISpan } from './IDiagnosticsProvider.ts';
import { NoOpDiagnosticsProvider } from './IDiagnosticsProvider.ts';

// ---------------------------------------------------------------------------
// Test spy provider
// ---------------------------------------------------------------------------

interface SpyCalls {
    errors: Array<{ error: Error; context?: Record<string, unknown> }>;
    spans: Array<{ name: string; attributes?: Record<string, string | number> }>;
    metrics: Array<{ name: string; value: number; tags?: Record<string, string> }>;
    spansEnded: number;
    attributesSet: Array<{ key: string; value: string | number | boolean }>;
    exceptionsRecorded: Error[];
}

function makeSpyProvider(): IDiagnosticsProvider & { calls: SpyCalls } {
    const calls: SpyCalls = {
        errors: [],
        spans: [],
        metrics: [],
        spansEnded: 0,
        attributesSet: [],
        exceptionsRecorded: [],
    };
    return {
        calls,
        captureError(error, context) {
            calls.errors.push({ error, context });
        },
        startSpan(name, attributes): ISpan {
            calls.spans.push({ name, attributes });
            return {
                end: () => {
                    calls.spansEnded++;
                },
                setAttribute: (key, value) => {
                    calls.attributesSet.push({ key, value });
                },
                recordException: (err) => {
                    calls.exceptionsRecorded.push(err);
                },
            };
        },
        recordMetric(name, value, tags) {
            calls.metrics.push({ name, value, tags });
        },
    };
}

// ---------------------------------------------------------------------------
// captureError
// ---------------------------------------------------------------------------

Deno.test('CompositeDiagnosticsProvider — captureError forwards to all providers', () => {
    const a = makeSpyProvider();
    const b = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([a, b]);

    const err = new Error('boom');
    composite.captureError(err, { key: 'value' });

    assertEquals(a.calls.errors.length, 1);
    assertStrictEquals(a.calls.errors[0].error, err);
    assertEquals(a.calls.errors[0].context, { key: 'value' });

    assertEquals(b.calls.errors.length, 1);
    assertStrictEquals(b.calls.errors[0].error, err);
});

Deno.test('CompositeDiagnosticsProvider — captureError swallows child exceptions', () => {
    const throwing: IDiagnosticsProvider = {
        captureError: () => {
            throw new Error('provider exploded');
        },
        startSpan: () => ({ end: () => {}, setAttribute: () => {}, recordException: () => {} }),
        recordMetric: () => {},
    };
    const spy = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([throwing, spy]);

    // Should not throw, and the healthy provider still receives the call
    composite.captureError(new Error('original'));
    assertEquals(spy.calls.errors.length, 1);
});

// ---------------------------------------------------------------------------
// startSpan
// ---------------------------------------------------------------------------

Deno.test('CompositeDiagnosticsProvider — startSpan forwards to all providers', () => {
    const a = makeSpyProvider();
    const b = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([a, b]);

    const span = composite.startSpan('compile', { ruleCount: 5000 });
    assertEquals(a.calls.spans.length, 1);
    assertEquals(a.calls.spans[0].name, 'compile');
    assertEquals(b.calls.spans.length, 1);

    span.end();
    assertEquals(a.calls.spansEnded, 1);
    assertEquals(b.calls.spansEnded, 1);
});

Deno.test('CompositeDiagnosticsProvider — span.setAttribute forwards to all child spans', () => {
    const a = makeSpyProvider();
    const b = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([a, b]);
    const span = composite.startSpan('test');

    span.setAttribute('foo', 'bar');
    assertEquals(a.calls.attributesSet.length, 1);
    assertEquals(a.calls.attributesSet[0], { key: 'foo', value: 'bar' });
    assertEquals(b.calls.attributesSet.length, 1);
});

Deno.test('CompositeDiagnosticsProvider — span.recordException forwards to all child spans', () => {
    const a = makeSpyProvider();
    const b = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([a, b]);
    const span = composite.startSpan('test');

    const err = new Error('inner');
    span.recordException(err);
    assertStrictEquals(a.calls.exceptionsRecorded[0], err);
    assertStrictEquals(b.calls.exceptionsRecorded[0], err);
});

// ---------------------------------------------------------------------------
// recordMetric
// ---------------------------------------------------------------------------

Deno.test('CompositeDiagnosticsProvider — recordMetric forwards to all providers', () => {
    const a = makeSpyProvider();
    const b = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([a, b]);

    composite.recordMetric('rule_count', 5000, { source: 'easylist' });
    assertEquals(a.calls.metrics[0], { name: 'rule_count', value: 5000, tags: { source: 'easylist' } });
    assertEquals(b.calls.metrics[0], { name: 'rule_count', value: 5000, tags: { source: 'easylist' } });
});

Deno.test('CompositeDiagnosticsProvider — recordMetric swallows child exceptions', () => {
    const throwing: IDiagnosticsProvider = {
        captureError: () => {},
        startSpan: () => ({ end: () => {}, setAttribute: () => {}, recordException: () => {} }),
        recordMetric: () => {
            throw new Error('metric exploded');
        },
    };
    const spy = makeSpyProvider();
    const composite = new CompositeDiagnosticsProvider([throwing, spy]);

    composite.recordMetric('count', 1);
    assertEquals(spy.calls.metrics.length, 1);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test('CompositeDiagnosticsProvider — zero providers is valid (no-op)', () => {
    const composite = new CompositeDiagnosticsProvider([]);
    assertEquals(composite.size, 0);
    // None of these should throw
    composite.captureError(new Error('e'));
    const span = composite.startSpan('s');
    span.end();
    span.setAttribute('k', 1);
    span.recordException(new Error('se'));
    composite.recordMetric('m', 1);
});

Deno.test('CompositeDiagnosticsProvider — size returns provider count', () => {
    const composite = new CompositeDiagnosticsProvider([
        new NoOpDiagnosticsProvider(),
        new NoOpDiagnosticsProvider(),
        new NoOpDiagnosticsProvider(),
    ]);
    assertEquals(composite.size, 3);
});

Deno.test('CompositeDiagnosticsProvider — nested composites work correctly', () => {
    const spy = makeSpyProvider();
    const inner = new CompositeDiagnosticsProvider([spy]);
    const outer = new CompositeDiagnosticsProvider([inner, new NoOpDiagnosticsProvider()]);

    outer.captureError(new Error('nested'));
    assertEquals(spy.calls.errors.length, 1);
});
