# OpenAPI Quick Reference

Quick commands and workflows for working with the OpenAPI specification.

## 🚀 Quick Start

```bash
# Validate spec
deno task openapi:validate

# Generate docs
deno task openapi:docs

# Run contract tests
deno task test:contract

# View generated docs
open docs/api/index.html
```

## 📋 Common Tasks

### Before Committing

```bash
# Validate OpenAPI spec
deno task openapi:validate

# Run all tests
deno task test

# Run contract tests
deno task test:contract
```

### Before Deploying

```bash
# Full validation pipeline
deno task openapi:validate && \
deno task openapi:docs && \
deno task test:contract

# Deploy
deno task wrangler:deploy
```

### Testing Specific Endpoints

```bash
# Test sync compilation
deno test --filter "Contract: POST /compile" worker/openapi-contract.test.ts --allow-read --allow-write --allow-net --allow-env

# Test async queue
deno test --filter "Contract: POST /compile/async" worker/openapi-contract.test.ts --allow-read --allow-write --allow-net --allow-env

# Test streaming
deno test --filter "Contract: POST /compile/stream" worker/openapi-contract.test.ts --allow-read --allow-write --allow-net --allow-env
```

## 🔄 Async Queue Operations

### Key Concepts

**Cloudflare Queues are used for:**
- Long-running compilations (>5 seconds)
- Batch operations
- Background processing
- Rate limit avoidance

### Queue Workflow

```
1. POST /compile/async → Returns 202 + requestId
2. Job processes in background
3. GET /queue/results/{requestId} → Returns results
4. GET /queue/stats → Monitor queue health
```

### Testing Queues

```bash
# Test queue functionality
deno test --filter "Queue" worker/openapi-contract.test.ts --allow-read --allow-write --allow-net --allow-env

# Note: Local tests may return 500 (queue not configured)
# This is expected - queues work in production
```

### Queue Configuration

In `wrangler.toml`:
```toml
[[queues.producers]]
queue = "adblock-compiler-queue"
binding = "ADBLOCK_COMPILER_QUEUE"

[[queues.producers]]
queue = "adblock-compiler-queue-high-priority"
binding = "ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY"

[[queues.consumers]]
queue = "adblock-compiler-queue"
max_batch_size = 10
max_batch_timeout = 30
```

## 📊 Response Codes

### Success Codes
- `200` - OK (sync operations)
- `202` - Accepted (async operations queued)

### Client Error Codes
- `400` - Bad Request (invalid input, batch limit exceeded)
- `404` - Not Found (queue result not found)
- `429` - Rate Limited

### Server Error Codes
- `500` - Internal Error (validation failed, queue unavailable)

## 📝 Schema Validation

### Request Validation

All requests are validated against OpenAPI schemas:

```json
{
  "configuration": {
    "name": "Required string",
    "sources": [
      {
        "source": "Required string"
      }
    ]
  }
}
```

### Response Validation

Contract tests verify:
- ✅ Status codes match spec
- ✅ Content-Type headers correct
- ✅ Required fields present
- ✅ Data types match
- ✅ Custom headers (X-Cache, X-Request-Deduplication)

## 🧪 Postman Testing

```bash
# Regenerate collection from OpenAPI spec
deno task postman:collection

# Run all Postman tests
newman run docs/postman/postman-collection.json -e docs/postman/postman-environment.json

# Run specific folder
newman run docs/postman/postman-collection.json -e docs/postman/postman-environment.json --folder "Compilation"

# With detailed reporting
newman run docs/postman/postman-collection.json -e docs/postman/postman-environment.json --reporters cli,json,html
```

## 📈 Monitoring

### Queue Metrics

```bash
# Get queue statistics
curl http://localhost:8787/queue/stats

# Response:
{
  "pending": 0,
  "completed": 42,
  "failed": 1,
  "cancelled": 0,
  "totalProcessingTime": 12500,
  "averageProcessingTime": 297,
  "processingRate": 8.4,
  "queueLag": 150
}
```

### Performance Metrics

```bash
# Get API metrics
curl http://localhost:8787/metrics

# Response shows:
# - Request counts per endpoint
# - Success/failure rates
# - Average durations
# - Error types
```

## 🐛 Troubleshooting

### Validation Errors

```bash
❌ Missing "operationId" for POST /compile
```
→ Add `operationId` to endpoint in `docs/api/openapi.yaml`

### Contract Test Failures

```bash
❌ Expected status 200, got 500
```
→ Check server logs, verify request matches schema

### Queue Always Returns 500

```bash
❌ Queue bindings are not available
```
→ Expected locally. Queues work in production with Cloudflare Workers

### Documentation Won't Generate

```bash
❌ Failed to parse YAML
```
→ Run `deno task openapi:validate` to check syntax

## 📚 File Locations

```
docs/api/openapi.yaml                 # OpenAPI specification (canonical source — edit this)
docs/api/cloudflare-schema.yaml       # Auto-generated (deno task schema:cloudflare)
docs/postman/postman-collection.json  # Auto-generated (deno task postman:collection)
docs/postman/postman-environment.json # Auto-generated (deno task postman:collection)
scripts/validate-openapi.ts           # Validation script
scripts/generate-docs.ts              # Documentation generator
scripts/generate-postman-collection.ts # Postman generator
worker/openapi-contract.test.ts       # Contract tests
docs/api/index.html                   # Generated HTML docs
docs/api/README.md                    # Generated markdown docs
docs/api/OPENAPI_TOOLING.md           # Complete guide
docs/postman/README.md                # Postman collection guide
docs/testing/POSTMAN_TESTING.md       # Postman testing guide
```

## 🔗 Links

- **OpenAPI Spec:** [openapi.yaml](openapi.yaml)
- **Complete Guide:** [OPENAPI_TOOLING.md](./OPENAPI_TOOLING.md)
- **Postman Guide:** [POSTMAN_TESTING.md](../testing/POSTMAN_TESTING.md)
- **Queue Guide:** [QUEUE_SUPPORT.md](../cloudflare/QUEUE_SUPPORT.md)
- **Generated Docs:** [index.html](index.html)

## 💡 Tips

1. **Always validate before committing:**
   ```bash
   deno task openapi:validate
   ```

2. **Test against local server first:**
   ```bash
   deno task dev &
   sleep 3
   deno task test:contract
   ```

3. **Update docs when changing endpoints:**
   ```bash
   # Edit docs/api/openapi.yaml
   deno task openapi:docs
   git add docs/api/
   ```

4. **Use queue for long operations:**
   - Synchronous: `POST /compile` (< 5 seconds)
   - Asynchronous: `POST /compile/async` (> 5 seconds)

5. **Monitor queue health:**
   ```bash
   watch -n 5 'curl -s http://localhost:8787/queue/stats | jq'
   ```

---

For detailed information, see [OPENAPI_TOOLING.md](./OPENAPI_TOOLING.md)
