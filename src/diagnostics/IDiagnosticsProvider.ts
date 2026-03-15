/**
 * IDiagnosticsProvider — pluggable observability abstraction.
 *
 * Implementations: SentryDiagnosticsProvider, OpenTelemetryDiagnosticsProvider,
 * ConsoleDiagnosticsProvider, NoOpDiagnosticsProvider.
 *
 * This interface sits alongside the existing IDiagnosticsCollector. The Collector
 * is for in-process event aggregation; the Provider is for external export.
 */

// deno-lint-ignore-file no-console

export interface ISpan {
    /** Finish the span and export it. */
    end(): void;
    /** Attach a key/value attribute to the span. */
    setAttribute(key: string, value: string | number | boolean): void;
    /** Record an exception on the span without ending it. */
    recordException(error: Error): void;
}

export interface IDiagnosticsProvider {
    /**
     * Capture an error and send it to the configured backend (e.g., Sentry).
     * Must never throw.
     */
    captureError(error: Error, context?: Record<string, unknown>): void;

    /**
     * Start a named span for distributed tracing.
     * @param name - Span name, e.g. 'transform.deduplicate'
     * @param attributes - Optional initial attributes
     * @returns An ISpan that must be ended by the caller.
     */
    startSpan(name: string, attributes?: Record<string, string | number>): ISpan;

    /**
     * Record a scalar metric (counter, gauge, histogram value).
     * @param name - Metric name, e.g. 'compilation.ruleCount'
     * @param value - Numeric value
     * @param tags - Optional tag dimensions
     */
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}

// ---------------------------------------------------------------------------
// No-op implementation (default / testing)
// ---------------------------------------------------------------------------

const NOOP_SPAN: ISpan = {
    end: () => {},
    setAttribute: () => {},
    recordException: () => {},
};

/**
 * No-op provider — safe default that never throws and never exports data.
 * Use in local development or tests.
 */
export class NoOpDiagnosticsProvider implements IDiagnosticsProvider {
    captureError(_error: Error, _context?: Record<string, unknown>): void {}
    startSpan(_name: string, _attributes?: Record<string, string | number>): ISpan {
        return NOOP_SPAN;
    }
    recordMetric(_name: string, _value: number, _tags?: Record<string, string>): void {}
}

// ---------------------------------------------------------------------------
// Console implementation (development / debugging)
// ---------------------------------------------------------------------------

/**
 * Console provider — logs all observability calls to stdout as structured JSON.
 * Useful for local development without a real backend.
 */
export class ConsoleDiagnosticsProvider implements IDiagnosticsProvider {
    captureError(error: Error, context?: Record<string, unknown>): void {
        console.error(JSON.stringify({
            level: 'error',
            message: error.message,
            stack: error.stack,
            context,
        }));
    }

    startSpan(name: string, attributes?: Record<string, string | number>): ISpan {
        const start = Date.now();
        console.log(JSON.stringify({ event: 'span.start', name, attributes }));
        return {
            end: () => console.log(JSON.stringify({ event: 'span.end', name, durationMs: Date.now() - start })),
            setAttribute: (key, value) => console.log(JSON.stringify({ event: 'span.setAttribute', name, key, value })),
            recordException: (err) => console.error(JSON.stringify({ event: 'span.recordException', name, message: err.message })),
        };
    }

    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
        console.log(JSON.stringify({ event: 'metric', name, value, tags }));
    }
}
