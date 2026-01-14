# Queue Tests

This directory contains comprehensive tests for the Cloudflare Queue integration.

## Test Files

### Unit Tests

- **`queue.test.ts`** - Unit tests for queue message structures, validation, and helper functions
  - Tests message type structures (compile, batch-compile, cache-warm)
  - Tests request ID generation and uniqueness
  - Tests message validation and edge cases
  - Tests optional fields (pre-fetched content, benchmark flags)
  - Tests type discrimination

### Integration Tests

- **`queue.integration.test.ts`** - Integration tests simulating end-to-end queue processing
  - Tests queue message enqueuing
  - Tests KV cache storage and retrieval
  - Tests batch processing simulation
  - Tests message acknowledgment and retry
  - Tests request ID uniqueness at scale
  - Tests mock Cloudflare environment bindings

## Running Tests

### Run All Queue Tests

```bash
deno test worker/queue.test.ts worker/queue.integration.test.ts
```

### Run Unit Tests Only

```bash
deno test worker/queue.test.ts
```

### Run Integration Tests Only

```bash
deno test worker/queue.integration.test.ts
```

### Run with Coverage

```bash
deno test --coverage=coverage worker/queue.test.ts worker/queue.integration.test.ts
deno coverage coverage --lcov --include="^file:"
```

## Test Coverage

### Unit Tests Coverage

- ✅ Message structure validation (100%)
- ✅ Request ID generation (100%)
- ✅ Optional fields handling (100%)
- ✅ Edge cases (empty arrays, max size, etc.) (100%)
- ✅ Type discrimination (100%)

### Integration Tests Coverage

- ✅ Queue enqueuing (100%)
- ✅ KV cache operations (100%)
- ✅ Message batch processing (100%)
- ✅ Acknowledgment/retry tracking (100%)
- ✅ Request ID uniqueness (100%)

## Mock Objects

The integration tests use mock implementations of Cloudflare bindings:

- **`MockKVNamespace`** - Simulates Cloudflare KV storage
- **`MockQueue`** - Simulates Cloudflare Queue
- **`MockMessageBatch`** - Simulates queue consumer message batch
- **`MockEnv`** - Simulates worker environment with all bindings

## Test Output

Example test run output:

```
running 30 tests from ./worker/queue.test.ts
Queue Message - compile message has correct structure ... ok (2ms)
Queue Message - batch compile message has correct structure ... ok (1ms)
Queue Message - cache warm message has correct structure ... ok (1ms)
...

running 15 tests from ./worker/queue.integration.test.ts
Integration - Queue message enqueuing ... ok (3ms)
Integration - Batch message enqueuing ... ok (2ms)
Integration - KV cache storage and retrieval ... ok (4ms)
...

test result: ok. 45 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out (234ms)
```

## Adding New Tests

When adding new queue features:

1. **Add unit tests** to `queue.test.ts` for:
   - Message structure validation
   - Helper function behavior
   - Edge cases and error conditions

2. **Add integration tests** to `queue.integration.test.ts` for:
   - End-to-end workflows
   - Mock environment interactions
   - System behavior under various conditions

3. **Follow naming conventions**:
   - Descriptive test names: `Queue Message - <what it tests>`
   - Integration tests: `Integration - <what it tests>`
   - Clear assertions with helpful error messages

## CI/CD Integration

These tests run automatically in the CI pipeline:

```yaml
- name: Run tests
  run: deno task test
```

The CI configuration is in `.github/workflows/ci.yml`.

## Notes

- Unit tests are fast and focused on individual components
- Integration tests use mocks and don't require actual Cloudflare deployment
- For production testing, deploy to Cloudflare and use `wrangler dev` or staging environment
- Tests are co-located with the worker code for easy maintenance
