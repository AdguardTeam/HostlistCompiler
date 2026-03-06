# Cloudflare Analytics Engine Integration

This document describes the Analytics Engine integration for tracking metrics and telemetry data in the adblock-compiler worker.

## Overview

Cloudflare Analytics Engine provides high-cardinality, real-time analytics with SQL-like querying capabilities. The adblock-compiler uses Analytics Engine to track:

- API request metrics
- Compilation success/failure rates
- Cache hit/miss ratios
- Rate limiting events
- Workflow execution metrics
- Source fetch performance

## Configuration

### wrangler.toml Setup

The Analytics Engine binding is already configured in `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS_ENGINE"
dataset = "adguard-compiler-analytics-engine"
```

### Environment Binding

The `Env` interface in `worker/worker.ts` includes the optional Analytics Engine binding:

```typescript
interface Env {
    // ... other bindings
    ANALYTICS_ENGINE?: AnalyticsEngineDataset;
}
```

The binding is optional, allowing the worker to function without Analytics Engine configured (e.g., in development).

## AnalyticsService

The `AnalyticsService` class (`src/services/AnalyticsService.ts`) provides a typed interface for tracking events.

### Event Types

| Event Type | Description |
|------------|-------------|
| `compilation_request` | A compilation request was received |
| `compilation_success` | Compilation completed successfully |
| `compilation_error` | Compilation failed with an error |
| `cache_hit` | Result served from cache |
| `cache_miss` | Cache miss, compilation required |
| `rate_limit_exceeded` | Client exceeded rate limit |
| `source_fetch` | External source fetch completed |
| `workflow_started` | Workflow execution started |
| `workflow_completed` | Workflow completed successfully |
| `workflow_failed` | Workflow failed with an error |
| `api_request` | Generic API request tracking |

### Data Model

Analytics Engine data points consist of:
- **Index (1)**: Event type for efficient filtering
- **Doubles (up to 20)**: Numeric metrics
- **Blobs (up to 20)**: String metadata

### Usage Example

```typescript
import { AnalyticsService } from '../src/services/AnalyticsService.ts';

// Create service instance
const analytics = new AnalyticsService(env.ANALYTICS_ENGINE);

// Track a compilation request
analytics.trackCompilationRequest({
    requestId: 'req-123',
    configName: 'EasyList',
    sourceCount: 3,
});

// Track success with metrics
analytics.trackCompilationSuccess({
    requestId: 'req-123',
    configName: 'EasyList',
    sourceCount: 3,
    ruleCount: 50000,
    durationMs: 1234,
    cacheKey: 'cache:abc123',
});

// Track errors
analytics.trackCompilationError({
    requestId: 'req-123',
    configName: 'EasyList',
    sourceCount: 3,
    durationMs: 500,
    error: 'Source fetch failed',
});
```

### Utility Methods

```typescript
// Hash IP addresses for privacy
const ipHash = AnalyticsService.hashIp('192.168.1.1');

// Categorize user agents
const category = AnalyticsService.categorizeUserAgent(userAgent);
// Returns: 'adguard', 'ublock', 'browser', 'curl', 'bot', 'library', 'unknown'
```

## Tracked Locations

Analytics tracking is integrated into:

### Worker Endpoints (`worker/worker.ts`)

- **Rate limiting**: Tracks when clients exceed rate limits
- **Cache hits/misses**: Tracks cache performance on `/compile/json`
- **Compilation requests**: Tracks all compilation attempts
- **Compilation results**: Tracks success/failure with metrics

### Workflows

All workflows track execution metrics:

| Workflow | Events Tracked |
|----------|----------------|
| `CompilationWorkflow` | started, completed, failed |
| `BatchCompilationWorkflow` | started, completed, failed |
| `CacheWarmingWorkflow` | started, completed, failed |
| `HealthMonitoringWorkflow` | started, completed, failed |

## Querying Analytics Data

Use the Cloudflare dashboard or GraphQL API to query analytics:

### Dashboard

1. Go to Cloudflare Dashboard > Analytics & Logs > Analytics Engine
2. Select the `adguard-compiler-analytics-engine` dataset
3. Use SQL queries to analyze data

### Example Queries

```sql
-- Compilation success rate over last 24 hours
SELECT
    blob1 as event_type,
    COUNT(*) as count
FROM adguard-compiler-analytics-engine
WHERE timestamp > NOW() - INTERVAL '24' HOUR
    AND blob1 IN ('compilation_success', 'compilation_error')
GROUP BY blob1

-- Average compilation duration by config
SELECT
    blob2 as config_name,
    AVG(double1) as avg_duration_ms,
    COUNT(*) as total_compilations
FROM adguard-compiler-analytics-engine
WHERE timestamp > NOW() - INTERVAL '7' DAY
    AND blob1 = 'compilation_success'
GROUP BY blob2
ORDER BY total_compilations DESC

-- Cache hit ratio
SELECT
    SUM(CASE WHEN blob1 = 'cache_hit' THEN 1 ELSE 0 END) as hits,
    SUM(CASE WHEN blob1 = 'cache_miss' THEN 1 ELSE 0 END) as misses,
    SUM(CASE WHEN blob1 = 'cache_hit' THEN 1 ELSE 0 END) * 100.0 /
        COUNT(*) as hit_rate_percent
FROM adguard-compiler-analytics-engine
WHERE timestamp > NOW() - INTERVAL '24' HOUR
    AND blob1 IN ('cache_hit', 'cache_miss')

-- Rate limit events by IP hash
SELECT
    blob3 as ip_hash,
    COUNT(*) as limit_events
FROM adguard-compiler-analytics-engine
WHERE timestamp > NOW() - INTERVAL '1' HOUR
    AND blob1 = 'rate_limit_exceeded'
GROUP BY blob3
ORDER BY limit_events DESC
LIMIT 10
```

## Graceful Degradation

The `AnalyticsService` gracefully handles missing Analytics Engine:

```typescript
constructor(dataset?: AnalyticsEngineDataset) {
    this.dataset = dataset;
    this.enabled = !!dataset;
}

private writeDataPoint(event: AnalyticsEventData): void {
    if (!this.enabled || !this.dataset) {
        return; // Silently skip when not configured
    }
    // ... write data point
}
```

This ensures:
- Local development works without Analytics Engine
- No errors if binding is missing
- Easy toggle for analytics collection

## Data Retention

Analytics Engine data is retained according to your Cloudflare plan:
- Free: 31 days
- Pro: 90 days
- Business: 1 year
- Enterprise: Custom

## Privacy Considerations

The implementation includes privacy-conscious practices:

1. **IP Hashing**: Client IPs are hashed before storage
2. **No PII**: No personal identifiable information is stored
3. **User Agent Categorization**: User agents are categorized rather than stored raw
4. **Request ID Tracking**: Uses generated request IDs rather than user identifiers

## Extending Analytics

To add new event tracking:

1. Add a new event type to `AnalyticsEventType`:
```typescript
export type AnalyticsEventType =
    | 'compilation_request'
    // ... existing types
    | 'your_new_event';
```

2. Create a data interface if needed:
```typescript
export interface YourEventData {
    requestId: string;
    // ... fields
}
```

3. Add a tracking method to `AnalyticsService`:
```typescript
public trackYourEvent(data: YourEventData): void {
    this.writeDataPoint({
        eventType: 'your_new_event',
        timestamp: Date.now(),
        doubles: [data.someNumber],
        blobs: [data.requestId, data.someString],
    });
}
```

4. Call the tracking method where appropriate in the codebase.

## Troubleshooting

### Analytics Not Recording

1. Verify the binding exists in `wrangler.toml`
2. Check the dataset name matches
3. Ensure `ANALYTICS_ENGINE` is in your `Env` interface
4. Check Cloudflare dashboard for the dataset

### Query Returns No Results

1. Verify the time range includes recent data
2. Check event type names match exactly
3. Ensure data is being written (check worker logs)

### High Cardinality Warnings

If you see cardinality warnings:
1. Avoid using raw IPs or unique identifiers in indexes
2. Use categorical values in blob fields
3. Consider aggregating data before writing
