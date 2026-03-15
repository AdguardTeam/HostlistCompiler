# Prometheus Metrics

`adblock-compiler` exposes a **Prometheus text exposition** endpoint at
`GET /metrics/prometheus` that is protected by `X-Admin-Key`.

Grafana (or any Prometheus-compatible scraper) can point at this endpoint to
pull 24-hour rolling metrics from Cloudflare Analytics Engine.

> **Status**: The handler (`worker/handlers/prometheus-metrics.ts`) is written
> and passes CI. Two wiring steps remain before it is live:
> 1. Route `/metrics/prometheus` in `worker/worker.ts` or `worker/router.ts`
> 2. Set the `ANALYTICS_ACCOUNT_ID` and `ANALYTICS_API_TOKEN` secrets

---

## Exposed metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `adblock_compilation_requests_total` | counter | — | Total compilation requests (24 h) |
| `adblock_compilation_errors_total` | counter | — | Total compilation errors (24 h) |
| `adblock_compilation_error_rate` | gauge | — | Compilation error rate (0–1) over 24 h |
| `adblock_compilation_latency_avg_ms` | gauge | — | Average compilation latency (ms) |
| `adblock_compilation_latency_p95_ms` | gauge | — | p95 compilation latency (ms) |
| `adblock_cache_hits_total` | counter | — | Cache hits (24 h) |
| `adblock_cache_misses_total` | counter | — | Cache misses (24 h) |
| `adblock_cache_hit_rate` | gauge | — | Cache hit rate (0–1) over 24 h |
| `adblock_rate_limit_events_total` | counter | — | Rate-limit exceeded events (24 h) |
| `adblock_source_fetch_errors_total` | counter | — | External source fetch errors (24 h) |

---

## Environment variables / secrets

| Secret | Description | Set via |
|--------|-------------|---------|
| `ANALYTICS_ACCOUNT_ID` | Cloudflare account ID | `wrangler secret put ANALYTICS_ACCOUNT_ID` |
| `ANALYTICS_API_TOKEN` | CF API token with "Account Analytics Read" | `wrangler secret put ANALYTICS_API_TOKEN` |
| `ADMIN_KEY` | Protects the `/metrics/prometheus` endpoint | already configured |

### Obtaining `ANALYTICS_API_TOKEN`

1. Go to *Cloudflare Dashboard → My Profile → API Tokens → Create Token*.
2. Use the **"Account Analytics Read"** template.
3. Scope to your account ID.
4. Copy the token and store it:

```bash
wrangler secret put ANALYTICS_API_TOKEN
# Paste your token at the prompt
```

---

## Wiring the route

Add to `worker/worker.ts` (or `worker/router.ts`) before the catch-all handler:

```typescript
import { handlePrometheusMetrics } from './handlers/prometheus-metrics.ts';

if (pathname === '/metrics/prometheus' && request.method === 'GET') {
    return handlePrometheusMetrics(request, env);
}
```

---

## Adding custom metrics

Import `registerPrometheusMetric` in any Worker module and call it at module
load time. The handler iterates the registry on every scrape — no changes to
`prometheus-metrics.ts` are needed:

```typescript
import { registerPrometheusMetric } from './handlers/prometheus-metric-registry.ts';

// Example: expose active Durable Object count
registerPrometheusMetric({
    name: 'adblock_workflow_active',
    type: 'gauge',
    help: 'Number of active compilation Durable Objects.',
    collect: async (env) => countActiveDOs(env),
});

// Example: a counter with static labels
registerPrometheusMetric({
    name: 'adblock_source_fetches',
    type: 'counter',
    help: 'Total external source fetches.',
    labels: { region: 'us-east' },
    collect: async (env) => getSourceFetchCount(env),
});
```

The `collect` function receives the full Worker `Env` so it can read KV, D1, R2,
or any other binding. Return `null` to skip emitting the metric for that scrape
cycle (e.g. when a dependency is not yet configured).

---

## Scraping with Grafana

### Prometheus data source

Add a new Prometheus data source in Grafana:

| Field | Value |
|-------|-------|
| URL | `https://adblock-compiler.your-domain.workers.dev/metrics/prometheus` |
| Authentication | Custom HTTP Header |
| Header name | `X-Admin-Key` |
| Header value | *(your `ADMIN_KEY` secret)* |
| Scrape interval | `60s` (Analytics Engine data has 1-min granularity) |

### Example Grafana dashboard panels

```promql
# Request rate (per minute, 5-min window)
rate(adblock_compilation_requests_total[5m]) * 60

# Error rate percentage
adblock_compilation_error_rate * 100

# Cache hit rate percentage
adblock_cache_hit_rate * 100

# p95 latency
adblock_compilation_latency_p95_ms
```

---

## Fallback behaviour

When `ANALYTICS_ACCOUNT_ID` or `ANALYTICS_API_TOKEN` are absent the endpoint
returns zeroed metrics (all values `0`) with a `# note:` comment indicating
the degraded state. This prevents scraper failures during initial rollout.

```
# HELP adblock_compilation_requests_total Total number of compilation requests in the last 24 hours.
# TYPE adblock_compilation_requests_total counter
adblock_compilation_requests_total 0
...
# note: ANALYTICS_ACCOUNT_ID or ANALYTICS_API_TOKEN not configured — all values are zero
```
