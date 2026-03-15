/**
 * OpenTelemetryDiagnosticsProvider — routes spans and metrics via OTLP.
 *
 * Bridges the IDiagnosticsProvider interface to the existing
 * createOpenTelemetryExporter() / OpenTelemetry JS SDK already present in
 * src/diagnostics/.
 *
 * TODO: Set OTEL_EXPORTER_OTLP_ENDPOINT in your Worker secrets to point at
 * your collector (Grafana Cloud, Honeycomb, Dash0, etc.):
 *   wrangler secret put OTEL_EXPORTER_OTLP_ENDPOINT
 *
 * TODO: Wire this provider into worker/worker.ts alongside the Sentry wrap:
 *   const provider = new OpenTelemetryDiagnosticsProvider({ serviceName: 'adblock-compiler' });
 */

import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span as OtelSpan, Tracer } from '@opentelemetry/api';
import type { IDiagnosticsProvider, ISpan } from './IDiagnosticsProvider.ts';

export interface OpenTelemetryDiagnosticsProviderOptions {
    /** Service name reported in traces. Default: 'adblock-compiler' */
    serviceName?: string;
    /** Service version. Recommend passing env.COMPILER_VERSION. */
    serviceVersion?: string;
    /**
     * Optional pre-configured tracer. If not provided, uses the global
     * OTel tracer obtained via trace.getTracer().
     */
    tracer?: Tracer;
}

/**
 * Wraps an OpenTelemetry Span as an ISpan.
 */
class OtelSpanAdapter implements ISpan {
    constructor(private readonly span: OtelSpan) {}

    end(): void {
        this.span.end();
    }

    setAttribute(key: string, value: string | number | boolean): void {
        this.span.setAttribute(key, value);
    }

    recordException(error: Error): void {
        this.span.recordException(error);
        this.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
}

export class OpenTelemetryDiagnosticsProvider implements IDiagnosticsProvider {
    private readonly tracer: Tracer;

    constructor(options: OpenTelemetryDiagnosticsProviderOptions = {}) {
        this.tracer = options.tracer ??
            trace.getTracer(
                options.serviceName ?? 'adblock-compiler',
                options.serviceVersion ?? '0.0.0',
            );
    }

    captureError(error: Error, context?: Record<string, unknown>): void {
        // Create a one-shot error span
        const span = this.tracer.startSpan('captureError');
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        if (context) {
            for (const [key, value] of Object.entries(context)) {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    span.setAttribute(`error.context.${key}`, value);
                }
            }
        }
        span.end();
    }

    startSpan(name: string, attributes?: Record<string, string | number>): ISpan {
        const span = this.tracer.startSpan(name);
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                span.setAttribute(key, value);
            }
        }
        return new OtelSpanAdapter(span);
    }

    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
        // TODO(#sentry-metrics): Use OpenTelemetry Metrics API (MeterProvider) once a meter is
        // configured. For now, emit a span event as a lightweight substitute so
        // trace backends (Grafana, Honeycomb) can at least see the value.
        const span = this.tracer.startSpan(`metric.${name}`);
        span.setAttribute('metric.value', value);
        if (tags) {
            for (const [k, v] of Object.entries(tags)) {
                span.setAttribute(`metric.tag.${k}`, v);
            }
        }
        span.end();
    }
}
