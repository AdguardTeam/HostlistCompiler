# Queue Diagnostic Events

This document describes how diagnostic events are emitted during queue-based compilation operations.

## Overview

The adblock-compiler queue system emits comprehensive diagnostic events throughout the compilation lifecycle, providing full observability into asynchronous compilation jobs.

## Event Flow

### 1. Queue Message Received

When a queue consumer receives a compilation message:

```typescript
// Create tracing context with metadata
const tracingContext = createTracingContext({
    metadata: {
        endpoint: 'queue/compile',
        configName: configuration.name,
        requestId: message.requestId,
        timestamp: message.timestamp,
        cacheKey: cacheKey || undefined,
    },
});
```

### 2. Compilation Execution

The tracing context is passed to the compiler:

```typescript
const compiler = new WorkerCompiler({
    preFetchedContent,
    tracingContext,  // Enables diagnostic collection
});

const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);
```

### 3. Diagnostic Emission

After compilation completes, all diagnostic events are emitted to the tail worker:

```typescript
if (result.diagnostics) {
    console.log(`[QUEUE:COMPILE] Emitting ${result.diagnostics.length} diagnostic events`);
    emitDiagnosticsToTailWorker(result.diagnostics);
}
```

## Diagnostic Event Types

Queue compilations emit the same diagnostic events as synchronous compilations:

### Operation Events

- **operationStart**: Start of operations like validation, source compilation, transformations
- **operationComplete**: Successful completion with result metadata
- **operationError**: Operation failures with error details

### Network Events

- **network**: HTTP requests for downloading filter lists
  - Request details (URL, method, headers)
  - Response metadata (status, size, duration)
  - Error information for failed requests

### Cache Events

- **cache**: Cache operations during compilation
  - Cache hits/misses
  - Compression statistics
  - Storage operations

### Performance Events

- **performanceMetric**: Performance measurements
  - Operation durations
  - Resource usage
  - Throughput metrics

## Tracing Context Metadata

Each diagnostic event includes metadata from the tracing context:

```json
{
  "endpoint": "queue/compile",
  "configName": "AdGuard DNS filter",
  "requestId": "compile-1704931200000-abc123",
  "timestamp": 1704931200000,
  "cacheKey": "cache:a1b2c3d4e5f6..."
}
```

This metadata allows correlation of diagnostic events with specific queue jobs.

## Tail Worker Integration

Diagnostic events are emitted through console logging with structured JSON:

```javascript
function emitDiagnosticsToTailWorker(diagnostics: DiagnosticEvent[]): void {
    // Summary
    console.log('[DIAGNOSTICS]', JSON.stringify({
        eventCount: diagnostics.length,
        timestamp: new Date().toISOString(),
    }));
    
    // Individual events
    for (const event of diagnostics) {
        const logData = {
            ...event,
            source: 'adblock-compiler',
        };
        
        // Use appropriate log level based on severity
        switch (event.severity) {
            case 'error':
                console.error('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            case 'warn':
                console.warn('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            case 'info':
                console.info('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            default:
                console.debug('[DIAGNOSTIC]', JSON.stringify(logData));
        }
    }
}
```

## Log Prefixes

Queue operations use structured logging prefixes for easy filtering:

| Prefix | Purpose |
|--------|---------|
| `[QUEUE:HANDLER]` | Queue consumer batch processing |
| `[QUEUE:COMPILE]` | Single compilation processing |
| `[QUEUE:BATCH]` | Batch compilation processing |
| `[QUEUE:CACHE-WARM]` | Cache warming processing |
| `[QUEUE:CHUNKS]` | Chunk-based parallel processing |
| `[DIAGNOSTICS]` | Diagnostic event summary |
| `[DIAGNOSTIC]` | Individual diagnostic event |

## Example Diagnostic Flow

### Complete Compilation Lifecycle

```
1. [QUEUE:COMPILE] Starting compilation for "AdGuard DNS filter" (requestId: compile-123)
2. [QUEUE:COMPILE] Cache key: cache:a1b2c3d4e5f6...
3. [DIAGNOSTIC] { eventType: "operationStart", operation: "validateConfiguration", ... }
4. [DIAGNOSTIC] { eventType: "operationComplete", operation: "validateConfiguration", ... }
5. [DIAGNOSTIC] { eventType: "operationStart", operation: "compileSources", ... }
6. [DIAGNOSTIC] { eventType: "network", url: "https://...", duration: 234, ... }
7. [DIAGNOSTIC] { eventType: "operationComplete", operation: "downloadSource", ... }
8. [DIAGNOSTIC] { eventType: "operationComplete", operation: "compileSources", ... }
9. [DIAGNOSTIC] { eventType: "performanceMetric", metric: "totalCompilationTime", ... }
10. [QUEUE:COMPILE] Compilation completed in 2345ms, 12500 rules generated
11. [DIAGNOSTICS] { eventCount: 15, timestamp: "2024-01-14T04:00:00.000Z" }
12. [QUEUE:COMPILE] Cached compilation in 123ms (1234567 -> 345678 bytes, 72.0% compression)
13. [QUEUE:COMPILE] Total processing time: 2468ms for "AdGuard DNS filter"
```

## Monitoring Diagnostic Events

### Using Wrangler CLI

Stream queue diagnostics in real-time:

```bash
# All diagnostics
wrangler tail | grep "DIAGNOSTIC"

# Only errors
wrangler tail | grep "DIAGNOSTIC.*error"

# Specific config
wrangler tail | grep "AdGuard DNS filter"
```

### Using Cloudflare Dashboard

1. Navigate to **Workers & Pages** > Your Worker
2. Click **Logs** tab
3. Filter by:
   - Prefix: `[DIAGNOSTIC]`
   - Severity: `error`, `warn`, `info`, `debug`
   - Request ID: `compile-*`, `batch-*`, `warm-*`

### Using Tail Worker

Configure a tail worker in `wrangler.toml` to export diagnostics:

```toml
[[tail_consumers]]
service = "adblock-compiler-tail-worker"
```

The tail worker can:
- Forward to external monitoring (Datadog, Splunk, etc.)
- Aggregate metrics
- Trigger alerts on errors
- Store for analysis

## Diagnostic Event Schema

### Example: Source Download

```json
{
  "eventType": "network",
  "category": "network",
  "severity": "info",
  "timestamp": "2024-01-14T04:00:00.000Z",
  "traceId": "trace-123",
  "spanId": "span-456",
  "metadata": {
    "endpoint": "queue/compile",
    "configName": "AdGuard DNS filter",
    "requestId": "compile-1704931200000-abc123",
    "timestamp": 1704931200000,
    "cacheKey": "cache:a1b2c3d4e5f6..."
  },
  "url": "https://adguardteam.github.io/.../filter.txt",
  "method": "GET",
  "statusCode": 200,
  "duration": 234,
  "size": 123456
}
```

### Example: Transformation Complete

```json
{
  "eventType": "operationComplete",
  "category": "operation",
  "severity": "info",
  "timestamp": "2024-01-14T04:00:01.000Z",
  "operation": "applyTransformation",
  "metadata": {
    "endpoint": "queue/compile",
    "configName": "AdGuard DNS filter",
    "requestId": "compile-1704931200000-abc123"
  },
  "transformation": "Deduplicate",
  "inputCount": 12600,
  "outputCount": 12500,
  "duration": 45
}
```

## Comparison: Queue vs Synchronous

| Aspect | Synchronous (`/compile`) | Queue (`/compile/async`) |
|--------|---------------------------|---------------------------|
| **Diagnostic Events** | ✅ Emitted | ✅ Emitted |
| **Tracing Context** | ✅ Included | ✅ Included |
| **Real-time Stream** | ✅ Via SSE (`/compile/stream`) | ❌ No (async processing) |
| **Tail Worker** | ✅ Emitted | ✅ Emitted |
| **Request ID** | Generated per request | ✅ Tracked in queue |
| **Metadata** | Basic | ✅ Enhanced (requestId, timestamp, priority) |

## Best Practices

### 1. Include Request IDs

Always reference the `requestId` when investigating queue jobs:

```bash
wrangler tail | grep "compile-1704931200000-abc123"
```

### 2. Monitor Error Events

Set up alerts for diagnostic events with `severity: "error"`:

```javascript
// In tail worker
if (event.severity === 'error') {
    await sendToAlertingSystem(event);
}
```

### 3. Track Performance Metrics

Aggregate performance metrics from diagnostic events:

```javascript
const metrics = diagnostics
    .filter(e => e.eventType === 'performanceMetric')
    .reduce((acc, e) => {
        acc[e.metric] = e.value;
        return acc;
    }, {});
```

### 4. Correlate with Queue Stats

Combine diagnostic events with queue statistics for complete visibility:

```bash
# Get queue stats
curl https://your-worker.dev/queue/stats

# Stream diagnostics
wrangler tail | grep "DIAGNOSTIC"
```

## Troubleshooting

### Missing Diagnostics

If diagnostic events aren't being emitted:

1. **Check tracing context creation**:
   ```typescript
   const tracingContext = createTracingContext({ metadata });
   ```

2. **Verify compiler initialization**:
   ```typescript
   const compiler = new WorkerCompiler({ tracingContext });
   ```

3. **Confirm emission call**:
   ```typescript
   emitDiagnosticsToTailWorker(result.diagnostics);
   ```

### Incomplete Events

If events are missing details:

- Ensure metadata is complete when creating tracing context
- Check that event handlers are properly configured
- Verify tail worker is receiving all console output

### Performance Impact

Diagnostic emission has minimal overhead:

- Events collected during compilation (already happening)
- Emission is fire-and-forget (doesn't block)
- Structured logging is optimized for Cloudflare Workers

## Related Documentation

- [Queue Support](./QUEUE_SUPPORT.md) - Queue configuration and usage
- [Workflow Diagrams](./WORKFLOW_DIAGRAMS.md) - Visual queue flows
- [Tail Worker Guide](../worker/TAIL_WORKER.md) - Tail worker integration

## Summary

✅ **Queue operations emit full diagnostic events**
✅ **Tracing context includes queue-specific metadata**
✅ **Events are logged to tail worker with structured prefixes**
✅ **Same diagnostic events as synchronous operations**
✅ **Full observability into asynchronous compilation**

Queue-based compilation provides the same level of diagnostic observability as synchronous compilation, with additional metadata for tracking asynchronous job lifecycle.
