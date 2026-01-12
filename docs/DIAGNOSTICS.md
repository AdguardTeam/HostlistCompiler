# Diagnostics and Tracing System

The adblock-compiler includes a comprehensive diagnostics and tracing system that emits structured events throughout the compilation pipeline. These events can be captured by the Cloudflare Tail Worker for monitoring, debugging, and observability.

## Overview

The diagnostics system provides:

- **Structured Event Emission**: All operations emit standardized diagnostic events
- **Operation Tracing**: Track the start, completion, and errors of operations
- **Performance Metrics**: Record timing and resource usage metrics
- **Cache Events**: Monitor cache hits, misses, and operations
- **Network Events**: Track HTTP requests with timing and status codes
- **Error Tracking**: Capture errors with full context and stack traces
- **Correlation IDs**: Group related events across the compilation pipeline

## Architecture

The system consists of three main components:

1. **DiagnosticsCollector**: Aggregates and stores diagnostic events
2. **TracingContext**: Provides context for operations through the pipeline
3. **Event Types**: Structured event definitions for different categories

## Basic Usage

### Creating a Tracing Context

```typescript
import { createTracingContext } from '@jk-com/adblock-compiler';

const tracingContext = createTracingContext({
    metadata: {
        userId: 'user123',
        requestId: 'req456',
    },
});
```

### Using with FilterCompiler

```typescript
import { createTracingContext, FilterCompiler } from '@jk-com/adblock-compiler';

const tracingContext = createTracingContext();

const compiler = new FilterCompiler({
    tracingContext,
});

const result = await compiler.compileWithMetrics(configuration, true);

// Access diagnostic events
const diagnostics = result.diagnostics;
console.log(`Collected ${diagnostics.length} diagnostic events`);
```

### Using with WorkerCompiler

```typescript
import { createTracingContext, WorkerCompiler } from '@jk-com/adblock-compiler';

const tracingContext = createTracingContext();

const compiler = new WorkerCompiler({
    preFetchedContent: sources,
    tracingContext,
});

const result = await compiler.compileWithMetrics(configuration);

// Diagnostics are included in the result
if (result.diagnostics) {
    for (const event of result.diagnostics) {
        console.log(`[${event.category}] ${event.message}`);
    }
}
```

## Event Types

### Operation Events

Track the lifecycle of operations:

```typescript
// Operation Start
{
    eventId: "evt-123",
    timestamp: "2024-01-12T00:00:00.000Z",
    category: "compilation",
    severity: "debug",
    message: "Operation started: compileFilterList",
    correlationId: "trace-456",
    operation: "compileFilterList",
    input: {
        name: "My Filter List",
        sourceCount: 3
    }
}

// Operation Complete
{
    eventId: "evt-124",
    timestamp: "2024-01-12T00:00:01.234Z",
    category: "compilation",
    severity: "info",
    message: "Operation completed: compileFilterList (1234.56ms)",
    correlationId: "trace-456",
    operation: "compileFilterList",
    durationMs: 1234.56,
    output: {
        ruleCount: 5000
    }
}

// Operation Error
{
    eventId: "evt-125",
    timestamp: "2024-01-12T00:00:00.500Z",
    category: "error",
    severity: "error",
    message: "Operation failed: downloadSource - Network error",
    correlationId: "trace-456",
    operation: "downloadSource",
    errorType: "NetworkError",
    errorMessage: "Failed to fetch source",
    stack: "...",
    durationMs: 500
}
```

### Performance Metrics

Record performance measurements:

```typescript
{
    eventId: "evt-126",
    timestamp: "2024-01-12T00:00:01.000Z",
    category: "performance",
    severity: "debug",
    message: "Metric: inputRuleCount = 10000 rules",
    correlationId: "trace-456",
    metric: "inputRuleCount",
    value: 10000,
    unit: "rules",
    dimensions: {
        source: "my-source"
    }
}
```

### Cache Events

Monitor cache operations:

```typescript
{
    eventId: "evt-127",
    timestamp: "2024-01-12T00:00:00.100Z",
    category: "cache",
    severity: "debug",
    message: "Cache hit: cache-key-abc (1024 bytes)",
    correlationId: "trace-456",
    operation: "hit",
    key: "cache-key-abc",
    size: 1024
}
```

### Network Events

Track HTTP requests:

```typescript
{
    eventId: "evt-128",
    timestamp: "2024-01-12T00:00:00.200Z",
    category: "network",
    severity: "debug",
    message: "GET https://example.com/filters.txt - 200 (234.56ms)",
    correlationId: "trace-456",
    method: "GET",
    url: "https://example.com/filters.txt",
    statusCode: 200,
    durationMs: 234.56,
    responseSize: 50000
}
```

## Tail Worker Integration

The diagnostics events are automatically emitted to console in the Cloudflare Worker, where they can be captured by the Tail Worker.

### Event Emission

In `worker/worker.ts`, diagnostic events are emitted using severity-appropriate console methods:

```typescript
function emitDiagnosticsToTailWorker(diagnostics: DiagnosticEvent[]): void {
    for (const event of diagnostics) {
        const logData = {
            ...event,
            source: 'adblock-compiler',
        };

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

### Tail Worker Consumption

The Tail Worker receives these events and can process them:

```typescript
// In worker/tail.ts
export default {
    async tail(events: TailEvent[], env: TailEnv, ctx: ExecutionContext) {
        for (const event of events) {
            // Filter for diagnostic events
            const diagnosticLogs = event.logs.filter((log) =>
                log.message.some((m) => typeof m === 'string' && m.includes('[DIAGNOSTIC]'))
            );

            for (const log of diagnosticLogs) {
                // Parse and process diagnostic event
                const diagnostic = JSON.parse(log.message[1]);

                // Store in KV, forward to webhook, etc.
                if (env.TAIL_LOGS) {
                    await env.TAIL_LOGS.put(
                        `diagnostic:${diagnostic.eventId}`,
                        JSON.stringify(diagnostic),
                        { expirationTtl: 86400 },
                    );
                }
            }
        }
    },
};
```

## Advanced Features

### Manual Tracing

For custom operations, use the tracing utilities:

```typescript
import { createTracingContext, traceAsync, traceSync } from '@jk-com/adblock-compiler';

const context = createTracingContext();

// Trace synchronous operation
const result = traceSync(context, 'myOperation', () => {
    // Your code here
    return processData();
}, { inputSize: 1000 });

// Trace asynchronous operation
const result = await traceAsync(context, 'myAsyncOperation', async () => {
    // Your async code here
    return await fetchData();
}, { url: 'https://example.com' });
```

### Child Contexts

Create child contexts for nested operations:

```typescript
import { createChildContext } from '@jk-com/adblock-compiler';

const parentContext = createTracingContext({
    metadata: { requestId: '123' },
});

const childContext = createChildContext(parentContext, {
    operationName: 'downloadSource',
});

// Child context inherits correlation ID and parent metadata
```

### Filtering Events

Filter events by category or severity:

```typescript
const diagnostics = context.diagnostics.getEvents();

// Filter by category
const networkEvents = diagnostics.filter((e) => e.category === 'network');

// Filter by severity
const errors = diagnostics.filter((e) => e.severity === 'error');

// Filter by correlation ID
const relatedEvents = diagnostics.filter((e) => e.correlationId === 'trace-123');
```

## Best Practices

1. **Always use tracing contexts**: Pass tracing contexts through your compilation pipeline
2. **Use correlation IDs**: Group related events with correlation IDs
3. **Include metadata**: Add relevant metadata to contexts for better debugging
4. **Monitor performance metrics**: Track key metrics like rule counts and durations
5. **Handle errors properly**: Ensure errors are captured in diagnostic events
6. **Clean up contexts**: Clear diagnostic events when appropriate to prevent memory leaks

## Examples

See `worker/worker.ts` for complete examples of integrating diagnostics into the Cloudflare Worker.

## API Reference

### `createTracingContext(options?)`

Creates a new tracing context.

**Parameters:**

- `options.correlationId?`: Custom correlation ID
- `options.parent?`: Parent tracing context
- `options.metadata?`: Custom metadata object
- `options.diagnostics?`: Custom diagnostics collector

**Returns:** `TracingContext`

### `DiagnosticsCollector`

Collects and stores diagnostic events.

**Methods:**

- `operationStart(operation, input?)`: Start tracking an operation
- `operationComplete(eventId, output?)`: Mark operation as complete
- `operationError(eventId, error)`: Record an operation error
- `recordMetric(metric, value, unit, dimensions?)`: Record a performance metric
- `recordCacheEvent(operation, key, size?)`: Record a cache operation
- `recordNetworkEvent(method, url, statusCode?, durationMs?, responseSize?)`: Record a network request
- `emit(event)`: Emit a custom diagnostic event
- `getEvents()`: Get all collected events
- `clear()`: Clear all events

## Troubleshooting

### Events not appearing in tail worker

1. Ensure the main worker has `tail_consumers` configured in `wrangler.toml`
2. Verify diagnostic events are being emitted with `console.log/error/etc`
3. Check tail worker is deployed and running

### Too many events

1. Use the `NoOpDiagnosticsCollector` for operations that don't need tracing
2. Filter events by severity or category before storing
3. Implement sampling to capture only a percentage of events

### Performance impact

The diagnostics system is designed to be lightweight, but for high-throughput scenarios:

1. Use `createNoOpContext()` to disable diagnostics entirely
2. Sample diagnostic collection (e.g., 1 in 100 requests)
3. Clear events periodically with `diagnostics.clear()`
