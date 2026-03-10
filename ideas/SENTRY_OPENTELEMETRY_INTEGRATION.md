# Sentry / OpenTelemetry Integration

> Date: 2026-03-10

This document captures ideas for adding observability to the adblock-compiler via Sentry error tracking and OpenTelemetry tracing, hooking into the existing `src/diagnostics/` module.

---

## 🔭 Why Observability?

The compiler runs as a Cloudflare Worker and has a pipeline of transformations, downloads, and diff operations. Without observability, errors in production are silent and performance regressions are invisible.

---

## 💡 Integration Ideas

### 1. Sentry Error Tracking via `src/diagnostics/`
Integrate the [Sentry Cloudflare SDK](https://docs.sentry.io/platforms/javascript/guides/cloudflare/) to capture unhandled errors and compiler pipeline exceptions:

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  dsn: env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

Surface errors from `CompilerEventEmitter`'s `compile.error` event directly to Sentry.

---

### 2. OpenTelemetry Tracing
Add distributed tracing across the compiler pipeline using the [OpenTelemetry JS SDK](https://opentelemetry.io/docs/languages/js/):

- Span per transformation (`Deduplicate`, `Compress`, `Validate`, etc.)
- Span per source download
- Span per diff generation
- Export to Cloudflare Workers Trace, Jaeger, or Honeycomb

```typescript
const tracer = trace.getTracer('adblock-compiler');
const span = tracer.startSpan('transform.deduplicate');
// ... run transformation
span.end();
```

---

### 3. `DiagnosticsProvider` Abstraction in `src/diagnostics/`
Extend the existing `src/diagnostics/` module with a pluggable `IDiagnosticsProvider` interface:

```typescript
interface IDiagnosticsProvider {
  captureError(error: Error, context?: Record<string, unknown>): void;
  startSpan(name: string): ISpan;
  recordMetric(name: string, value: number): void;
}
```

Implementations: `SentryDiagnosticsProvider`, `OpenTelemetryDiagnosticsProvider`, `ConsoleDiagnosticsProvider`.

---

### 4. Performance Metrics
Track and report:
- Total compilation duration
- Rules in vs. rules out per transformation
- Download latency per source
- Diff size (added/removed rules)

---

### 5. Cloudflare Workers Analytics Engine
Use [Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) as a lightweight, zero-infrastructure metrics sink — no external service required.

---

## Key Consideration

The Sentry Cloudflare SDK is purpose-built for Workers and requires minimal setup. OpenTelemetry is more portable but heavier. A pluggable `IDiagnosticsProvider` in `src/diagnostics/` allows both to coexist.