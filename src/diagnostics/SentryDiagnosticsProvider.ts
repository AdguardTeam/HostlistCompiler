/**
 * SentryDiagnosticsProvider — routes errors and performance spans to Sentry.
 *
 * Requires @sentry/cloudflare to be installed:
 *   npm install @sentry/cloudflare
 *
 * TODO: Add SENTRY_DSN to your Cloudflare Worker environment secrets:
 *   wrangler secret put SENTRY_DSN
 *
 * Initialise once at the worker entry point (worker/worker.ts) using
 * Sentry.withSentry() wrapping the export default handler.
 */

import type { IDiagnosticsProvider, ISpan } from './IDiagnosticsProvider.ts';

// Dynamic import so the module graph doesn't break in environments where
// @sentry/cloudflare is not available (e.g., Deno unit tests).
// deno-lint-ignore no-explicit-any
let SentryModule: any = null;

async function getSentry(): Promise<typeof import('@sentry/cloudflare')> {
    if (!SentryModule) {
        SentryModule = await import('@sentry/cloudflare');
    }
    return SentryModule;
}

/**
 * Options for the Sentry diagnostics provider.
 */
export interface SentryDiagnosticsProviderOptions {
    /** Sentry DSN. Read from env.SENTRY_DSN at the call site. */
    dsn: string;
    /**
     * Fraction of transactions to sample for performance monitoring (0.0–1.0).
     * Default: 0.1 (10 %)
     */
    tracesSampleRate?: number;
    /** Service release / version tag. Recommend passing env.COMPILER_VERSION. */
    release?: string;
    /** Sentry environment tag. Default: 'production' */
    environment?: string;
}

export class SentryDiagnosticsProvider implements IDiagnosticsProvider {
    private readonly options: Required<SentryDiagnosticsProviderOptions>;
    private initialised = false;

    constructor(options: SentryDiagnosticsProviderOptions) {
        this.options = {
            tracesSampleRate: 0.1,
            release: 'unknown',
            environment: 'production',
            ...options,
        };
    }

    private async ensureInit(): Promise<void> {
        if (this.initialised) return;
        const Sentry = await getSentry();
        Sentry.init({
            dsn: this.options.dsn,
            tracesSampleRate: this.options.tracesSampleRate,
            release: this.options.release,
            environment: this.options.environment,
        });
        this.initialised = true;
    }

    captureError(error: Error, context?: Record<string, unknown>): void {
        this.ensureInit().then(async () => {
            const Sentry = await getSentry();
            Sentry.withScope((scope: { setExtras: (extras: Record<string, unknown>) => void }) => {
                if (context) scope.setExtras(context);
                Sentry.captureException(error);
            });
        }).catch(() => {
            // Never propagate errors from the diagnostics layer
        });
    }

    startSpan(name: string, _attributes?: Record<string, string | number>): ISpan {
        // TODO(#sentry-cf): Replace with Sentry.startSpan() once @sentry/cloudflare is installed
        // and the worker handler is wrapped with Sentry.withSentry().
        // For now this returns a lightweight span that records the exception to Sentry
        // on recordException().
        const recordException = (error: Error) => {
            this.captureError(error, { spanName: name });
        };
        return {
            end: () => {},
            setAttribute: () => {},
            recordException,
        };
    }

    recordMetric(_name: string, _value: number, _tags?: Record<string, string>): void {
        // TODO(#sentry-metrics): Sentry Metrics (currently in beta for CF Workers).
        // For numeric metrics, prefer routing through AnalyticsService.writeDataPoint()
        // or the Prometheus /metrics endpoint (Phase 2).
    }
}
