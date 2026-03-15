/**
 * Diagnostics provider factory for Cloudflare Workers.
 *
 * Reads the Worker `Env` at request time and returns a fully-configured
 * `IDiagnosticsProvider` (or composite of providers) with zero boilerplate at
 * call sites.
 *
 * ## Provider selection logic
 *
 * | Env variable set             | Provider(s) activated                              |
 * |------------------------------|----------------------------------------------------|
 * | Neither `SENTRY_DSN` nor `OTEL_EXPORTER_OTLP_ENDPOINT` | `ConsoleDiagnosticsProvider` |
 * | `SENTRY_DSN` only            | `SentryDiagnosticsProvider`                        |
 * | `OTEL_EXPORTER_OTLP_ENDPOINT` only | `OpenTelemetryDiagnosticsProvider`           |
 * | Both                         | `CompositeDiagnosticsProvider([Sentry, OTel])`     |
 *
 * ## Usage
 *
 * ```typescript
 * import { createDiagnosticsProvider } from './services/diagnostics-factory.ts';
 *
 * export default {
 *     async fetch(request, env, ctx) {
 *         const diagnostics = createDiagnosticsProvider(env);
 *         const span = diagnostics.startSpan('compile');
 *         try {
 *             // ... business logic ...
 *             span.end();
 *         } catch (err) {
 *             span.recordException(err as Error);
 *             diagnostics.captureError(err as Error, { url: request.url });
 *             throw err;
 *         }
 *     },
 * };
 * ```
 *
 * ## Extending with a custom provider
 *
 * Pass optional `extras` to fan-out to additional backends:
 *
 * ```typescript
 * import { createDiagnosticsProvider } from './services/diagnostics-factory.ts';
 * import { MyCustomProvider } from './my-custom-provider.ts';
 *
 * const diagnostics = createDiagnosticsProvider(env, [new MyCustomProvider()]);
 * ```
 */

import { CompositeDiagnosticsProvider } from '../../src/diagnostics/CompositeDiagnosticsProvider.ts';
import { ConsoleDiagnosticsProvider, NoOpDiagnosticsProvider } from '../../src/diagnostics/IDiagnosticsProvider.ts';
import type { IDiagnosticsProvider } from '../../src/diagnostics/IDiagnosticsProvider.ts';
import { OpenTelemetryDiagnosticsProvider } from '../../src/diagnostics/OpenTelemetryDiagnosticsProvider.ts';
import { SentryDiagnosticsProvider } from '../../src/diagnostics/SentryDiagnosticsProvider.ts';
import type { Env } from '../types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the correct `IDiagnosticsProvider` for the current environment.
 *
 * The function is **pure** (no side-effects, same output for same input) so it
 * is safe to call once per request or once at module load time.
 *
 * @param env - Cloudflare Worker `Env` bindings.
 * @param extras - Additional providers to always include (e.g., a custom
 *   logger or a test spy). They are appended to the provider list before a
 *   composite is built.
 * @returns A single `IDiagnosticsProvider` instance (may be a
 *   `CompositeDiagnosticsProvider` if multiple backends are configured).
 */
export function createDiagnosticsProvider(
    env: Env,
    extras: IDiagnosticsProvider[] = [],
): IDiagnosticsProvider {
    const providers: IDiagnosticsProvider[] = [];

    // Sentry — activated by SENTRY_DSN Worker secret
    if (env.SENTRY_DSN) {
        providers.push(
            new SentryDiagnosticsProvider({
                dsn: env.SENTRY_DSN,
                release: env.COMPILER_VERSION,
                environment: 'production',
            }),
        );
    }

    // OpenTelemetry — activated by OTEL_EXPORTER_OTLP_ENDPOINT Worker secret
    if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        providers.push(
            new OpenTelemetryDiagnosticsProvider({
                serviceName: 'adblock-compiler',
                serviceVersion: env.COMPILER_VERSION,
            }),
        );
    }

    // Any caller-supplied extras (e.g. test spies, custom sinks)
    providers.push(...extras);

    if (providers.length === 0) {
        // No backends configured — fall back to structured console output
        // so traces are still visible in wrangler tail / Workers Logs.
        return new ConsoleDiagnosticsProvider();
    }

    if (providers.length === 1) {
        return providers[0];
    }

    return new CompositeDiagnosticsProvider(providers);
}

/**
 * Create a no-op provider.  Convenience wrapper for test environments that
 * need an `IDiagnosticsProvider` but want absolutely no output.
 */
export function createNoOpDiagnosticsProvider(): IDiagnosticsProvider {
    return new NoOpDiagnosticsProvider();
}
