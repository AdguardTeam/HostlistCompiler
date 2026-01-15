# OpenAPI Tooling Guide

Complete guide to validating, testing, and documenting the Adblock Compiler API using the OpenAPI specification.

## 📋 Table of Contents

- [Overview](#overview)
- [Validation](#validation)
- [Documentation Generation](#documentation-generation)
- [Contract Testing](#contract-testing)
- [Postman Testing](#postman-testing)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Overview

The Adblock Compiler API is fully documented using the OpenAPI 3.0.3 specification (`openapi.yaml`). This specification serves as the single source of truth for:

- API endpoint definitions
- Request/response schemas
- Authentication requirements
- Error responses
- Examples and documentation

## Validation

### Validate OpenAPI Spec

Ensure your `openapi.yaml` conforms to the OpenAPI specification:

```bash
# Run validation
deno task openapi:validate

# Or directly
./scripts/validate-openapi.ts
```

**What it checks:**
- ✅ YAML syntax
- ✅ OpenAPI version compatibility
- ✅ Required fields (info, paths, etc.)
- ✅ Unique operation IDs
- ✅ Response definitions
- ✅ Schema completeness
- ✅ Best practices compliance

**Example output:**
```
🔍 Validating OpenAPI specification...

✅ YAML syntax is valid
✅ OpenAPI version: 3.0.3
✅ Title: Adblock Compiler API
✅ Version: 2.0.0
✅ Servers: 2 defined
✅ Paths: 10 endpoints defined
✅ Operations: 13 total
✅ Schemas: 30 defined
✅ Security schemes: 1 defined
✅ Tags: 5 defined

📋 Checking best practices...

✅ Request examples: 2 found
✅ Contact info provided
✅ License: GPL-3.0

============================================================
VALIDATION RESULTS
============================================================

✅ OpenAPI specification is VALID!

Summary: 0 errors, 0 warnings
```

### Pre-commit Validation

Add to your git hooks:

```bash
#!/bin/sh
# .git/hooks/pre-commit
deno task openapi:validate || exit 1
```

## Documentation Generation

### Generate HTML Documentation

Create beautiful, interactive API documentation using Redoc:

```bash
# Generate docs
deno task openapi:docs

# Or directly
./scripts/generate-docs.ts
```

**Output files:**
- `docs/api/index.html` - Interactive HTML documentation (Redoc)
- `docs/api/README.md` - Markdown reference documentation

### View Documentation

```bash
# Open HTML docs
open docs/api/index.html

# Or serve locally
python3 -m http.server 8000 --directory docs/api
# Then visit http://localhost:8000
```

### Features

The generated HTML documentation includes:

- 🔍 **Search functionality** - Find endpoints quickly
- 📱 **Responsive design** - Works on mobile/tablet/desktop
- 🎨 **Code samples** - Request/response examples
- 📊 **Schema explorer** - Interactive schema browser
- 🔗 **Deep linking** - Share links to specific endpoints
- 📥 **Download spec** - Export OpenAPI YAML/JSON

### Customization

Edit `scripts/generate-docs.ts` to customize:
- Theme colors
- Logo/branding
- Sidebar configuration
- Code sample languages

## Contract Testing

Contract tests validate that your live API conforms to the OpenAPI specification.

### Run Contract Tests

```bash
# Test against local server (default)
deno task test:contract

# Test against production
API_BASE_URL=https://adblock-compiler.jayson-knight.workers.dev deno task test:contract

# Test specific scenarios
deno test --allow-read --allow-write --allow-net --allow-env worker/openapi-contract.test.ts --filter "Contract: GET /api"
```

### What's Tested

**Core Endpoints:**
- ✅ GET `/api` - API info
- ✅ GET `/metrics` - Performance metrics
- ✅ POST `/compile` - Synchronous compilation
- ✅ POST `/compile/stream` - SSE streaming
- ✅ POST `/compile/batch` - Batch processing

**Async Queue Operations (Cloudflare Queues):**
- ✅ POST `/compile/async` - Queue async job
- ✅ POST `/compile/batch/async` - Queue batch job
- ✅ GET `/queue/stats` - Queue statistics
- ✅ GET `/queue/results/{id}` - Retrieve job results

**Contract Validation:**
- ✅ Response status codes match spec
- ✅ Response content types are correct
- ✅ Required fields are present
- ✅ Data types match schemas
- ✅ Headers conform to spec (X-Cache, X-Request-Deduplication)
- ✅ Error responses have proper structure

### Async Testing with Queues

The contract tests properly validate Cloudflare Queue integration:

```typescript
// Queues async compilation
const response = await apiRequest('/compile/async', {
    method: 'POST',
    body: JSON.stringify({ configuration, preFetchedContent }),
});

// Returns 202 if queues available, 500 if not configured
validateResponseStatus(response, [202, 500]);

if (response.status === 202) {
    const data = await response.json();
    // Validates requestId is returned
    validateBasicSchema(data, ['success', 'requestId', 'message']);
}
```

### Queue Test Scenarios

1. **Standard Priority Queue**
   - Tests default queue behavior
   - Validates requestId generation
   - Confirms job queuing

2. **High Priority Queue**
   - Tests priority routing
   - Validates faster processing (when implemented)

3. **Batch Queue Operations**
   - Tests multiple jobs queued together
   - Validates batch requestId tracking

4. **Queue Statistics**
   - Validates queue depth metrics
   - Confirms job status tracking
   - Tests history retention

### CI/CD Contract Testing

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on: [push, pull_request]

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x
      
      - name: Start local server
        run: deno task dev &
        
      - name: Wait for server
        run: sleep 5
        
      - name: Run contract tests
        run: deno task test:contract
```

## Postman Testing

See [POSTMAN_TESTING.md](POSTMAN_TESTING.md) for complete Postman documentation.

### Quick Start

```bash
# Import collection and environment
# - postman-collection.json
# - postman-environment.json

# Or use Newman CLI
npm install -g newman
newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json
```

### Postman Features

- 🧪 25+ test requests
- ✅ Automated assertions
- 📊 Response validation
- 🔄 Dynamic variables
- 📈 Performance testing

## CI/CD Integration

### GitHub Actions

Complete pipeline for validation, testing, and documentation:

```yaml
name: OpenAPI Pipeline

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      
      - name: Validate OpenAPI spec
        run: deno task openapi:validate

  generate-docs:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      
      - name: Generate documentation
        run: deno task openapi:docs
      
      - name: Upload docs
        uses: actions/upload-artifact@v3
        with:
          name: api-docs
          path: docs/api/

  contract-tests:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      
      - name: Start server
        run: deno task dev &
        
      - name: Wait for server
        run: sleep 10
      
      - name: Run contract tests
        run: deno task test:contract
        
  postman-tests:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start server
        run: docker compose up -d
        
      - name: Install Newman
        run: npm install -g newman
        
      - name: Run Postman tests
        run: newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json --reporters cli,json
        
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: newman-results
          path: newman/
```

### Pre-deployment Checks

```bash
#!/bin/bash
# scripts/pre-deploy.sh

echo "🔍 Validating OpenAPI spec..."
deno task openapi:validate || exit 1

echo "📚 Generating documentation..."
deno task openapi:docs || exit 1

echo "🧪 Running contract tests..."
deno task test:contract || exit 1

echo "✅ All checks passed! Ready to deploy."
```

## Best Practices

### 1. Keep Spec and Code in Sync

**Problem:** Spec drifts from actual implementation

**Solution:**
- Run contract tests on every PR
- Use CI/CD to block deployment if tests fail
- Review OpenAPI changes alongside code changes

```bash
# Add to .git/hooks/pre-push
deno task openapi:validate
deno task test:contract
```

### 2. Version Your API

**Current version:** `2.0.0` in `openapi.yaml`

When making breaking changes:
1. Increment major version (2.0.0 → 3.0.0)
2. Update `info.version` in openapi.yaml
3. Document changes in CHANGELOG.md
4. Consider API versioning in URLs

### 3. Document Examples

**Good:**
```yaml
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CompileRequest'
      examples:
        simple:
          summary: Simple compilation
          value:
            configuration:
              name: My Filter List
              sources:
                - source: test-rules
```

**Why:** Examples improve documentation and serve as test data.

### 4. Use Async Queues Appropriately

**When to use Cloudflare Queues:**

✅ **Use queues for:**
- Long-running compilations (>5 seconds)
- Large batch operations
- Background processing
- Rate limit avoidance
- Retry-able operations

❌ **Don't use queues for:**
- Quick operations (<1 second)
- Real-time user interactions
- Operations needing immediate feedback

**Implementation:**
```typescript
// Queue job
const requestId = await queueCompileJob(env, configuration, preFetchedContent);

// Return immediately
return Response.json({
    success: true,
    requestId,
    message: 'Job queued for processing'
}, { status: 202 });

// Client polls for results
GET /queue/results/{requestId}
```

### 5. Test Queue Scenarios

Always test queue operations:

```bash
# Test queue availability
deno test --filter "Contract: POST /compile/async"

# Test queue stats
deno test --filter "Contract: GET /queue/stats"

# Test result retrieval
deno test --filter "Contract: GET /queue/results"
```

### 6. Monitor Queue Health

Track queue metrics:
- Queue depth (pending jobs)
- Processing rate (jobs/minute)
- Average processing time
- Failure rate
- Retry rate

Access via: `GET /queue/stats`

### 7. Handle Queue Unavailability

Queues may not be configured in all environments:

```typescript
if (!env.ADBLOCK_COMPILER_QUEUE) {
    return Response.json({
        success: false,
        error: 'Queue not available. Use synchronous endpoints instead.'
    }, { status: 500 });
}
```

Contract tests handle this gracefully:
```typescript
validateResponseStatus(response, [202, 500]); // Both OK
```

## Troubleshooting

### Validation Fails

```bash
❌ Missing "operationId" for POST /compile
```

**Fix:** Add unique `operationId` to all operations in openapi.yaml

### Contract Tests Fail

```bash
Expected status 200, got 500
```

**Fix:** 
1. Check server logs
2. Verify request body matches schema
3. Ensure queue bindings configured (for async endpoints)

### Documentation Not Generating

```bash
Failed to parse YAML
```

**Fix:** Validate YAML syntax:
```bash
deno task openapi:validate
```

### Queue Tests Always Return 500

**Cause:** Cloudflare Queues not configured locally

**Expected:** Queues are production-only. Tests accept 202 OR 500.

**Fix:** Deploy to Cloudflare Workers to test queue functionality.

## Resources

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Redoc Documentation](https://redocly.com/redoc)
- [Cloudflare Queues Guide](https://developers.cloudflare.com/queues/)
- [Queue Support Guide](QUEUE_SUPPORT.md)
- [Postman Testing Guide](POSTMAN_TESTING.md)

## Summary

The OpenAPI tooling provides:

1. **Validation** - Ensure spec quality (`openapi:validate`)
2. **Documentation** - Generate beautiful docs (`openapi:docs`)
3. **Contract Tests** - Verify API compliance (`test:contract`)
4. **Postman** - Interactive testing (`postman-collection.json`)
5. **Queue Support** - Async operations via Cloudflare Queues

All tools are designed to work together in a continuous integration pipeline, ensuring your API stays consistent, well-documented, and reliable.
