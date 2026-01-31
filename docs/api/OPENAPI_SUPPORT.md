# OpenAPI Support in Adblock Compiler

## Summary

**Yes, this package fully supports OpenAPI 3.0.3!**

The Adblock Compiler includes comprehensive OpenAPI documentation and tooling for the REST API. This support was already implemented but wasn't prominently featured in the main README, so we've enhanced the documentation to make it more discoverable.

## What's Included

### 1. OpenAPI Specification (`openapi.yaml`)

A complete OpenAPI 3.0.3 specification documenting:

- ✅ **10 API endpoints** including compilation, streaming, batch processing, queues, and metrics
- ✅ **25+ schema definitions** with detailed request/response types
- ✅ **Security schemes** (Cloudflare Turnstile support)
- ✅ **Server configurations** for production and local development
- ✅ **WebSocket documentation** for real-time bidirectional communication
- ✅ **Error responses** with proper status codes and schemas
- ✅ **Request examples** for key endpoints

**Validation Status:** ✅ Valid (0 errors, 35 minor warnings about schema descriptions)

### 2. Validation Tools

```bash
# Validate the OpenAPI specification
deno task openapi:validate
```

The validation script checks:

- YAML syntax
- OpenAPI version compatibility
- Required fields completeness
- Unique operation IDs
- Response definitions
- Best practices compliance

### 3. Documentation Generation

```bash
# Generate interactive HTML documentation
deno task openapi:docs
```

Generates:

- **Interactive HTML docs** using Redoc at `docs/api/index.html`
- **Markdown reference** at `docs/api/README.md`

Features:

- 🔍 Search functionality
- 📱 Responsive design
- 🎨 Code samples
- 📊 Interactive schema browser
- 🔗 Deep linking

### 4. Contract Testing

```bash
# Run contract tests against the API
deno task test:contract
```

Tests validate that the live API conforms to the OpenAPI specification:

- Response status codes match spec
- Response content types are correct
- Required fields are present
- Data types match schemas
- Headers conform to spec

### 5. Comprehensive Documentation

- **[OpenAPI Tooling Guide](docs/OPENAPI_TOOLING.md)** - Complete guide to validation, testing, and documentation generation
- **[API Quick Reference](docs/api/QUICK_REFERENCE.md)** - Common commands and workflows
- **[Postman Testing Guide](docs/POSTMAN_TESTING.md)** - Import and test with Postman
- **[Streaming API Guide](docs/STREAMING_API.md)** - Real-time event streaming documentation
- **[Batch API Guide](docs/BATCH_API_GUIDE.md)** - Parallel compilation documentation

## API Endpoints Documented

### Compilation Endpoints

- `POST /compile` - Synchronous compilation with JSON response
- `POST /compile/stream` - Real-time streaming via Server-Sent Events (SSE)
- `POST /compile/batch` - Batch processing (up to 10 lists in parallel)

### Async Queue Operations

- `POST /compile/async` - Queue async compilation job
- `POST /compile/batch/async` - Queue batch compilation
- `GET /queue/stats` - Queue health metrics
- `GET /queue/results/{requestId}` - Retrieve job results

### WebSocket

- `GET /ws/compile` - Bidirectional real-time communication

### Metrics & Monitoring

- `GET /api` - API information and version
- `GET /metrics` - Performance metrics

## Using the OpenAPI Spec

### 1. Generate Client SDKs

Use the OpenAPI spec to generate client libraries in multiple languages:

```bash
# TypeScript/JavaScript
openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o ./client

# Python
openapi-generator-cli generate -i openapi.yaml -g python -o ./client

# Go
openapi-generator-cli generate -i openapi.yaml -g go -o ./client

# And many more languages...
```

### 2. Import into API Testing Tools

**Postman:**

```
File → Import → openapi.yaml
```

**Insomnia:**

```
Create → Import From → File → openapi.yaml
```

**Swagger UI:**
Host the `openapi.yaml` file and point Swagger UI to it.

### 3. API Client Testing

```bash
# Test against production
curl https://adblock-compiler.jayson-knight.workers.dev/api

# Get API information
curl -X POST https://adblock-compiler.jayson-knight.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d @request.json
```

### 4. CI/CD Integration

The OpenAPI validation and contract tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Validate OpenAPI spec
  run: deno task openapi:validate

- name: Generate documentation
  run: deno task openapi:docs

- name: Run contract tests
  run: deno task test:contract
```

## Quick Start

```bash
# 1. Validate the OpenAPI specification
deno task openapi:validate

# 2. Generate interactive documentation
deno task openapi:docs

# 3. View the documentation
open docs/api/index.html

# 4. Run contract tests
deno task test:contract
```

## Live Resources

- **Production API:** https://adblock-compiler.jayson-knight.workers.dev/api
- **Web UI:** https://adblock-compiler.jayson-knight.workers.dev/
- **OpenAPI Spec:** [openapi.yaml](openapi.yaml)
- **Generated Docs:** [docs/api/index.html](docs/api/index.html)

## What Changed in This PR

To make OpenAPI support more discoverable, we:

1. ✅ Added OpenAPI 3.0.3 badge to README
2. ✅ Added OpenAPI to the Features list
3. ✅ Created dedicated "OpenAPI Specification" section in README
4. ✅ Linked to existing comprehensive documentation
5. ✅ Added examples of using the OpenAPI spec with code generation tools
6. ✅ Verified validation and documentation generation works

## Conclusion

The Adblock Compiler has **excellent OpenAPI support** with:

- Complete API documentation
- Validation tooling
- Contract testing
- Documentation generation
- Integration with standard OpenAPI ecosystem tools

All the infrastructure was already in place—we've just made it more visible in the main documentation!

## Learn More

- 📚 [OpenAPI Tooling Guide](docs/OPENAPI_TOOLING.md)
- 📖 [API Quick Reference](docs/api/QUICK_REFERENCE.md)
- 🌐 [Interactive API Docs](docs/api/index.html)
- 📮 [Postman Testing Guide](docs/POSTMAN_TESTING.md)
