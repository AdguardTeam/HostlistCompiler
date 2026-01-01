# Hostlist Compiler - Cloudflare Worker Example

This example demonstrates how to run the `@anthropic/hostlist-compiler` package as a Cloudflare Worker.

## Features

- **Web UI**: Interactive web interface for compiling filter lists
- **HTTP API**: Compile filter lists via REST API
- **Real-time Progress**: Server-Sent Events (SSE) for streaming compilation progress
- **Pre-fetched Content**: Support for passing source content directly (bypasses CORS)
- **Benchmarking**: Optional performance metrics
- **Download & Copy**: Export compiled rules as text files or copy to clipboard

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Installation

```bash
npm install
```

### Development

Run locally with hot reloading:

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`.

### Deployment

**Note**: Before deploying, you need to:
1. Create required KV namespaces
2. Build an npm-compatible version of the package or use a bundler

#### Step 1: Create KV Namespaces

```bash
# Create KV namespaces for production
wrangler kv:namespace create COMPILATION_CACHE
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create METRICS

# Update wrangler.toml with the returned IDs
```

Update the `id` values in `wrangler.toml` with the namespace IDs returned from the commands above.

#### Step 2: Use Deno to Bundle (Recommended)

```bash
# From the root of the repository
cd ../..
deno bundle src/index.ts examples/cloudflare-worker/bundle.js

# Then update worker.ts to import from './bundle.js'
cd examples/cloudflare-worker
npm run deploy
```

#### Option 2: Local Development Only

For local development and testing:

```bash
# Start local dev server
npm run dev

# Access at http://localhost:8787
```

#### Option 3: Direct Deploy (After Package is on npm)

Once the package is available on npm:

```bash
npm run deploy
```

## Web Interface

The worker includes a full-featured web UI accessible at the root URL (`/`).

### Features

- **Simple Mode**: Paste URLs or raw rules, select transformations, and compile
- **Advanced Mode**: Full JSON configuration with all options
- **Examples**: Pre-built templates for common use cases
- **Real-time Progress**: Live compilation progress with SSE
- **Download/Copy**: Export compiled lists or copy to clipboard

### Usage

1. Visit `http://localhost:8787` (development) or your deployed worker URL
2. Choose Simple or Advanced mode
3. Enter your filter list sources or configuration
4. Click "Compile Filter List"
5. Watch real-time progress and download results

## API Endpoints

### `GET /`

Serves the interactive web UI.

### `GET /api`

Returns API information and usage examples.

### `POST /compile`

Compiles a filter list and returns the result as JSON.

**Request Body:**

```json
{
  "configuration": {
    "name": "My Filter List",
    "sources": [
      {
        "name": "Example Source",
        "source": "https://example.com/filters.txt"
      }
    ],
    "transformations": ["Deduplicate", "RemoveEmptyLines"]
  },
  "benchmark": true
}
```

**Response:**

```json
{
  "success": true,
  "rules": ["||example.com^", "..."],
  "ruleCount": 1234,
  "metrics": {
    "totalDurationMs": 1500,
    "sourceCount": 1,
    "ruleCount": 1234
  }
}
```

### `POST /compile/stream`

Compiles a filter list with real-time progress via Server-Sent Events.

**Request Body:** Same as `/compile`

**Response:** Server-Sent Events stream

```
event: source:start
data: {"source":{"name":"Example Source","source":"https://..."},"sourceIndex":0,"totalSources":1}

event: progress
data: {"phase":"transformations","current":0,"total":2,"message":"Applying 2 transformations"}

event: transformation:start
data: {"transformation":"Deduplicate","transformationIndex":0,"totalTransformations":2}

event: result
data: {"rules":["..."],"ruleCount":1234,"metrics":{...}}

event: done
data: {}
```

## Using Pre-fetched Content

When sources have CORS restrictions, you can pre-fetch the content and pass it directly:

```json
{
  "configuration": {
    "name": "My Filter List",
    "sources": [
      {
        "name": "My Source",
        "source": "my-source-key"
      }
    ]
  },
  "preFetchedContent": {
    "my-source-key": "||ads.example.com^\n||tracking.example.com^"
  }
}
```

## Example: JavaScript Client

```javascript
// Simple JSON response
const response = await fetch('https://your-worker.workers.dev/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    configuration: {
      name: 'My List',
      sources: [{ source: 'https://example.com/filters.txt' }],
    },
  }),
});

const result = await response.json();
console.log(`Compiled ${result.ruleCount} rules`);

// Streaming with progress
const eventSource = new EventSource(
  'https://your-worker.workers.dev/compile/stream',
  { method: 'POST', body: JSON.stringify({ configuration }) }
);

eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Progress: ${data.message}`);
});

eventSource.addEventListener('result', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Done! ${data.ruleCount} rules`);
});
```

## Configuration Options

See `wrangler.toml` for available configuration options:

- **COMPILATION_CACHE (KV)**: Cache compiled filter lists (1 hour TTL)
- **RATE_LIMIT (KV)**: Track API rate limits (60 requests/minute per IP)
- **METRICS (KV)**: Store request metrics and statistics (5-minute windows)
- **R2 Bucket**: (Optional) Store filter list sources
- **Environment Variables**: Configure compiler version and behavior

### New Endpoints

#### `GET /metrics`

Returns aggregated metrics for the last 30 minutes:

```json
{
  "window": "30 minutes",
  "timestamp": "2026-01-01T08:00:00.000Z",
  "endpoints": {
    "/compile": {
      "count": 150,
      "success": 145,
      "failed": 5,
      "avgDuration": 1250,
      "errors": {
        "Network error": 3,
        "Invalid configuration": 2
      }
    },
    "/compile/stream": { ... },
    "/compile/batch": { ... }
  }
}
```

#### `POST /compile/batch`

Compile multiple filter lists in parallel (max 10 per batch):

```json
{
  "requests": [
    {
      "id": "list-1",
      "configuration": {
        "name": "First List",
        "sources": [{ "source": "https://example.com/list1.txt" }]
      }
    },
    {
      "id": "list-2",
      "configuration": {
        "name": "Second List",
        "sources": [{ "source": "https://example.com/list2.txt" }]
      }
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "id": "list-1",
      "success": true,
      "rules": [...],
      "ruleCount": 1234
    },
    {
      "id": "list-2",
      "success": true,
      "rules": [...],
      "ruleCount": 5678
    }
  ]
}
```

### Performance Features

- **Gzip Compression**: Cache values compressed (70-80% size reduction)
- **Request Deduplication**: Identical concurrent requests share results (check `X-Request-Deduplication` header)
- **Circuit Breaker**: Automatic retry with exponential backoff for failed sources (up to 3 attempts)
- **Visual Diff**: See changes between cached and new compilations
- **Metrics Tracking**: Monitor request rates, errors, and performance

## License

MIT
