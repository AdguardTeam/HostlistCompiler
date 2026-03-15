# Sentry Integration

`adblock-compiler` integrates [Sentry for Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare/) (`@sentry/cloudflare`) for automatic error capture, performance tracing, and release tracking.

The integration is **additive and opt-in**: when `SENTRY_DSN` is absent the worker
runs identically to before. No error is thrown; no overhead is incurred.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites — create your Sentry project](#2-prerequisites--create-your-sentry-project)
3. [Install the SDK](#3-install-the-sdk)
4. [Environment variables and secrets](#4-environment-variables-and-secrets)
5. [Activate the Worker wrapper](#5-activate-the-worker-wrapper)
6. [Activate the Tail Worker capture](#6-activate-the-tail-worker-capture)
7. [Using `SentryDiagnosticsProvider`](#7-using-sentrydiagnosticsprovider)
8. [Verifying the integration](#8-verifying-the-integration)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture overview

```
worker/worker.ts
└── withSentryWorker(handler, cfg)          ← wraps the fetch handler
       │
       ├── no DSN → pass-through (zero cost)
       └── DSN set → Sentry.withSentry(cfg, handler)
                        │
                        └── captureException() on unhandled throws

src/diagnostics/SentryDiagnosticsProvider   ← fine-grained spans / errors
       │
       └── captureError()  → Sentry.captureException()
       └── startSpan()     → TODO: Sentry.startSpan() (after SDK install)

worker/tail.ts                               ← tail worker (separate deploy)
       └── SENTRY_DSN binding               ← available for future capture
```

---

## 2. Prerequisites — create your Sentry project

> **Security notice**: The Sentry DSN is a sensitive credential. Never commit it
> to source control. Always store it as a Cloudflare Worker Secret
> (`wrangler secret put SENTRY_DSN`) or in your untracked `.env.local`.

1. Log in to [sentry.io](https://sentry.io).
2. Create a new project: **Projects → Create Project → JavaScript → Cloudflare Workers**.
3. Name it `adblock-compiler` (or match your `wrangler.toml` `name` field).
4. Copy the **DSN** from *Settings → Projects → adblock-compiler → Client Keys (DSN)*.

---

## 3. Install the SDK

The SDK is a **production** dependency of the Worker bundle:

```bash
# From the repo root
npm install @sentry/cloudflare
```

After installing, activate the commented-out code in two files (see §5 and §7 below).

---

## 4. Environment variables and secrets

All Sentry configuration is stored as **Cloudflare Worker Secrets** — never in
`wrangler.toml [vars]` or source code.

### Required

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `SENTRY_DSN` | Your project DSN | Sentry → Settings → Projects → Your Project → Client Keys |

### Optional — tune performance monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPILER_VERSION` | `0.x.x` | Passed as the Sentry **release** tag (already set in CI) |

### Set secrets

```bash
# Main worker
wrangler secret put SENTRY_DSN
# Paste: https://<key>@oNNNNNN.ingest.sentry.io/<project-id>

# Tail worker (if deploying separately)
wrangler secret put SENTRY_DSN --config wrangler.tail.toml
```

### Local `.env.local`

Add to your `.env.local` (never commit a real DSN):

```dotenv
# Error Reporting — Sentry
# Sentry DSN (required when ERROR_REPORTER_TYPE=sentry)
SENTRY_DSN=https://your-key@oNNNNNN.ingest.sentry.io/your-project-id
```

---

## 5. Activate the Worker wrapper

`worker/services/sentry-init.ts` exports `withSentryWorker()`. This wrapper is
**not yet wired into `worker/worker.ts`** — you need to add the wrapping
after installing the SDK.

**Step 1 — Install the SDK:**

```bash
npm install @sentry/cloudflare
```

**Step 2 — Wrap the export default in `worker/worker.ts`:**

```typescript
import { withSentryWorker } from './services/sentry-init.ts';

// Replace the existing `export default workerHandler;` with:
export default withSentryWorker(workerHandler, (env) => ({
    dsn: env.SENTRY_DSN,
    release: env.COMPILER_VERSION,
    tracesSampleRate: 0.1,
}));
```

**Step 3 — Uncomment the Sentry path in `worker/services/sentry-init.ts`:**

```typescript
// Before (stub — active until SDK installed):
try {
    return await handler.fetch!(request, env, ctx);
} catch (error) {
    console.error(JSON.stringify({ ... }));
    throw error;
}

// After (full Sentry integration):
const Sentry = await import('@sentry/cloudflare');
return Sentry.withSentry(
    () => ({
        dsn: config.dsn!,
        release: config.release,
        environment: config.environment ?? 'production',
        tracesSampleRate: config.tracesSampleRate ?? 0.1,
    }),
    handler,
).fetch(request, env, ctx);
```

> **`tracesSampleRate`** — start at `0.1` (10 %) in production to stay within
> Sentry's free quota. Use `1.0` in staging.

---

## 6. Activate the Tail Worker capture

The tail worker (`worker/tail.ts`) already has the `SENTRY_DSN` binding on
`TailEnv`. To forward unhandled tail-worker exceptions to Sentry:

1. Add `SENTRY_DSN` as a secret for the **tail** worker deployment.
2. In `worker/tail.ts`, call `Sentry.captureException(error)` inside the
   `catch` block that processes the tail events (look for the
   `// TODO: wire Sentry...` comment).

---

## 7. Using `SentryDiagnosticsProvider` and the provider factory

### Quickstart — use the factory (recommended)

`worker/services/diagnostics-factory.ts` exports `createDiagnosticsProvider(env)`,
which reads `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` from `Env` and
returns the right provider (or a composite of both) with zero boilerplate:

```typescript
import { createDiagnosticsProvider } from './services/diagnostics-factory.ts';

export default {
    async fetch(request, env, ctx) {
        const diagnostics = createDiagnosticsProvider(env);
        const span = diagnostics.startSpan('compile');
        try {
            // ... business logic ...
            span.end();
        } catch (err) {
            span.recordException(err as Error);
            diagnostics.captureError(err as Error, { url: request.url });
            throw err;
        }
    },
};
```

| Env variables set | Provider returned |
|-------------------|--------------------|
| Neither | `ConsoleDiagnosticsProvider` (structured JSON to Workers Logs) |
| `SENTRY_DSN` only | `SentryDiagnosticsProvider` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` only | `OpenTelemetryDiagnosticsProvider` |
| Both | `CompositeDiagnosticsProvider([Sentry, OTel])` — both receive every event |

### Extending with extra providers

Pass additional providers as the second argument:

```typescript
import { createDiagnosticsProvider } from './services/diagnostics-factory.ts';
import { MyCustomSink } from './my-custom-sink.ts';

const diagnostics = createDiagnosticsProvider(env, [new MyCustomSink()]);
```

### Using `CompositeDiagnosticsProvider` directly

If you need full control, compose providers manually:

```typescript
import { CompositeDiagnosticsProvider, SentryDiagnosticsProvider } from '../src/diagnostics/index.ts';
import { OpenTelemetryDiagnosticsProvider } from '../src/diagnostics/index.ts';

const diagnostics = new CompositeDiagnosticsProvider([
    new SentryDiagnosticsProvider({ dsn: env.SENTRY_DSN }),
    new OpenTelemetryDiagnosticsProvider({ serviceName: 'adblock-compiler' }),
]);
```

### Manual provider selection (advanced)

```typescript
import { SentryDiagnosticsProvider } from '../diagnostics/index.ts';

const diagnostics = env.SENTRY_DSN
    ? new SentryDiagnosticsProvider({
        dsn: env.SENTRY_DSN,
        release: env.COMPILER_VERSION,
        environment: 'production',
        tracesSampleRate: 0.1,
    })
    : new ConsoleDiagnosticsProvider();

// Capture an error
try {
    // ... risky operation
} catch (err) {
    diagnostics.captureError(err as Error, { operation: 'compileFilterList' });
    throw err;
}

// Start a span
const span = diagnostics.startSpan('compile', { ruleCount: 5000 });
try {
    // ... timed operation
} finally {
    span.end();
}
```

---

## 8. Verifying the integration

### Trigger a test error

```bash
# POST a deliberately malformed rule — will be caught and reported
curl -X POST https://adblock-compiler.your-domain.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d '{"__sentry_test": true}'
```

### Check Sentry

1. Open **Sentry → Issues** — the error should appear within ~30 s.
2. Open **Sentry → Performance** — traces will appear once `tracesSampleRate > 0`.

### Local smoke test (no Sentry account needed)

```bash
# When SENTRY_DSN is absent the worker runs identically
wrangler dev
```

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build fails: `Could not resolve "@sentry/cloudflare"` | SDK not installed | `npm install @sentry/cloudflare` |
| No events in Sentry | `SENTRY_DSN` secret not set | `wrangler secret put SENTRY_DSN` |
| Quota exceeded | `tracesSampleRate` too high | Lower to `0.05` or `0.01` in production |
| SDK version conflicts | `@sentry/cloudflare` incompatibility | Check `package.json` lockfile; pin to a tested version |
| Worker size exceeds 1 MB | Sentry SDK is large | Enable `--minify` in wrangler, or use `ConsoleDiagnosticsProvider` only |

### Relevant files

| File | Role |
|------|------|
| `worker/services/sentry-init.ts` | `withSentryWorker()` — wraps the main handler |
| `src/diagnostics/SentryDiagnosticsProvider.ts` | Fine-grained span / error capture |
| `src/diagnostics/IDiagnosticsProvider.ts` | `IDiagnosticsProvider` interface (NoOp + Console) |
| `worker/tail.ts` | Tail worker — `TailEnv.SENTRY_DSN` binding |
| `.env.example` | `SENTRY_DSN` stub (search `Error Reporting`) |
