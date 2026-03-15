/**
 * CompositeDiagnosticsProvider — fan-out to multiple backends simultaneously.
 *
 * Allows combining any number of IDiagnosticsProvider implementations so that,
 * for example, Sentry (error tracking) and OpenTelemetry (traces) both receive
 * every event without duplication of call sites.
 *
 * @example
 * ```typescript
 * import { CompositeDiagnosticsProvider, SentryDiagnosticsProvider, OpenTelemetryDiagnosticsProvider } from '../diagnostics/index.ts';
 *
 * const composite = new CompositeDiagnosticsProvider([
 *     new SentryDiagnosticsProvider({ dsn: env.SENTRY_DSN }),
 *     new OpenTelemetryDiagnosticsProvider({ serviceName: 'adblock-compiler' }),
 * ]);
 *
 * // All three calls are forwarded to every child provider
 * composite.captureError(new Error('oops'));
 * const span = composite.startSpan('compile');
 * composite.recordMetric('rule_count', 5000);
 * ```
 */

import type { IDiagnosticsProvider, ISpan } from './IDiagnosticsProvider.ts';

// ---------------------------------------------------------------------------
// CompositeSpan — delegates ISpan calls to all child spans
// ---------------------------------------------------------------------------

class CompositeSpan implements ISpan {
    constructor(private readonly spans: ISpan[]) {}

    end(): void {
        for (const span of this.spans) {
            span.end();
        }
    }

    setAttribute(key: string, value: string | number | boolean): void {
        for (const span of this.spans) {
            span.setAttribute(key, value);
        }
    }

    recordException(error: Error): void {
        for (const span of this.spans) {
            span.recordException(error);
        }
    }
}

// ---------------------------------------------------------------------------
// CompositeDiagnosticsProvider
// ---------------------------------------------------------------------------

/**
 * Fans out every `captureError`, `startSpan`, and `recordMetric` call to all
 * registered child providers.
 *
 * - Errors thrown by any child provider are swallowed so they cannot
 *   interfere with each other or with application logic.
 * - A `CompositeDiagnosticsProvider` can itself be nested inside another
 *   `CompositeDiagnosticsProvider` for hierarchical routing.
 * - Providers that report to the same backend (e.g., two Sentry instances)
 *   will both receive the event — avoid duplicates by selecting backends
 *   carefully.
 */
export class CompositeDiagnosticsProvider implements IDiagnosticsProvider {
    private readonly providers: ReadonlyArray<IDiagnosticsProvider>;

    /**
     * @param providers - One or more providers to fan out to.
     *   Passing zero providers is valid and equivalent to `NoOpDiagnosticsProvider`.
     */
    constructor(providers: IDiagnosticsProvider[]) {
        this.providers = providers;
    }

    captureError(error: Error, context?: Record<string, unknown>): void {
        for (const provider of this.providers) {
            try {
                provider.captureError(error, context);
            } catch {
                // Never let a child provider failure propagate
            }
        }
    }

    startSpan(name: string, attributes?: Record<string, string | number>): ISpan {
        const childSpans = this.providers.map((provider) => {
            try {
                return provider.startSpan(name, attributes);
            } catch {
                // If a provider fails to create a span, use a no-op span
                return { end: () => {}, setAttribute: () => {}, recordException: () => {} } as ISpan;
            }
        });
        return new CompositeSpan(childSpans);
    }

    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
        for (const provider of this.providers) {
            try {
                provider.recordMetric(name, value, tags);
            } catch {
                // Never let a child provider failure propagate
            }
        }
    }

    /** Returns the number of registered child providers. */
    get size(): number {
        return this.providers.length;
    }
}
