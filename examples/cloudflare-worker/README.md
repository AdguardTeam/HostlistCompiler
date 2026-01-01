# Hostlist Compiler - Cloudflare Worker Example

This example demonstrates how to run the `@anthropic/hostlist-compiler` package as a Cloudflare Worker.

## Features

- **HTTP API**: Compile filter lists via REST API
- **Real-time Progress**: Server-Sent Events (SSE) for streaming compilation progress
- **Pre-fetched Content**: Support for passing source content directly (bypasses CORS)
- **Benchmarking**: Optional performance metrics

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

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## API Endpoints

### `GET /`

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

- **KV Namespace**: Cache compiled filter lists
- **R2 Bucket**: Store filter list sources
- **Environment Variables**: Configure compiler behavior

## License

MIT
