# Observability Roadmap: Sentry, OpenTelemetry & Grafana

> Originally created: 2026-03-10
> Last updated: 2026-03-15

This document captures the full observability strategy for the adblock-compiler Cloudflare Worker — combining the original Sentry/OTel ideas with a gap analysis of the current stack and a phased implementation roadmap.

---

## 🔭 Why Observability?

The compiler runs as a Cloudflare Worker with a pipeline of transformations, downloads, and diff operations. Without deep observability, errors in production are silent and performance regressions are invisible.

### What We Have Today

The current stack covers the three pillars to varying degrees:

| Layer | Implementation | Retention |
|---|---|---|
| **Structured Logs** | `AdminLogger` + `StructuredLogger` (JSON, correlationId, traceId, PII sanitization) | ~24 hrs (Workers Logs) |
| **Analytics Engine** | `AnalyticsService` + `admin-analytics-events.ts` (compilation, cache, source fetch, workflows, admin actions, auth failures) | 90 days |
| **Audit Log** | `admin_audit_logs` D1 table, full change history w/ old/new values | Indefinite |
| **Tail Worker** | `worker/tail.ts` — captures logs/exceptions, stores to KV | KV TTL |
| **Health Checks** | `/admin/system/health` endpoint + Angular admin UI | Real-time |
| **Metrics** | `worker/handlers/metrics.ts` — KV-based rolling window | Short-lived |
| **OpenTelemetry** | `createOpenTelemetryExporter` in `src/diagnostics/`, OTLP-capable | Deno layer only |

### Current Gaps

1. **Tracing is disconnected from the Worker runtime** — OTel exists in `src/` but is not wired into `worker/worker.ts`. Spans are never exported in production.
2. **No alerting** — metrics and Analytics Engine data exist, but nothing proactively notifies on error spikes or latency degradation. The tail worker's webhook stub is not wired up.
3. **KV-based metrics are not queryable** — rolling-window KV metrics (`FEATURE-017`) should be moved to Analytics Engine with a Prometheus-format `/metrics` endpoint.
4. **No source maps uploaded** — stack traces from Sentry/OTel will be minified without a source map upload step in CI/CD.
5. **`IDiagnosticsProvider` abstraction is planned but not implemented** — `SentryDiagnosticsProvider` and `OpenTelemetryDiagnosticsProvider` do not yet exist.
6. **No Real User Monitoring (RUM)** — the Angular admin frontend has no error tracking or session observability.
7. **No long-term log retention** — Worker Logs TTL is ~24 hours. Cloudflare Logpush to R2 is documented but not configured.

---

## 🏆 Provider Recommendation

### Sentry vs. Grafana

These are complementary, not competing tools. However, **Sentry should come first** for this project:

| | **Sentry** | **Grafana Cloud** |
|---|---|---|
| **Primary job** | Error tracking & exception intelligence | Metrics, logs, traces & dashboards |
| **Answers** | *"What broke, why, and whose session?"* | *"How is the system behaving over time?"* |
| **CF Workers SDK** | ✅ `@sentry/cloudflare` — first-class, native | ✅ OTLP push — works great but more setup |
| **Setup cost** | Very low (minutes) | Medium (OTLP endpoint + dashboards) |
| **Free tier** | 5K errors/month, 10K perf transactions | 50GB logs, 14-day traces, 10K metric series |

**Why Sentry first:** The biggest current blind spot is *silent errors* in the compiler pipeline. If `Deduplicate`, `Validate`, or a source download throws in production, it produces a generic Workers Logs entry with a 24-hour TTL. Sentry fills this hole immediately. `@sentry/cloudflare` wraps the entire worker handler with one change.

**Why add Grafana second:** Once Sentry is live, Grafana becomes the right next step for long-term trend dashboards over Analytics Engine data, correlating logs + traces (Loki + Tempo), and threshold alerting (e.g., error rate > 5% for 5 minutes).

### Full Provider Comparison

| Provider | Best For | CF Workers Support | Recommended Phase |
|---|---|---|---|
| **Sentry** | Error tracking, RUM, release tracking | ✅ `@sentry/cloudflare` native SDK | Phase 1 |
| **Grafana Cloud** | Full LGTM stack, dashboards, alerting | ✅ OTLP push | Phase 2 |
| **Axiom** | Log analytics at scale, fast querying | ✅ Logpush + OTLP | Phase 3 (optional) |
| **Honeycomb** | Distributed tracing, best trace query UX | ✅ OTLP | Phase 3 (optional) |
| **Dash0** | Unified APM, OTel-native, strong alerting | ✅ OTLP | Phase 3 (optional) |
| **ScryWatch** | CF-native, no external vendor, D1/R2 storage | ✅ CF-native | Phase 3 (optional) |
| **Datadog** | Enterprise APM, existing org tooling | ✅ Logpush | Phase 3 (optional) |

---

## 💡 Implementation Plan

### Phase 1 — 🟥 High Priority (Error Visibility)

#### 1a. Implement `IDiagnosticsProvider` Abstraction in `src/diagnostics/`

Extend the existing `src/diagnostics/` module with a pluggable interface. This is the foundation everything else builds on.

```typescript
// src/diagnostics/IDiagnosticsProvider.ts
export interface ISpan {
    end(): void;
    setAttribute(key: string, value: string | number | boolean): void;
    recordException(error: Error): void;
}

export interface IDiagnosticsProvider {
    captureError(error: Error, context?: Record<string, unknown>): void;
    startSpan(name: string, attributes?: Record<string, string | number>): ISpan;
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}

export class NoOpDiagnosticsProvider implements IDiagnosticsProvider {
    captureError(_error: Error): void {}
    startSpan(_name: string): ISpan {
        return { end: () => {}, setAttribute: () => {}, recordException: () => {} };
    }
    recordMetric(_name: string, _value: number): void {}
}
```

Implementations to build: `SentryDiagnosticsProvider`, `OpenTelemetryDiagnosticsProvider`, `ConsoleDiagnosticsProvider`.

---

#### 1b. Sentry Error Tracking via `@sentry/cloudflare`

Integrate the [Sentry Cloudflare SDK](https://docs.sentry.io/platforms/javascript/guides/cloudflare/) to capture unhandled errors and compiler pipeline exceptions.

```typescript
// worker/worker.ts — wrap the existing handler
import * as Sentry from '@sentry/cloudflare';

export default Sentry.withSentry(
    (env: Env) => ({
        dsn: env.SENTRY_DSN,
        tracesSampleRate: 0.1, // 10% sampling in prod; 1.0 in staging
    }),
    existingWorkerHandler,
);
```

Also surface errors from `CompilerEventEmitter`'s `compile.error` event directly to Sentry via `SentryDiagnosticsProvider`.

---

#### 1c. Enable Cloudflare Logpush → R2

Zero infrastructure, zero additional cost within Cloudflare. Provides long-term log retention beyond the 24-hour Workers Logs window.

```bash
wrangler logpush create \
  --dataset workers-trace-requests \
  --destination-conf "r2://your-bucket/{DATE}/adblock-logs"
```

---

#### 1d. Wire Up Tail Worker Alerting

`worker/tail.ts` has a `shouldForwardEvent()` stub and a `LOG_SINK_URL` env var. Wire it to a real webhook (Slack, PagerDuty, or similar) for critical error bursts:

```typescript
// worker/tail.ts
async function forwardAlert(event: TailEvent, env: TailEnv): Promise<void> {
    if (!env.ERROR_WEBHOOK_URL) return;
    await fetch(env.ERROR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: `🚨 *adblock-compiler*: ${event.exceptions?.[0]?.message ?? 'Worker error'}`,
            outcome: event.outcome,
            timestamp: new Date(event.eventTimestamp).toISOString(),
            url: event.event?.request?.url,
        }),
    });
}
```

---

### Phase 2 — 🟨 Medium Priority (Dashboards & Metrics)

#### 2a. OpenTelemetry Tracing Wired Into the Worker Runtime

The `createOpenTelemetryExporter` exists in `src/diagnostics/` but is only used in the Deno layer. Wire it into `worker/worker.ts` so spans are exported via OTLP to Grafana Cloud:

- Span per transformation (`Deduplicate`, `Compress`, `Validate`, etc.)
- Span per source download
- Span per diff generation
- Export via `OTEL_EXPORTER_OTLP_ENDPOINT` env var to Grafana Tempo

```typescript
const tracer = trace.getTracer('adblock-compiler');
const span = tracer.startSpan('transform.deduplicate');
// ... run transformation
span.end();
```

---

#### 2b. Prometheus `/metrics` Endpoint (FEATURE-017)

Replace KV-based rolling metrics with an Analytics Engine-backed Prometheus endpoint for Grafana scraping:

```typescript
// worker/handlers/prometheus-metrics.ts
export function handlePrometheusMetrics(data: MetricsSummary): Response {
    const lines = [
        '# HELP compilation_requests_total Total compilation requests',
        '# TYPE compilation_requests_total counter',
        `compilation_requests_total ${data.totalRequests}`,
        '',
        '# HELP compilation_error_rate Current error rate (0–1)',
        '# TYPE compilation_error_rate gauge',
        `compilation_error_rate ${data.errorRate}`,
        '',
        '# HELP compilation_latency_avg_ms Average latency in milliseconds',
        '# TYPE compilation_latency_avg_ms gauge',
        `compilation_latency_avg_ms ${data.avgLatencyMs}`,
    ];
    return new Response(lines.join('\n'), {
        headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    });
}
```

---

#### 2c. Performance Metrics via `IDiagnosticsProvider`

Track and report through the provider abstraction:

- Total compilation duration
- Rules in vs. rules out per transformation
- Download latency per source
- Diff size (added/removed rules)
- Cache hit/miss ratios over time

---

### Phase 3 — 🟩 Low Priority / Nice-to-Have

#### 3a. Frontend RUM via Sentry Browser SDK

Add Sentry to the Angular admin frontend for JS error tracking and session replay:

```typescript
// frontend/src/main.ts
import * as Sentry from '@sentry/angular';

Sentry.init({
    dsn: environment.sentryDsn,
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
```

---

#### 3b. Source Map Upload in CI/CD

Upload source maps to Sentry as part of the deployment pipeline so stack traces are readable:

```bash
# In CI/CD (e.g., GitHub Actions)
npx @sentry/cli sourcemaps upload \
  --org your-org \
  --project adblock-compiler \
  ./dist
```

---

#### 3c. Evaluate Additional Providers

If Sentry + Grafana are insufficient, evaluate:
- **Axiom** — richer log querying beyond Logpush + R2
- **Honeycomb** — best-in-class distributed trace query UX
- **Dash0** — OTel-native unified APM with strong alerting
- **ScryWatch** — fully CF-native, no external vendor (stores in D1/R2)

---

## Key Considerations

- The Sentry Cloudflare SDK is purpose-built for Workers and requires minimal setup. **Start here.**
- OpenTelemetry is more portable but heavier. **Wire it in Phase 2** once the `IDiagnosticsProvider` abstraction is in place.
- A pluggable `IDiagnosticsProvider` in `src/diagnostics/` allows Sentry and OTel to coexist and be swapped without changing call sites.
- Analytics Engine (`ANALYTICS_ENGINE` binding) is already in production — the Prometheus endpoint in Phase 2 simply surfaces it in a standard format.
- **Sentry and Grafana are complementary.** Sentry answers *"what broke and why"*; Grafana answers *"how is the system trending over time."*