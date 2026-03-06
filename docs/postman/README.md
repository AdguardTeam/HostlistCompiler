# Postman Collection

Postman collection and environment files for testing the Adblock Compiler API.

## Files

- `postman-collection.json` - Postman collection with all API endpoints and tests
- `postman-environment.json` - Postman environment with local and production variables

## Quick Start

1. Open Postman and click **Import**
2. Import `postman-collection.json` to add all API requests
3. Import `postman-environment.json` to configure environments
4. Select the **Adblock Compiler - Local** environment
5. Start the server: `deno task dev`
6. Run requests individually or as a collection

## Related

- [Postman Testing Guide](../testing/POSTMAN_TESTING.md) - Complete guide with Newman CLI, CI/CD integration, and advanced testing
- [API Documentation](../api/README.md) - REST API reference
- [OpenAPI Tooling](../api/OPENAPI_TOOLING.md) - API specification validation
