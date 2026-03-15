# Cloudflare Native Observability

`adblock-compiler` ships with Cloudflare's built-in observability suite already
enabled in `wrangler.toml`. This document explains what is configured, how to
access it, and how to extend it.

---

## Table of contents

1. [Workers Logs](#1-workers-logs)
2. [Workers Traces (Distributed Tracing)](#2-workers-traces-distributed-tracing)
3. [Analytics Engine](#3-analytics-engine)
4. [Tail Worker](#4-tail-worker)
5. [Logpush](#5-logpush)
6. [Cloudflare Dashboard quick-reference](#6-cloudflare-dashboard-quick-reference)
7. [Is observability configured correctly?](#7-is-observability-configured-correctly)

---

## 1. Workers Logs

### What is enabled

```toml
[observability]
[observability.logs]
enabled = true
head_sampling_rate = 1   # capture 100 % of invocations
persist = true           # retain logs beyond the live-tail window
invocation_logs = true   # include per-invocation metadata (status, duration)
```

`head_sampling_rate = 1` means **every** request is logged. For high-traffic
workers you may want to lower this (e.g., `0.1`) once load increases; 100 % is
appropriate for current traffic levels.

### Where to view

- **Dashboard**: *Cloudflare Dashboard → Workers & Pages → adblock-compiler → Logs*
- **CLI live tail** (real-time):
  ```bash
  wrangler tail --format pretty
  # or structured JSON for piping to jq:
  wrangler tail --format json | jq '.logs[].message[]'
  ```

### Structured log format

The `AdminLogger` (`worker/services/admin-logger.ts`) emits structured JSON that
Workers Logs stores verbatim:

```json
{
  "level": "info",
  "message": "Role assigned successfully",
  "requestId": "a1b2c3d4",
  "operation": "role.assign",
  "actorId": "user_2abc123",
  "durationMs": 42,
  "status": "success",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

Filter by `requestId` to correlate all lines for a single request:

```bash
wrangler tail --format json | jq 'select(.logs[].message[] | strings | contains("a1b2c3d4"))'
```

---

## 2. Workers Traces (Distributed Tracing)

### What is enabled

```toml
[observability.traces]
enabled = true
head_sampling_rate = 1
persist = true
```

Cloudflare automatically creates a root span for every Worker invocation and
child spans for:

- Subrequests (`fetch()` calls to external origins)
- D1 queries
- KV reads and writes
- R2 operations
- Queue sends

### Where to view

*Cloudflare Dashboard → Workers & Pages → adblock-compiler → Traces*

Each trace shows the full waterfall from inbound request → Worker logic →
D1/KV/R2/external subrequests → response.

### OpenTelemetry export (optional)

The `OpenTelemetryDiagnosticsProvider` (`src/diagnostics/OpenTelemetryDiagnosticsProvider.ts`)
bridges `IDiagnosticsProvider` to any OTLP-compatible backend (Grafana Tempo,
Jaeger, Honeycomb, etc.):

```typescript
import { OpenTelemetryDiagnosticsProvider } from '../src/diagnostics/index.ts';

const diagnostics = new OpenTelemetryDiagnosticsProvider({
    serviceName: 'adblock-compiler',
    serviceVersion: env.COMPILER_VERSION,
});
```

Configure the OTLP endpoint via the standard `OTEL_EXPORTER_OTLP_ENDPOINT`
environment variable, or set it directly in the provider constructor.

---

## 3. Analytics Engine

### What is enabled

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS_ENGINE"
dataset = "adguard-compiler-analytics-engine"
```

The `AnalyticsService` (`src/services/AnalyticsService.ts`) writes typed data
points to this binding. Events tracked:

| Event type | Trigger |
|------------|---------|
| `compilation_request` | Any compile API call |
| `compilation_success` | Successful compile |
| `compilation_error` | Failed compile |
| `cache_hit` / `cache_miss` | KV cache result |
| `rate_limit_exceeded` | Client hit rate limit |
| `source_fetch` | External source downloaded |
| `workflow_started/completed/failed` | CF Workflow transitions |
| `admin_action` | Admin mutation |
| `admin_auth_failure` | Auth rejection |

### Querying

Use the Workers Analytics Engine **SQL API**:

```bash
# Replace with your actual account ID and API token
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT index1 AS event_type, count() AS total FROM `adguard-compiler-analytics-engine` WHERE timestamp > NOW() - INTERVAL '\''24'\'' HOUR GROUP BY index1 ORDER BY total DESC LIMIT 20"
  }'
```

#### Common queries

```sql
-- Compilation error rate (last 24 h)
SELECT
    countIf(index1 = 'compilation_success') AS successes,
    countIf(index1 = 'compilation_error')   AS errors,
    round(countIf(index1 = 'compilation_error') / count() * 100, 2) AS error_rate_pct
FROM `adguard-compiler-analytics-engine`
WHERE timestamp > NOW() - INTERVAL '24' HOUR;

-- Cache hit rate (last 1 h)
SELECT
    countIf(index1 = 'cache_hit')  AS hits,
    countIf(index1 = 'cache_miss') AS misses,
    round(countIf(index1 = 'cache_hit') / count() * 100, 2) AS hit_rate_pct
FROM `adguard-compiler-analytics-engine`
WHERE timestamp > NOW() - INTERVAL '1' HOUR;

-- Top rate-limited IPs (last 1 h)
SELECT blob2 AS client_ip, count() AS events
FROM `adguard-compiler-analytics-engine`
WHERE index1 = 'rate_limit_exceeded'
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY client_ip
ORDER BY events DESC
LIMIT 10;
```

### Prometheus scrape endpoint

The Prometheus handler at **`GET /metrics/prometheus`** queries Analytics Engine
on-demand and returns text exposition format. See [Prometheus Metrics](./PROMETHEUS.md).

---

## 4. Tail Worker

The tail worker (`worker/tail.ts`) is deployed as a separate Worker and receives
a copy of every tail event produced by the main worker.

### Capabilities

| Feature | Env variable | Default |
|---------|-------------|---------|
| Short-term log storage (KV) | `TAIL_LOGS` binding | Off |
| Slack alerting on errors | `SLACK_WEBHOOK_URL` | Off |
| HTTP log sink forwarding | `LOG_SINK_URL` + `LOG_SINK_TOKEN` | Off |
| Minimum level for log sink | `LOG_SINK_MIN_LEVEL` | `warn` |
| Sentry DSN (future) | `SENTRY_DSN` | Off |

### Enable Slack alerting

```bash
# Set the Slack incoming webhook URL on the tail worker
wrangler secret put SLACK_WEBHOOK_URL --config wrangler.tail.toml
# Paste your Slack webhook URL: https://hooks.slack.com/services/...
```

The `formatSlackAlert()` helper converts any tail event into a colour-coded
Block Kit attachment (red for errors/exceptions, green for success).

### Enable log sink forwarding

```bash
wrangler secret put LOG_SINK_URL   --config wrangler.tail.toml
wrangler secret put LOG_SINK_TOKEN --config wrangler.tail.toml
```

Compatible sinks: Better Stack (Logtail), Axiom, Grafana Loki, Datadog HTTP Logs API.

---

## 5. Logpush

Logpush exports Workers Logs to a long-term destination at the account level.

```bash
# Enable Logpush for this worker (requires Cloudflare API)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/logpush/jobs" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "adblock-compiler-logs",
    "destination_conf": "r2://adblock-compiler-r2-storage/logs/{DATE}?account-id=$CLOUDFLARE_ACCOUNT_ID",
    "dataset": "workers_trace_events",
    "filter": "{\"where\":{\"and\":[{\"key\":\"ScriptName\",\"operator\":\"eq\",\"value\":\"adblock-compiler\"}]}}",
    "enabled": true
  }'
```

Logs land in the `adblock-compiler-r2-storage` R2 bucket under `logs/YYYY-MM-DD/`.

---

## 6. Cloudflare Dashboard quick-reference

| Feature | Path in Dashboard |
|---------|------------------|
| Live log tail | Workers & Pages → adblock-compiler → Logs |
| Distributed traces | Workers & Pages → adblock-compiler → Traces |
| Analytics Engine SQL | Workers & Pages → Analytics Engine |
| Durable Object metrics | Workers & Pages → adblock-compiler → Durable Objects |
| Worker CPU/memory usage | Workers & Pages → adblock-compiler → Metrics |
| Security events (WAF, rate limit) | Security → Events |
| Zero Trust Access logs | Zero Trust → Logs → Access |

---

## 7. Is observability configured correctly?

The `wrangler.toml` `[observability]` block is **fully enabled**:

```toml
[observability]
[observability.logs]
enabled = true
head_sampling_rate = 1
persist = true
invocation_logs = true

[observability.traces]
enabled = true
head_sampling_rate = 1
persist = true
```

This means:
- ✅ **Workers Logs** — enabled, 100 % sampling, persisted
- ✅ **Workers Traces** — enabled, 100 % sampling, persisted
- ✅ **Analytics Engine** — binding configured (`ANALYTICS_ENGINE`)
- ✅ **Logpush** — `logpush = true` in `wrangler.toml`
- ✅ **Tail Worker** — `tail_consumers` block in `wrangler.toml`
- ⚙️  **Sentry** — scaffolded; activate by setting `SENTRY_DSN` secret and installing `@sentry/cloudflare`
- ⚙️  **Prometheus** — handler ready at `GET /metrics/prometheus`; needs `ANALYTICS_ACCOUNT_ID` + `ANALYTICS_API_TOKEN` secrets and route wiring

> **Note on API access**: The Cloudflare Dashboard and `wrangler tail` use your
> `CLOUDFLARE_API_TOKEN` (set in `.env.local`). The agent cannot log into the
> Cloudflare Dashboard on your behalf, but you can verify that the above settings
> are live by running `wrangler tail` and making any request to the Worker.
