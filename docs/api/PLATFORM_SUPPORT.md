# Platform Support

← [Back to README](../../README.md)

The adblock-compiler includes a **platform abstraction layer** that enables running in any JavaScript runtime, including:

- **Deno** (default)
- **Node.js** (via npm compatibility)
- **Cloudflare Workers**
- **Deno Deploy**
- **Vercel Edge Functions**
- **AWS Lambda@Edge**
- **Web Workers** (browser)
- **Browsers** (with server-side proxy for CORS)

The platform layer is designed to be **pluggable** - you can easily add or remove fetchers without modifying the core compiler.

## Core Concepts

The platform layer provides:

- **`WorkerCompiler`** - A platform-agnostic compiler that works without file system access
- **`PreFetchedContentFetcher`** - Supply source content directly instead of fetching from URLs
- **`HttpFetcher`** - Standard Fetch API-based content fetching (works everywhere)
- **`CompositeFetcher`** - Chain multiple fetchers together (pre-fetched takes priority)
- **`PlatformDownloader`** - Handles `!#include` directives and conditional compilation

## Edge Runtimes (Generic)

The `WorkerCompiler` works in any edge runtime or serverless environment that supports the standard Fetch API. The pattern is the same across all platforms:

1. **Pre-fetch source content** on the server (avoids CORS and network restrictions)
2. **Pass content to the compiler** via `preFetchedContent`
3. **Configure and compile** using the standard API

```typescript
import { CompositeFetcher, HttpFetcher, type IConfiguration, PreFetchedContentFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

// Option 1: Use pre-fetched content (recommended for edge)
async function compileWithPreFetched(sourceUrls: string[]): Promise<string[]> {
    // Fetch all sources
    const preFetched = new Map<string, string>();
    for (const url of sourceUrls) {
        const response = await fetch(url);
        preFetched.set(url, await response.text());
    }

    const compiler = new WorkerCompiler({ preFetchedContent: preFetched });
    const config: IConfiguration = {
        name: 'My Filter List',
        sources: sourceUrls.map((url) => ({ source: url })),
        transformations: ['Deduplicate', 'RemoveEmptyLines'],
    };

    return compiler.compile(config);
}

// Option 2: Build a custom fetcher chain
function createCustomCompiler() {
    const preFetched = new PreFetchedContentFetcher(
        new Map([
            ['local://rules', 'my-custom-rule'],
        ]),
    );
    const http = new HttpFetcher();
    const composite = new CompositeFetcher([preFetched, http]);

    return new WorkerCompiler({ customFetcher: composite });
}
```

## Cloudflare Workers

The compiler runs natively in Cloudflare Workers. A production-ready implementation is available at the repository root in the `worker/` directory with a comprehensive web UI in `public/`.

**Quick Start**:

```bash
# Install dependencies
npm install

# Run locally
deno task wrangler:dev

# Deploy to Cloudflare
deno task wrangler:deploy
```

**Deployment**: A `wrangler.toml` configuration file is provided in the repository root for easy deployment via Cloudflare's Git integration or using `wrangler deploy`.

⚠️ **Important**: This project uses `wrangler deploy` for Cloudflare Workers, **NOT** `deno deploy`. While this is a Deno-based project, it deploys to Cloudflare Workers runtime. See the [Cloudflare Pages Deployment Guide](../deployment/cloudflare-pages.md) for Pages-specific configuration.

The production worker (`worker/worker.ts`) includes:

- **Interactive Web UI** at `/` (see `public/index.html`)
- **API Testing Interface** at `/test.html`
- **JSON API** at `POST /compile`
- **Streaming API** at `POST /compile/stream` with Server-Sent Events
- **Batch API** at `POST /compile/batch`
- **Async API** at `POST /compile/async` for queue-based processing
- **Batch Async API** at `POST /compile/batch/async` for queue-based batch processing
- **Metrics** at `GET /metrics`
- Pre-fetched content support to bypass CORS restrictions
- Caching with KV storage
- Rate limiting
- Request body size limits (DoS protection)
- Request deduplication
- Cloudflare Queue integration for async compilation

**Request Body Size Limits**:

The worker validates request body sizes to prevent denial-of-service attacks via large payloads. The default limit is 1MB.

```bash
# Configure in environment (megabytes)
MAX_REQUEST_BODY_MB="2"  # Set to 2MB limit
```

Requests exceeding the limit receive a `413 Payload Too Large` response:

```json
{
    "error": "Request body size (2097152 bytes) exceeds maximum allowed size (1048576 bytes)"
}
```

**Cloudflare Queue Support**:

The worker supports asynchronous compilation through Cloudflare Queues, allowing you to:

- Offload long-running compilations to background processing
- Process batch operations without blocking
- Pre-warm the cache with popular filter lists
- Bypass rate limits for queued requests

📚 **[Queue Support Documentation](../cloudflare/QUEUE_SUPPORT.md)** - Complete guide for using async compilation

**Tail Worker for Observability**:

A Cloudflare Tail Worker is included for advanced logging and monitoring. The tail worker captures logs, exceptions, and events from the main worker in real-time.

```bash
# Deploy the tail worker
deno task wrangler:tail:deploy

# View tail worker logs
deno task wrangler:tail:logs
```

Features:

- **Log Persistence**: Store logs in Cloudflare KV
- **Error Forwarding**: Send critical errors to webhooks (Slack, Discord, etc.)
- **Structured Events**: Format logs for external systems
- **Automatic Cleanup**: Configurable log retention

📚 **[Tail Worker Documentation](../../worker/TAIL_WORKER.md)** - Complete guide for setup and configuration

```typescript
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

export default {
    async fetch(request: Request): Promise<Response> {
        // Pre-fetch content on the server where there are no CORS restrictions
        const sourceContent = await fetch('https://example.com/filters.txt').then((r) => r.text());

        const compiler = new WorkerCompiler({
            preFetchedContent: {
                'https://example.com/filters.txt': sourceContent,
            },
        });

        const configuration: IConfiguration = {
            name: 'My Filter List',
            sources: [
                { source: 'https://example.com/filters.txt' },
            ],
            transformations: ['Deduplicate', 'RemoveEmptyLines'],
        };

        const result = await compiler.compile(configuration);

        return new Response(result.join('\n'), {
            headers: { 'Content-Type': 'text/plain' },
        });
    },
};
```

**Using the Web UI**:

1. Visit the root URL of your deployed worker
2. Use **Simple Mode** for quick filter list compilation
3. Use **Advanced Mode** for JSON configuration
4. Use **Test Page** to test API endpoints directly
5. View real-time progress with streaming compilation

## Web Workers

Use `WorkerCompiler` in Web Workers for background compilation:

```typescript
// worker.ts
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

self.onmessage = async (event) => {
    const { configuration, preFetchedContent } = event.data;

    const compiler = new WorkerCompiler({
        preFetchedContent,
        events: {
            onProgress: (progress) => {
                self.postMessage({ type: 'progress', progress });
            },
        },
    });

    const result = await compiler.compile(configuration);
    self.postMessage({ type: 'complete', rules: result });
};
```

## Browser Usage

For browser environments, pre-fetch all source content server-side to avoid CORS issues:

```typescript
import { type IConfiguration, WorkerCompiler } from '@jk-com/adblock-compiler';

// Fetch sources through your server proxy to avoid CORS
async function fetchSources(urls: string[]): Promise<Map<string, string>> {
    const content = new Map<string, string>();
    for (const url of urls) {
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        content.set(url, await response.text());
    }
    return content;
}

// Usage
const sources = await fetchSources([
    'https://example.com/filters.txt',
]);

const compiler = new WorkerCompiler({
    preFetchedContent: Object.fromEntries(sources),
});

const configuration: IConfiguration = {
    name: 'Browser Compiled List',
    sources: [
        { source: 'https://example.com/filters.txt' },
    ],
};

const rules = await compiler.compile(configuration);
```

## Platform API Reference

### WorkerCompiler

```typescript
interface WorkerCompilerOptions {
    // Pre-fetched content (Map or Record)
    preFetchedContent?: Map<string, string> | Record<string, string>;

    // Custom content fetcher (for advanced use cases)
    customFetcher?: IContentFetcher;

    // Options for the default HTTP fetcher (timeout, user agent, custom headers)
    httpOptions?: IHttpFetcherOptions;

    // Tracing context for diagnostics and OpenTelemetry integration
    tracingContext?: TracingContext;

    // Injectable dependencies (for testing/customization)
    dependencies?: WorkerCompilerDependencies;
}

class WorkerCompiler {
    constructor(options?: WorkerCompilerOptions);

    // Compile and return rules
    compile(configuration: IConfiguration): Promise<string[]>;

    // Compile with optional benchmarking metrics
    compileWithMetrics(
        configuration: IConfiguration,
        benchmark?: boolean,
    ): Promise<WorkerCompilationResult>;
}
```

### IContentFetcher

Implement this interface to create custom content fetchers:

```typescript
interface IContentFetcher {
    canHandle(source: string): boolean;
    fetch(source: string): Promise<string>;
}
```

## Custom Fetchers

You can implement custom fetchers for specialized use cases:

```typescript
import { CompositeFetcher, HttpFetcher, type IContentFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

// Example: Redis-backed cache fetcher
class RedisCacheFetcher implements IContentFetcher {
    constructor(private redis: RedisClient, private ttl: number) {}

    canHandle(source: string): boolean {
        return source.startsWith('http://') || source.startsWith('https://');
    }

    async fetch(source: string): Promise<string> {
        const cached = await this.redis.get(`filter:${source}`);
        if (cached) return cached;

        const response = await fetch(source);
        const content = await response.text();

        await this.redis.setex(`filter:${source}`, this.ttl, content);
        return content;
    }
}

// Example: S3/R2-backed storage fetcher
class S3StorageFetcher implements IContentFetcher {
    constructor(private bucket: S3Bucket) {}

    canHandle(source: string): boolean {
        return source.startsWith('s3://');
    }

    async fetch(source: string): Promise<string> {
        const key = source.replace('s3://', '');
        const object = await this.bucket.get(key);
        return object?.text() ?? '';
    }
}

// Chain fetchers together - first match wins
const compiler = new WorkerCompiler({
    customFetcher: new CompositeFetcher([
        new RedisCacheFetcher(redis, 3600),
        new S3StorageFetcher(bucket),
        new HttpFetcher(),
    ]),
});
```

This pluggable architecture allows you to:

- Add caching layers (Redis, KV, memory)
- Support custom protocols (S3, R2, database)
- Implement authentication/authorization
- Add logging and metrics
- Mock sources for testing
