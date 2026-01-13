# Cloudflare Worker Example (Legacy Reference)

> **Note**: The production Cloudflare Worker implementation has been moved to the repository root.
> This directory remains as a legacy reference and example.

## Current Location

- **Worker Code**: `/worker/worker.ts`
- **Web UI**: `/public/index.html`
- **Configuration**: `/wrangler.toml`

## Quick Start

From the **repository root**:

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

Access the web UI at http://localhost:8787

## Documentation

- [Main README](../../README.md) - Full project documentation
- [API Documentation](../../docs/api/README.md) - REST API reference
- [Docker Deployment](../../docs/deployment/docker.md) - Container deployment guide
- [Queue Support](../../docs/QUEUE_SUPPORT.md) - Async compilation via queues
- [Tail Worker](../../worker/TAIL_WORKER.md) - Observability and logging

## Features

The production worker includes:

- **Interactive Web UI** at `/`
- **JSON API** at `POST /compile`
- **Streaming API** at `POST /compile/stream` with Server-Sent Events
- **Batch API** at `POST /compile/batch` (up to 10 lists)
- **Async API** at `POST /compile/async` for queue-based processing
- **Metrics** at `GET /metrics`
- Caching with KV storage and gzip compression
- Rate limiting and request deduplication
- Visual diff showing changes between compilations
- Cloudflare Queue integration for async compilation

## License

GPL-3.0
