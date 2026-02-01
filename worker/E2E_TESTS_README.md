# End-to-End Tests

Automated end-to-end tests for the Adblock Compiler API and WebSocket endpoints.

## Overview

The e2e test suite includes:

- **API Tests** (`api.e2e.test.ts`) - HTTP endpoint testing
  - Core API endpoints
  - Compilation and batch compilation
  - Streaming (SSE)
  - Queue operations
  - Performance testing
  - Error handling

- **WebSocket Tests** (`websocket.e2e.test.ts`) - Real-time connection testing
  - Connection lifecycle
  - Real-time compilation
  - Session management
  - Event streaming
  - Error handling

## Prerequisites

The e2e tests require a running server instance. You have two options:

### Option 1: Local Development Server

```bash
# In terminal 1 - Start the development server
deno task dev

# In terminal 2 - Run the e2e tests
deno task test:e2e
```

### Option 2: Test Against Remote Server

```bash
# Set the E2E_BASE_URL environment variable
E2E_BASE_URL=https://adblock-compiler.jayson-knight.workers.dev deno task test:e2e
```

## Running Tests

### Run All E2E Tests

```bash
deno task test:e2e
```

This runs both API and WebSocket tests.

### Run Only API Tests

```bash
deno task test:e2e:api
```

### Run Only WebSocket Tests

```bash
deno task test:e2e:ws
```

### Run Individual Test Files

```bash
# API tests only
deno test --allow-net worker/api.e2e.test.ts

# WebSocket tests only
deno test --allow-net worker/websocket.e2e.test.ts
```

### Run Specific Tests

```bash
# Run tests matching a pattern
deno test --allow-net --filter "compile" worker/api.e2e.test.ts
```

## Test Coverage

### API Tests (21 tests)

**Core API (8 tests)**

- ✅ GET /api - API information
- ✅ GET /api/version - version information
- ✅ GET /metrics - metrics data
- ✅ POST /compile - simple compilation
- ✅ POST /compile - with transformations
- ✅ POST /compile - cache behavior
- ✅ POST /compile/batch - batch compilation
- ✅ POST /compile - error handling

**Streaming (1 test)**

- ✅ POST /compile/stream - SSE streaming

**Queue (4 tests)**

- ✅ GET /queue/stats - queue statistics
- ✅ POST /compile/async - async compilation
- ✅ POST /compile/batch/async - async batch compilation
- ✅ GET /queue/results/{id} - retrieve results

**Performance (3 tests)**

- ✅ Response time < 2s
- ✅ Concurrent requests (5 parallel)
- ✅ Large batch (10 items)

**Error Handling (3 tests)**

- ✅ Invalid JSON
- ✅ Missing configuration
- ✅ CORS headers

**Additional (2 tests)**

- ✅ GET / - web UI
- ✅ GET /api/deployments - deployment history

### WebSocket Tests (9 tests)

**Connection (2 tests)**

- ✅ Connection establishment
- ✅ Receives welcome message

**Compilation (2 tests)**

- ✅ Compile with streaming events
- ✅ Multiple messages in session

**Error Handling (2 tests)**

- ✅ Invalid message format
- ✅ Invalid configuration

**Lifecycle (2 tests)**

- ✅ Graceful disconnect
- ✅ Reconnection capability

**Event Streaming (1 test)**

- ✅ Receives progress events

## Test Behavior

### Skipped Tests

Tests are automatically skipped if:

- **Server not available** - Tests will be marked as "ignored" if the server at `BASE_URL` is not responding
- **WebSocket not available** - WebSocket tests will be skipped if the WebSocket endpoint is not accessible

You'll see warnings like:

```
⚠️  Server not available at http://localhost:8787
   Start the server with: deno task dev
```

### Queue Tests

Queue-related tests accept multiple response statuses:

- `200` - Queue is configured and operational
- `500` - Queue not available (expected in local development)
- `202` - Job successfully queued

This allows tests to pass in both local and production environments.

## Configuration

### Environment Variables

- `E2E_BASE_URL` - Base URL for the server (default: `http://localhost:8787`)

Example:

```bash
E2E_BASE_URL=https://my-deployment.workers.dev deno task test:e2e
```

### Timeouts

Default timeouts can be adjusted in the test files:

- **API Tests**: 10 seconds per test (15s for large batches)
- **WebSocket Tests**: 5-15 seconds depending on test type

## Debugging

### View Detailed Output

```bash
# Run with verbose output
deno test --allow-net --v8-flags=--expose-gc worker/api.e2e.test.ts
```

### Run Single Test

```bash
# Run a specific test by name
deno test --allow-net --filter "GET /api" worker/api.e2e.test.ts
```

### Check Server Status

```bash
# Verify server is running
curl http://localhost:8787/api

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8787/ws/compile
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
    e2e:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: denoland/setup-deno@v1
              with:
                  deno-version: v2.x

            - name: Start server
              run: |
                  deno task dev &
                  sleep 10

            - name: Run E2E tests
              run: deno task test:e2e
```

### With Wrangler

```yaml
- name: Start Wrangler
  run: |
      npm install -g wrangler@3.78.12
      wrangler dev --port 8787 &
      sleep 10

- name: Run E2E tests
  run: deno task test:e2e
```

## Writing New Tests

### API Test Template

```typescript
Deno.test({
    name: 'E2E: <endpoint> - <description>',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/endpoint`);

        assertEquals(response.status, 200);

        const data = await response.json();
        assertExists(data.field);
    },
});
```

### WebSocket Test Template

```typescript
Deno.test({
    name: 'E2E: WebSocket - <description>',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Test timeout'));
            }, 10000);

            ws.addEventListener('message', (event) => {
                // Test logic
                clearTimeout(timeout);
                ws.close();
                resolve();
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            });
        });
    },
});
```

## Comparison with HTML E2E Tests

The project includes both:

1. **Automated E2E Tests** (these files)
   - Run via command line
   - Suitable for CI/CD
   - Comprehensive test coverage
   - Automated assertions

2. **HTML E2E Dashboard** (`/e2e-tests.html`)
   - Interactive browser-based testing
   - Visual feedback
   - Manual execution
   - Real-time monitoring

Both approaches are complementary and test the same endpoints.

## Troubleshooting

### "Server not available" Error

**Problem**: Tests skip because server is not responding

**Solution**:

```bash
# Verify server is running
deno task dev

# Or check if port is in use
lsof -ti :8787
```

### "Test timeout" Errors

**Problem**: Tests timing out

**Solution**:

- Increase timeout in test file
- Check server logs for errors
- Verify network connectivity
- Check if server is under load

### WebSocket Connection Failures

**Problem**: WebSocket tests failing

**Solution**:

```bash
# Check if WebSocket endpoint exists
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8787/ws/compile

# Verify wrangler.toml has WebSocket support
```

### Queue Tests Failing

**Problem**: Queue tests returning unexpected errors

**Solution**:

- Local development: `500` is expected (queues not configured)
- Production: Verify queue bindings in `wrangler.toml`
- Check Cloudflare dashboard for queue configuration

## Related Documentation

- [E2E Testing Guide](../docs/E2E_TESTING.md) - HTML dashboard documentation
- [OpenAPI Contract Tests](./openapi-contract.test.ts) - API contract validation
- [Integration Tests](./sse.integration.test.ts) - SSE and Queue integration tests
- [Worker README](./README.md) - Worker deployment documentation

## Support

For issues or questions:

1. Check the [main README](../README.md)
2. Review test output for specific error messages
3. Verify server is running and accessible
4. Check that all dependencies are installed
