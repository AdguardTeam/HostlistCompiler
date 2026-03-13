# Cloudflare Workers Architecture

This document describes the two Cloudflare Workers deployments that make up the Adblock Compiler service, the differences between them, and how they relate to each other.

---

## Overview

The Adblock Compiler is deployed as **two separate Cloudflare Workers** from a single GitHub repository. Each has a distinct role:

| | `adblock-compiler-backend` | `adblock-compiler-frontend` |
|---|---|---|
| **Wrangler config** | [`wrangler.toml`](../../wrangler.toml) | [`frontend/wrangler.toml`](../../frontend/wrangler.toml) |
| **Entry point** | `worker/worker.ts` | `dist/adblock-compiler/server/server.mjs` |
| **Role** | REST API + compilation engine | Angular 21 SSR UI |
| **Source path** | `worker/` + `src/` | `frontend/` |
| **Deploy command** | `wrangler deploy` (repo root) | `npm run deploy` (from `frontend/`) |
| **Local dev port** | `8787` | `8787` (via `npm run preview`) |

---

## `adblock-compiler-backend` — The API Worker

### What It Does

The backend worker is the **compilation engine**. It:

- Exposes a REST API (`POST /compile`, `POST /compile/stream`, `POST /compile/batch`, `GET /metrics`, etc.)
- Runs adblock/hostlist filter list compilation using the core `src/` TypeScript logic (forked from [AdguardTeam/HostlistCompiler](https://github.com/AdguardTeam/HostlistCompiler))
- Handles async queue-based compilation via Cloudflare Queues
- Manages caching, rate limiting, and metrics via KV namespaces
- Stores compiled outputs in R2 and persists state in D1 + Durable Objects
- Runs scheduled background jobs (cache warming, health monitoring) via Cloudflare Workflows + Cron Triggers
- Also serves the compiled Angular frontend as static assets via its `[assets]` binding (bundled deployment mode)

### Source

```
adblock-compiler/
├── worker/
│   └── worker.ts          ← entry point
├── src/                   ← core compiler logic (forked from AdGuard HostlistCompiler)
└── wrangler.toml          ← deployment configuration (name = "adblock-compiler-backend")
```

### Key Bindings

| Binding | Type | Purpose |
|---|---|---|
| `COMPILATION_CACHE` | KV | Cache compiled filter lists |
| `RATE_LIMIT` | KV | Per-IP rate limiting |
| `METRICS` | KV | Metrics counters |
| `FILTER_STORAGE` | R2 | Store compiled filter list outputs |
| `DB` | D1 | SQLite edge database |
| `ADBLOCK_COMPILER` | Durable Object | Stateful compilation sessions |
| `HYPERDRIVE` | Hyperdrive | Accelerated PostgreSQL access |
| `ANALYTICS_ENGINE` | Analytics Engine | High-cardinality telemetry |
| `ASSETS` | Static Assets | Serves compiled Angular frontend (bundled mode) |

---

## `adblock-compiler-frontend` — The UI Worker

### What It Does

The frontend worker is the **Angular 21 SSR application**. It:

- Server-side renders the Angular application at the Cloudflare edge using `AngularAppEngine`
- Serves the home page as a prerendered static page (SSG); all other routes are SSR per-request
- Serves JS/CSS/font bundles directly from Cloudflare's CDN via the `ASSETS` binding (the Worker never handles these requests)
- Calls the `adblock-compiler-backend` worker's REST API for all compilation operations

### Source

```
adblock-compiler/
└── frontend/
    ├── src/               ← Angular 21 application source
    ├── server.ts          ← Cloudflare Workers fetch handler (AngularAppEngine)
    └── wrangler.toml      ← deployment configuration (name = "adblock-compiler-frontend")
```

### Key Bindings

| Binding | Type | Purpose |
|---|---|---|
| `ASSETS` | Static Assets | JS bundles, CSS, fonts — served from CDN before the Worker is invoked |

### SSR Architecture

The `server.ts` fetch handler uses Angular 21's `AngularAppEngine` with the standard [WinterCG](https://wintercg.org/) fetch API — no Express, no Node.js HTTP server:

```typescript
const angularApp = new AngularAppEngine();

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const response = await angularApp.handle(request);
        return response ?? new Response('Not found', { status: 404 });
    },
} satisfies ExportedHandler<Env>;
```

This means:
- **Edge-compatible** — runs in any WinterCG-compliant runtime (Cloudflare Workers, Deno Deploy, Fastly Compute)
- **Fast cold starts** — no Express middleware chain, no Node.js HTTP server initialisation
- **Zero-overhead static assets** — JS/CSS/fonts are served by Cloudflare CDN before the Worker is ever invoked

---

## Relationship Between the Two Workers

```mermaid
flowchart TD
    BROWSER["Browser Request"] --> EDGE

    subgraph EDGE["Cloudflare Edge Network"]
        direction TB
        FRONTEND["adblock-compiler-frontend\n(Angular 21 SSR Worker)\n\n• Prerendered home page (SSG)\n• SSR for /compiler, /performance, /admin, /api-docs, /validation\n• Static assets served from CDN via ASSETS binding"]
        FRONTEND -->|API calls| BACKEND
        BACKEND["adblock-compiler-backend\n(TypeScript REST API Worker)\n\n• POST /compile\n• POST /compile/stream (SSE)\n• POST /compile/batch\n• GET /metrics  •  GET /health\n• KV, R2, D1, Durable Objects, Queues, Workflows, Hyperdrive"]
    end
```

### Two Deployment Modes

The backend worker supports **two ways** the frontend can be served:

#### 1. Bundled Mode (single worker)
The root `wrangler.toml` includes an `[assets]` block pointing to the Angular build output:

```toml
[assets]
directory = "./frontend/dist/adblock-compiler/browser"
binding = "ASSETS"
```

This means a single `wrangler deploy` from the repo root deploys **both** the API and the Angular frontend as one unit. The Worker serves API requests; static assets are served by Cloudflare CDN via the binding.

#### 2. Independent SSR Mode (two separate workers)
`frontend/wrangler.toml` deploys the Angular application as its **own Worker** with full SSR (`AngularAppEngine`). This is the `adblock-compiler-frontend` worker. It runs server-side rendering at the edge and calls the backend API for data.

| | Bundled Mode | Independent SSR Mode |
|---|---|---|
| **Workers deployed** | 1 (`adblock-compiler-backend`) | 2 (backend + frontend) |
| **Frontend serving** | Static assets via CDN binding | `AngularAppEngine` SSR + CDN for assets |
| **SSR support** | No (SPA only) | Yes (prerender + server rendering) |
| **Deploy command** | `wrangler deploy` (root) | `wrangler deploy` (root) + `npm run deploy` (frontend/) |
| **Use case** | Simpler deployment, CSR only | Full SSR, edge rendering, independent scaling |

---

## Deployment

### Backend

```bash
# From repo root
wrangler deploy
```

### Frontend (Independent SSR mode)

```bash
cd frontend
npm run build    # ng build — compiles Angular + server.mjs
npm run deploy   # wrangler deploy
```

### Local Development

```bash
# Backend API
wrangler dev                        # → http://localhost:8787

# Frontend (Angular dev server, CSR)
cd frontend && npm start            # → http://localhost:4200

# Frontend (Cloudflare Workers preview, mirrors production SSR)
cd frontend && npm run preview      # → http://localhost:8787
```

---

## Renaming Note

> **These workers were renamed as of 2026-03-07.**
>
> | Old name | New name |
> |---|---|
> | `adblock-compiler` | `adblock-compiler-backend` |
> | `adblock-compiler-angular-poc` | `adblock-compiler-frontend` |
> |
> If you have existing workers under the old names in your Cloudflare dashboard, they will continue to run until manually deleted. The next `wrangler deploy` will create new workers under the updated names.

---

## Further Reading

- [`worker/README.md`](../../worker/README.md) — Worker API endpoints and implementation details
- [`frontend/README.md`](../../frontend/README.md) — Angular frontend architecture and Angular 21 features
- [`docs/deployment/cloudflare-pages.md`](cloudflare-pages.md) — Cloudflare Pages deployment
- [`docs/cloudflare/README.md`](../cloudflare/README.md) — Cloudflare-specific features index
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
