# Cloudflare Worker Implementation

This directory contains the production-ready Cloudflare Worker implementation for the Adblock Compiler.

## Overview

The worker provides a full-featured REST API with real-time streaming, queue-based async compilation, and comprehensive metrics.

## Core Files

### Worker Entry Points

- **`worker.ts`** - Main Cloudflare Worker with HTTP endpoints and queue consumer
- **`tail.ts`** - Tail worker for advanced logging and observability
- **`html.ts`** - Fallback HTML templates for error pages and UI

### Testing

- **`queue.test.ts`** - Unit tests for queue message structures and validation
- **`queue.integration.test.ts`** - Integration tests for queue processing
- **`openapi-contract.test.ts`** - OpenAPI specification contract tests

## API Endpoints

The worker exposes a comprehensive REST API:

### Compilation Endpoints

- **POST `/compile`** - Synchronous compilation with JSON response
- **POST `/compile/stream`** - Server-Sent Events (SSE) for real-time progress
- **POST `/compile/batch`** - Batch compile multiple configurations
- **POST `/compile/async`** - Queue-based async compilation
- **POST `/compile/batch/async`** - Queue-based batch compilation
- **GET `/ws/compile`** - WebSocket endpoint for bidirectional real-time updates

### Queue & Results

- **GET `/queue/stats`** - Queue depth and statistics
- **GET `/queue/results/{id}`** - Retrieve async compilation results

### Monitoring

- **GET `/metrics`** - Prometheus-style metrics
- **GET `/api`** - API documentation and health check

## Development

### Local Development

```bash
# Run worker locally
npm run dev

# Deploy to Cloudflare
npm run deploy

# View logs
npm run tail
```

### Testing

```bash
# Run all worker tests
deno task test

# Run queue tests specifically
deno test worker/queue.test.ts worker/queue.integration.test.ts

# Run OpenAPI contract tests
deno task test:contract

# Run with coverage
deno test --coverage=coverage worker/
deno coverage coverage --lcov
```

## Features

### Real-time Streaming

- **Server-Sent Events (SSE)** - Progress updates during compilation
- **WebSocket** - Bidirectional real-time communication
- Browser notifications for async job completion

### Queue Integration

- **Async Compilation** - Background processing for long-running jobs
- **Batch Processing** - Handle up to 10 compilations in parallel
- **Result Storage** - Results cached in KV for retrieval
- **Automatic Retries** - Circuit breaker with exponential backoff

### Performance

- **Request Deduplication** - Avoid duplicate compilations
- **Gzip Compression** - 70-80% reduction in cache size
- **Smart Caching** - Pre-warmed cache for popular filter lists
- **Rate Limiting** - Per-IP and global rate limits

## Environment Bindings

The worker requires the following Cloudflare bindings:

### KV Namespaces

- **`COMPILATION_RESULTS`** - Stores async compilation results
- **`RATE_LIMIT`** - Rate limiting state

### Queues

- **`COMPILE_QUEUE`** - Queue for async compilation jobs

### Configuration

Set in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "COMPILATION_RESULTS"
id = "your-kv-id"

[[queues.producers]]
binding = "COMPILE_QUEUE"
queue = "compile-queue"

[[queues.consumers]]
queue = "compile-queue"
max_batch_size = 10
max_batch_timeout = 30
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get the worker running in 5 minutes
- **[TAIL_WORKER.md](TAIL_WORKER.md)** - Observability and logging setup
- **[Queue Support](../docs/QUEUE_SUPPORT.md)** - Async compilation guide
- **[Batch API Guide](../docs/BATCH_API_GUIDE.md)** - Visual guide to batch processing
- **[Streaming API](../docs/STREAMING_API.md)** - Real-time updates via SSE/WebSocket

## Architecture

### Request Flow

1. **HTTP Request** → Worker receives compilation request
2. **Pre-fetch Sources** → Fetch filter lists on server-side (bypasses CORS)
3. **Compile** → Process with transformations
4. **Cache** → Store in KV if async
5. **Response** → Return compiled rules or job ID

### Queue Processing

1. **Enqueue** → Client submits async compilation job
2. **Queue Consumer** → Worker batch processes queue messages
3. **Compilation** → Background compilation with WorkerCompiler
4. **Storage** → Results stored in KV with TTL
5. **Retrieval** → Client polls for results or receives notification

## Production Deployment

Deploy to Cloudflare:

```bash
# Deploy main worker
npm run deploy

# Deploy tail worker (optional, for observability)
npm run tail:deploy
```

### Monitoring

Access metrics and logs:

```bash
# Real-time logs
npm run tail

# Metrics endpoint
curl https://your-worker.workers.dev/metrics
```
