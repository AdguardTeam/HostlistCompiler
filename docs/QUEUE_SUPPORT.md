# Cloudflare Queue Support

This document describes how to use the Cloudflare Queue integration for async compilation jobs.

## Overview

The adblock-compiler worker now supports asynchronous compilation through Cloudflare Queues. This is useful for:

- **Long-running compilations** - Offload CPU-intensive work to background processing
- **Batch operations** - Process multiple compilations without blocking
- **Cache warming** - Pre-compile popular filter lists asynchronously
- **Rate limit bypass** - Queue requests that would otherwise be rate-limited

## Queue Configuration

The queue is configured in `wrangler.toml`:

```toml
[[queues.producers]]
 queue = "adblock-compiler-worker-queue"
 binding = "ADBLOCK_COMPILER_QUEUE"

[[queues.consumers]]
 queue = "adblock-compiler-worker-queue"
 max_batch_size = 10
 max_batch_timeout = 5
```

## API Endpoints

### POST /compile/async

Queue a single compilation job for asynchronous processing.

**Request Body:**
```json
{
  "configuration": {
    "name": "My Filter List",
    "sources": [
      {
        "source": "https://example.com/filters.txt"
      }
    ],
    "transformations": ["Deduplicate", "RemoveEmptyLines"]
  },
  "benchmark": true
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Compilation job queued successfully",
  "note": "The compilation will be processed asynchronously and cached when complete"
}
```

### POST /compile/batch/async

Queue multiple compilation jobs for asynchronous processing.

**Request Body:**
```json
{
  "requests": [
    {
      "id": "filter-1",
      "configuration": {
        "name": "Filter List 1",
        "sources": [
          {
            "source": "https://example.com/filter1.txt"
          }
        ]
      }
    },
    {
      "id": "filter-2",
      "configuration": {
        "name": "Filter List 2",
        "sources": [
          {
            "source": "https://example.com/filter2.txt"
          }
        ]
      }
    }
  ]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Batch of 2 compilation jobs queued successfully",
  "note": "The compilations will be processed asynchronously and cached when complete"
}
```

**Limits:**
- Maximum 100 requests per batch
- No rate limiting (queue handles backpressure)

## Queue Message Types

The worker processes three types of queue messages:

### 1. Compile Message
Single compilation job with optional pre-fetched content and benchmarking.

```typescript
{
  type: 'compile',
  requestId: 'compile-123',
  timestamp: 1704931200000,
  configuration: { /* IConfiguration */ },
  preFetchedContent?: { /* url: content */ },
  benchmark?: boolean
}
```

### 2. Batch Compile Message
Multiple compilation jobs processed in parallel.

```typescript
{
  type: 'batch-compile',
  requestId: 'batch-123',
  timestamp: 1704931200000,
  requests: [
    {
      id: 'req-1',
      configuration: { /* IConfiguration */ },
      preFetchedContent?: { /* url: content */ },
      benchmark?: boolean
    },
    // ... more requests
  ]
}
```

### 3. Cache Warm Message
Pre-compile multiple configurations to warm the cache.

```typescript
{
  type: 'cache-warm',
  requestId: 'warm-123',
  timestamp: 1704931200000,
  configurations: [
    { /* IConfiguration */ },
    // ... more configurations
  ]
}
```

## How It Works

1. **Request** - Client sends a POST request to `/compile/async` or `/compile/batch/async`
2. **Queue** - Worker sends a message to the Cloudflare Queue
3. **Response** - Worker immediately returns `202 Accepted`
4. **Processing** - Queue consumer processes the message asynchronously
5. **Caching** - Compiled results are cached in KV storage
6. **Retrieval** - Client can later retrieve cached results via `/compile` endpoint

## Retry Behavior

The queue consumer automatically retries failed messages:

- **Success** - Message is acknowledged and removed from queue
- **Failure** - Message is retried with exponential backoff
- **Unknown Type** - Message is acknowledged to prevent infinite retries

## Benefits

### Compared to Synchronous Endpoints

| Feature | Sync (`/compile`) | Async (`/compile/async`) |
|---------|------------------|--------------------------|
| Response Time | Waits for compilation | Immediate (202 Accepted) |
| Rate Limiting | Yes (10 req/min) | No (queue handles backpressure) |
| CPU Usage | Blocks worker | Background processing |
| Use Case | Interactive requests | Batch operations, pre-warming |

### Use Cases

**Cache Warming**
```bash
# Pre-compile popular filter lists during low-traffic periods
curl -X POST https://your-worker.dev/compile/async \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "AdGuard DNS filter",
      "sources": [{
        "source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt"
      }]
    }
  }'
```

**Batch Processing**
```bash
# Process multiple filter lists without blocking
curl -X POST https://your-worker.dev/compile/batch/async \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"id": "adguard", "configuration": {...}},
      {"id": "easylist", "configuration": {...}},
      {"id": "easyprivacy", "configuration": {...}}
    ]
  }'
```

## Monitoring

Queue processing is logged to the console and can be monitored via:

- Cloudflare Dashboard > Workers & Pages > Your Worker > Logs
- Tail Worker (if configured)
- Analytics Engine (if configured)

Example log output:
```
[QUEUE] Processing batch of 5 messages
[QUEUE] Cached compilation for AdGuard DNS filter
[QUEUE] Processed batch of 5 compilations
```

## Error Handling

Errors during queue processing are:
1. Logged to console
2. Message is retried automatically
3. After max retries, message is sent to dead letter queue (if configured)

## Performance Considerations

- Queue messages are processed in batches (max 10 by default)
- Batch compilations process requests in parallel
- Cache TTL is 1 hour (configurable in worker code)
- Large filter lists may take several seconds to compile

## Local Development

To test queue functionality locally:

```bash
# Start the worker in development mode
npm run dev

# In another terminal, send a test request
curl -X POST http://localhost:8787/compile/async \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "Test",
      "sources": [{"source": "https://example.com/test.txt"}]
    }
  }'
```

**Note:** Local development mode simulates queue behavior but doesn't persist messages.

## Deployment

Ensure the queue is created before deploying:

```bash
# Create the queue (first time only)
wrangler queues create adblock-compiler-worker-queue

# Deploy the worker
npm run deploy
```

## Troubleshooting

**Queue not processing messages**
- Check queue configuration in `wrangler.toml`
- Verify queue exists: `wrangler queues list`
- Check worker logs for errors

**Messages failing repeatedly**
- Check error logs for specific failure reasons
- Verify source URLs are accessible
- Check KV namespace bindings are correct

**Slow processing**
- Increase `max_batch_size` in `wrangler.toml`
- Consider scaling worker resources
- Review filter list sizes and complexity

## Further Reading

- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Workers KV Documentation](https://developers.cloudflare.com/kv/)
- [Adblock Compiler API Documentation](../README.md)
