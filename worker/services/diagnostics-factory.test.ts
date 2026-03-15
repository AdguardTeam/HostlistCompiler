/**
 * Tests for the diagnostics provider factory.
 */

import { assertEquals, assertInstanceOf } from '@std/assert';
import { CompositeDiagnosticsProvider } from '../../src/diagnostics/CompositeDiagnosticsProvider.ts';
import { ConsoleDiagnosticsProvider, NoOpDiagnosticsProvider } from '../../src/diagnostics/IDiagnosticsProvider.ts';
import type { IDiagnosticsProvider } from '../../src/diagnostics/IDiagnosticsProvider.ts';
import { SentryDiagnosticsProvider } from '../../src/diagnostics/SentryDiagnosticsProvider.ts';
import type { Env } from '../types.ts';
import { createDiagnosticsProvider, createNoOpDiagnosticsProvider } from './diagnostics-factory.ts';

// ---------------------------------------------------------------------------
// Minimal Env stub
// ---------------------------------------------------------------------------

function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
        COMPILER_VERSION: '1.0.0-test',
        ADMIN_KEY: 'test-key',
        ...overrides,
    } as unknown as Env;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('createDiagnosticsProvider — no backends → ConsoleDiagnosticsProvider', () => {
    const provider = createDiagnosticsProvider(makeEnv());
    assertInstanceOf(provider, ConsoleDiagnosticsProvider);
});

Deno.test('createDiagnosticsProvider — SENTRY_DSN only → SentryDiagnosticsProvider', () => {
    const provider = createDiagnosticsProvider(
        makeEnv({ SENTRY_DSN: 'https://key@sentry.io/123' }),
    );
    assertInstanceOf(provider, SentryDiagnosticsProvider);
});

Deno.test('createDiagnosticsProvider — OTEL endpoint only → OpenTelemetryDiagnosticsProvider', () => {
    const provider = createDiagnosticsProvider(
        makeEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.example.com' }),
    );
    // Not instanceof Composite — single provider returned directly
    assertEquals(provider instanceof CompositeDiagnosticsProvider, false);
});

Deno.test('createDiagnosticsProvider — both Sentry + OTEL → CompositeDiagnosticsProvider', () => {
    const provider = createDiagnosticsProvider(
        makeEnv({
            SENTRY_DSN: 'https://key@sentry.io/123',
            OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.example.com',
        }),
    );
    assertInstanceOf(provider, CompositeDiagnosticsProvider);
    assertEquals((provider as CompositeDiagnosticsProvider).size, 2);
});

Deno.test('createDiagnosticsProvider — extras are appended to provider list', () => {
    const extra: IDiagnosticsProvider = new NoOpDiagnosticsProvider();
    const provider = createDiagnosticsProvider(
        makeEnv({ SENTRY_DSN: 'https://key@sentry.io/123' }),
        [extra],
    );
    // Sentry + extra = 2 → composite
    assertInstanceOf(provider, CompositeDiagnosticsProvider);
    assertEquals((provider as CompositeDiagnosticsProvider).size, 2);
});

Deno.test('createDiagnosticsProvider — extras only (no env backends) → composite', () => {
    const extra: IDiagnosticsProvider = new NoOpDiagnosticsProvider();
    const provider = createDiagnosticsProvider(makeEnv(), [extra]);
    // Only one provider, returned directly (no composite wrapping needed)
    assertEquals(provider instanceof CompositeDiagnosticsProvider, false);
    assertInstanceOf(provider, NoOpDiagnosticsProvider);
});

Deno.test('createDiagnosticsProvider — provider is callable (smoke test)', () => {
    const provider = createDiagnosticsProvider(makeEnv());
    // None of these should throw
    provider.captureError(new Error('test'));
    const span = provider.startSpan('test-span');
    span.setAttribute('k', 'v');
    span.recordException(new Error('inner'));
    span.end();
    provider.recordMetric('count', 42);
});

Deno.test('createNoOpDiagnosticsProvider — returns NoOpDiagnosticsProvider', () => {
    const provider = createNoOpDiagnosticsProvider();
    assertInstanceOf(provider, NoOpDiagnosticsProvider);
});
