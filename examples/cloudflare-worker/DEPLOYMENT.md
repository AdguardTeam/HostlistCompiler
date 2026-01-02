# Cloudflare Worker Deployment Guide

## Deployed Instance

Your Hostlist Compiler is now live at:
**https://hostlist-compiler-worker.jayson-knight.workers.dev**

### Deployment Details
- **Worker Name**: `hostlist-compiler-worker`
- **Account**: JK.com
- **Version**: 0.6.0
- **Status**: ✅ Active

## API Endpoints

### 1. GET /
Returns API information and usage examples.

```bash
curl https://hostlist-compiler-worker.jayson-knight.workers.dev/
```

### 2. POST /compile
Compiles a filter list and returns the complete result as JSON.

**Example Request:**
```bash
curl -X POST https://hostlist-compiler-worker.jayson-knight.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "Test Filter",
      "sources": [{
        "name": "Sample Rules",
        "source": "test-rules",
        "type": "adblock"
      }],
      "transformations": ["Deduplicate", "RemoveEmptyLines"]
    },
    "preFetchedContent": {
      "test-rules": "||ads.example.com^\n||tracking.example.com^"
    },
    "benchmark": true
  }'
```

**Response:**
```json
{
  "success": true,
  "rules": ["||ads.example.com^", "||tracking.example.com^"],
  "ruleCount": 2,
  "metrics": {
    "totalDurationMs": 5,
    "sourceCount": 1,
    "ruleCount": 2
  }
}
```

### 3. POST /compile/stream
Compiles with real-time progress via Server-Sent Events (SSE).

**Example:**
See `test.html` for a complete browser-based example.

## Testing

### Command Line
Use the provided test files:

```bash
# Test with pre-fetched content
curl -X POST https://hostlist-compiler-worker.jayson-knight.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Test with remote URL
curl -X POST https://hostlist-compiler-worker.jayson-knight.workers.dev/compile \
  -H "Content-Type: application/json" \
  -d @test-remote.json
```

### Browser
Open `test.html` in your browser to test both JSON and streaming endpoints with a visual interface.

## Performance

The worker successfully compiled **125,273 rules** from the AdGuard DNS Filter in **23ms**, demonstrating excellent performance on Cloudflare's edge network.

## Redeployment

To update the worker after making changes:

```bash
# 1. Make your changes to worker-bundle.ts
# 2. Deploy
npx wrangler deploy

# View logs
npx wrangler tail
```

## Configuration

Edit `wrangler.toml` to modify:
- Worker name
- Environment variables
- KV namespaces (for caching)
- R2 buckets (for storage)

## Monitoring

View real-time logs:
```bash
npx wrangler tail
```

View deployment history:
```bash
npx wrangler deployments list
```

## Features

✅ **HTTP API** - RESTful JSON endpoints  
✅ **Streaming Progress** - Real-time SSE updates  
✅ **Pre-fetched Content** - Bypass CORS restrictions  
✅ **Remote Fetching** - Direct URL fetching  
✅ **Benchmarking** - Performance metrics  
✅ **CORS Enabled** - Works from any origin  

## Limits

Cloudflare Workers have the following limits on the free tier:
- **CPU Time**: 10ms per request (can be extended to 50ms on paid plans)
- **Memory**: 128MB
- **Request Size**: 100MB
- **Response Size**: Unlimited (streaming)

For large filter lists, consider using the streaming endpoint to avoid timeouts.

## Local Development

Test locally before deploying:

```bash
npx wrangler dev
```

This starts a local server at `http://localhost:8787`.

## Troubleshooting

### Build Errors
If you encounter module resolution errors, ensure `worker-bundle.ts` imports from `../../src/index.ts`.

### Authentication Issues
Re-authenticate with:
```bash
npx wrangler login
```

### Deployment Fails
Check your Cloudflare account limits and verify you have Workers enabled.

## Next Steps

Consider adding:
- **KV Storage** - Cache compiled lists
- **R2 Storage** - Store filter sources
- **Analytics** - Track usage patterns
- **Rate Limiting** - Prevent abuse
- **Custom Domains** - Use your own domain

## License

MIT
