# Postman Collection

Postman collection and environment files for testing the Adblock Compiler API.

> **Auto-generated** — do not edit these files directly.
> Run `deno task postman:collection` to regenerate from `docs/api/openapi.yaml`.

## Files

- `postman-collection.json` - Postman collection with all API endpoints and tests (auto-generated)
- `postman-environment.json` - Postman environment with local and production variables (auto-generated)

## Regenerating

Both files are generated automatically from the canonical OpenAPI spec:

```bash
deno task postman:collection
```

The CI pipeline (`validate-postman-collection` job) enforces that these files stay in sync with `docs/api/openapi.yaml`. If you modify the spec, run the task above and commit the updated files — CI will fail otherwise.

## Schema hierarchy

```
docs/api/openapi.yaml                 ← canonical source of truth (edit this)
docs/api/cloudflare-schema.yaml       ← auto-generated (deno task schema:cloudflare)
docs/postman/postman-collection.json  ← auto-generated (deno task postman:collection)
docs/postman/postman-environment.json ← auto-generated (deno task postman:collection)
```

## Quick Start

1. Open Postman and click **Import**
2. Import `postman-collection.json` to add all API requests
3. Import `postman-environment.json` to configure environments
4. Select the **Adblock Compiler API - Local** environment
5. Start the server: `deno task dev`
6. Run requests individually or as a collection

## Related

- [Postman Testing Guide](../testing/POSTMAN_TESTING.md) - Complete guide with Newman CLI, CI/CD integration, and advanced testing
- [API Documentation](../api/README.md) - REST API reference
- [OpenAPI Tooling](../api/OPENAPI_TOOLING.md) - API specification validation
