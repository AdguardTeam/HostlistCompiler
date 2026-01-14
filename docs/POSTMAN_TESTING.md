# Postman API Testing Guide

This guide explains how to use the Postman collection to test the Adblock Compiler OpenAPI endpoints.

## Quick Start

### 1. Import the Collection

1. Open Postman
2. Click **Import** in the top left
3. Select **File** and choose `docs/tools/postman-collection.json`
4. The collection will appear in your workspace

### 2. Import the Environment

1. Click **Import** again
2. Select **File** and choose `docs/tools/postman-environment.json`
3. Select the "Adblock Compiler - Local" environment from the dropdown in the top right

### 3. Start the Server

```bash
# Start local development server
deno task dev

# Or using Docker
docker compose up -d
```

The server will be available at `http://localhost:8787`

### 4. Run Tests

You can run tests individually or as a collection:

- **Individual Request**: Click any request and press **Send**
- **Folder**: Right-click a folder and select **Run folder**
- **Entire Collection**: Click the **Run** button next to the collection name

## Collection Structure

The collection is organized into the following folders:

### 📊 Metrics
- **Get API Info** - Retrieves API version and available endpoints
- **Get Performance Metrics** - Fetches aggregated performance data

### ⚙️ Compilation
- **Compile Simple Filter List** - Basic compilation with pre-fetched content
- **Compile with Transformations** - Tests multiple transformations (RemoveComments, Validate, Deduplicate)
- **Compile with Cache Check** - Verifies caching behavior (X-Cache header)
- **Compile Invalid Configuration** - Error handling test

### 📡 Streaming
- **Compile with SSE Stream** - Server-Sent Events streaming test

### 📦 Batch Processing
- **Batch Compile Multiple Lists** - Compile 2 lists in parallel
- **Batch Compile - Max Limit Test** - Test the 10-item batch limit

### 🔄 Queue
- **Queue Async Compilation** - Queue a job for async processing
- **Queue Batch Async Compilation** - Queue multiple jobs
- **Get Queue Stats** - Retrieve queue metrics
- **Get Queue Results** - Fetch results using requestId

### 🔍 Edge Cases
- **Empty Configuration** - Test with empty request body
- **Missing Required Fields** - Test validation
- **Large Batch Request (>10)** - Test batch size limit enforcement

## Test Assertions

Each request includes automated tests that verify:

### Response Validation
```javascript
pm.test('Status code is 200', function () {
    pm.response.to.have.status(200);
});
```

### Schema Validation
```javascript
pm.test('Response is successful', function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
    pm.expect(jsonData).to.have.property('rules');
});
```

### Business Logic
```javascript
pm.test('Rules are deduplicated', function () {
    const jsonData = pm.response.json();
    const uniqueRules = new Set(jsonData.rules.filter(r => !r.startsWith('!')));
    pm.expect(uniqueRules.size).to.equal(jsonData.rules.filter(r => !r.startsWith('!')).length);
});
```

### Header Validation
```javascript
pm.test('Check cache headers', function () {
    pm.expect(pm.response.headers.get('X-Cache')).to.be.oneOf(['HIT', 'MISS']);
});
```

## Variables

The collection uses the following variables:

- **`baseUrl`** - Local development server URL (default: `http://localhost:8787`)
- **`prodUrl`** - Production server URL
- **`requestId`** - Auto-populated from async compilation responses

### Switching Between Environments

To test against production:

1. Change the `baseUrl` variable to `{{prodUrl}}`
2. Or create a new environment for production

## Running Collection with Newman (CLI)

You can run the collection from the command line using Newman:

```bash
# Install Newman
npm install -g newman

# Run the collection against local server
newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json

# Run with detailed output
newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json --reporters cli,json

# Run specific folder
newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json --folder "Compilation"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start server
        run: docker compose up -d
      
      - name: Wait for server
        run: sleep 5
      
      - name: Install Newman
        run: npm install -g newman
      
      - name: Run Postman tests
        run: newman run docs/tools/postman-collection.json -e docs/tools/postman-environment.json
      
      - name: Stop server
        run: docker compose down
```

## Advanced Testing

### Pre-request Scripts

You can add pre-request scripts to generate dynamic data:

```javascript
// Generate random filter rules
const rules = Array.from({length: 10}, (_, i) => `||example${i}.com^`);
pm.collectionVariables.set('dynamicRules', rules.join('\\n'));
```

### Test Sequences

Run requests in sequence to test workflows:

1. Queue Async Compilation → captures `requestId`
2. Get Queue Stats → verify job is pending
3. Get Queue Results → retrieve compiled results

### Performance Testing

Use the Collection Runner with multiple iterations:

1. Click **Run** on the collection
2. Set **Iterations** to desired number (e.g., 100)
3. Set **Delay** between requests (e.g., 100ms)
4. View performance metrics in the run summary

## Troubleshooting

### Server Not Responding

```bash
# Check if server is running
curl http://localhost:8787/api

# Check Docker logs
docker compose logs -f

# Restart server
docker compose restart
```

### Queue Tests Failing

Queue tests may return 500 if Cloudflare Queues aren't configured:

```json
{
  "success": false,
  "error": "Queue bindings are not available..."
}
```

This is expected for local development without queue configuration.

### Rate Limiting

If you hit rate limits (429 responses), wait for the rate limit window to reset or adjust `RATE_LIMIT_MAX_REQUESTS` in the server configuration.

## Best Practices

1. **Run tests before commits** - Ensure API compatibility
2. **Test against local first** - Avoid production impact
3. **Use environments** - Separate dev/staging/prod configurations
4. **Review test results** - Don't ignore failed assertions
5. **Update tests** - Keep tests in sync with OpenAPI spec changes

## Related Documentation

- [OpenAPI Specification](../openapi.yaml)
- [API Documentation](api/README.md)
- [Queue Support](QUEUE_SUPPORT.md)
- [WebSocket Documentation](../worker/websocket.ts)

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review the [OpenAPI spec](../openapi.yaml)
- Open an issue on GitHub
