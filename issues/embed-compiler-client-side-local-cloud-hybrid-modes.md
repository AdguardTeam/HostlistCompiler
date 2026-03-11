# Compiler Execution Modes: Client-side Embedding, Cloud API, and Hybrid

## Overview

The adblock-compiler is architected in a way that makes it uniquely well-suited to support **three distinct compilation execution modes** — local/in-browser, cloud (existing Worker API), and hybrid. This issue tracks the design and implementation of all three modes, tied to the upcoming Clerk auth/tier system.

The `compiler.component.ts` already has a **Compilation Mode Selector** UI — this issue is about wiring up the backend execution modes behind it.

---

## Background & Motivation

Currently, all compilation runs server-side via the Cloudflare Worker API. However:

- `WorkerCompiler` in `src/platform/WorkerCompiler.ts` is already **file-system-free and edge/browser-native** — it was designed to run anywhere Web Platform APIs are available, including in a browser Web Worker
- `PreFetchedContentFetcher` allows compilation against pre-fetched content, decoupling download from compilation
- The Angular frontend already has a mode selector UI component

This positions the project to offer a compelling differentiator: **offline/local compilation** — something most online filter list tools don't support — while keeping cloud compilation as the primary path for registered users.

---

## The Three Modes

### Mode 1: Local (In-Browser)
Bundle `WorkerCompiler` as an Angular Web Worker. The browser performs the full transformation pipeline locally. The Cloudflare Worker acts only as a **CORS fetch proxy** for downloading source URLs.

**Best for:** Anonymous users, privacy-conscious users, offline use, small-to-medium lists.

### Mode 2: Cloud (Existing — Extend with Clerk)
Full server-side compilation via `worker/worker.ts`. SSE streaming, queue-based async jobs, result storage in R2. Auth via Clerk JWT or API key.

**Best for:** Registered users, large lists, batch jobs, saved results, programmatic access.

### Mode 3: Hybrid (Pro)
The Worker fetches source URLs (CORS proxy + cache), returns raw content to the browser. The browser runs the transformation pipeline locally via `WorkerCompiler`. The Worker then handles persistence (R2 storage, D1 history, diff generation).

**Best for:** Pro users with large lists who want fast local processing + cloud persistence.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Compilation Mode Selector                      │
│              (already exists in compiler.component.ts)           │
└──────────────────┬──────────────────┬───────────────────────────┘
                   │                  │                  │
                   ▼                  ▼                  ▼
        ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐
        │  Local / Client  │  │  Cloud (API)  │  │  Hybrid          │
        │  Web Worker +    │  │  Cloudflare   │  │  local transform │
        │  CORS proxy      │  │  Worker API   │  │  cloud persist   │
        └──────────────────┘  └───────────────┘  └──────────────────┘
           Anonymous free       Clerk JWT or         Pro tier
           no server CPU         API key auth
```

### CORS Proxy Requirement
The browser cannot directly fetch arbitrary cross-origin filter list URLs. The Worker must expose a `/proxy/fetch` endpoint that:
- Fetches the target URL server-side
- Returns raw content to the browser
- Is rate-limited (Turnstile for anonymous, Clerk JWT for auth'd)
- Optionally caches results in KV to reduce redundant fetches

---

## Tier Mapping (ties into Clerk auth issue)

| Mode | Who | Auth |
|---|---|---|
| `cloud` anonymous | Anyone | Turnstile only |
| `cloud` saved | Free registered | Clerk JWT |
| `local` | Anyone | None (runs in browser) |
| `hybrid` | Pro users | Clerk JWT + `pro` claim |
| Batch / async | Pro users | Clerk JWT + `pro` claim |

---

## Implementation Tasks

### Phase 1 — CORS Proxy Endpoint (unblocks local mode)
- [ ] Add `GET /proxy/fetch?url=<encoded>` endpoint to `worker/worker.ts`
  - Validate and allowlist URL schemes (https only, no private IPs)
  - Rate-limit anonymous requests via Turnstile verification header or KV IP rate limiter
  - Rate-limit authenticated requests by Clerk user tier (KV counter keyed by `clerk_user_id`)
  - Cache fetched content in KV with a short TTL (e.g., 5 minutes) to deduplicate browser requests
  - Return raw text content with appropriate headers
- [ ] Add URL validation utility to prevent SSRF (block `localhost`, RFC 1918 ranges, metadata endpoints)
- [ ] Document the endpoint in `docs/api/README.md`

### Phase 2 — Local Mode (Angular Web Worker)
- [ ] Create `frontend/src/workers/compiler.worker.ts`:
  ```typescript
  import { WorkerCompiler, PreFetchedContentFetcher } from '@jk-com/adblock-compiler';

  self.onmessage = async (e) => {
    const { config, prefetchedContent } = e.data;
    const fetcher = new PreFetchedContentFetcher(prefetchedContent);
    const compiler = new WorkerCompiler({ fetcher });
    const result = await compiler.compile(config);
    self.postMessage({ type: 'result', result });
  };
  ```
- [ ] Create `frontend/src/app/compiler/services/local-compiler.service.ts`:
  - Manages the Web Worker lifecycle
  - Proxies source URL fetches through `/proxy/fetch` before passing to the worker
  - Emits compilation progress events (to match SSE streaming UX of cloud mode)
- [ ] Wire `local` mode into `compiler.component.ts` mode selector
- [ ] Add bundle size analysis — ensure the compiler bundle is code-split and lazy-loaded
- [ ] Add `angular.json` Web Worker build configuration

### Phase 3 — Cloud Mode Enhancements (Clerk integration)
- [ ] Gate `POST /compile` behind Clerk JWT middleware (from auth issue)
- [ ] Add `saved` flag to compilation request — if `true` and user is authenticated, store result in R2
- [ ] Associate compilation history with `clerk_user_id` in D1
- [ ] Add `GET /compilations` endpoint for authenticated users to list saved results
- [ ] Expose API key auth path for programmatic access (from auth issue)

### Phase 4 — Hybrid Mode (Pro tier)
- [ ] Add `hybrid` mode to `compiler.component.ts`
- [ ] In hybrid mode, the Angular app:
  1. Sends source URL list to `/proxy/fetch/batch` (new batch proxy endpoint)
  2. Receives prefetched content back
  3. Runs `WorkerCompiler` locally with `PreFetchedContentFetcher`
  4. POSTs compiled result to `/compilations/save` for R2 persistence and diff generation
- [ ] Gate hybrid mode behind `pro` Clerk claim check
- [ ] Add `/proxy/fetch/batch` endpoint supporting up to N URLs per request

### Phase 5 — UX & Documentation
- [ ] Update `compiler.component.ts` mode selector with descriptions of each mode and tier requirements
- [ ] Show a "sign in to save" prompt when anonymous users use local mode
- [ ] Add mode indicator to compilation result card (where it ran)
- [ ] Add `docs/architecture/compilation-modes.md` documenting all three modes, their tradeoffs, and how to add new modes
- [ ] Update `docs/api/README.md` with `/proxy/fetch` and `/compilations/*` endpoints

---

## Key Constraints & Decisions

- **CORS**: Browser cannot fetch arbitrary URLs directly. `/proxy/fetch` is mandatory for local and hybrid modes.
- **Bundle size**: `WorkerCompiler` + AGTree must be lazy-loaded. Target < 500KB gzipped for the worker bundle.
- **SSRF protection**: `/proxy/fetch` must block requests to private IP ranges, `localhost`, and cloud metadata endpoints (`169.254.169.254`).
- **Consistency**: All three modes should produce byte-identical output for the same config + sources. Add a test to verify this.
- **Offline**: Local mode should degrade gracefully when the CORS proxy is unavailable (show error, don't crash).

---

## Dependencies

- 🔗 **Requires** auth issue (Clerk + Cloudflare Access) for `cloud saved`, `hybrid`, and Pro tier gating
- 🔗 **Related to** #610 (Prisma Schema) — compilation history table
- 🔗 **Related to** #979 (AGTree integration) — affects bundle size of local mode worker

---

## Acceptance Criteria

- [ ] `local` mode compiles a filter list entirely in the browser without any Worker CPU usage (only `/proxy/fetch` network call)
- [ ] `cloud` mode behavior is unchanged from current implementation
- [ ] `hybrid` mode fetches sources via Worker, compiles locally, persists via Worker
- [ ] All three modes produce identical output for the same config + source content
- [ ] `/proxy/fetch` blocks SSRF attempts (private IPs, localhost, metadata endpoints)
- [ ] `/proxy/fetch` is rate-limited for anonymous and authenticated users
- [ ] Local mode Web Worker bundle is lazy-loaded and < 500KB gzipped
- [ ] Mode selector UI clearly communicates which tier each mode requires
- [ ] Anonymous users are prompted to sign up when attempting to save results
