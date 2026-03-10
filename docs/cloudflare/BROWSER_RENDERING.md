# Browser Rendering Integration

This document describes the Cloudflare Browser Rendering integration in adblock-compiler.
Browser Rendering allows the worker to spin up a full Chromium instance to fetch filter-list
sources that require JavaScript execution, navigate redirect chains, or run behind bot-detection
walls that defeat a plain `fetch()`.

---

## Binding Configuration

Add the `BROWSER` binding to `wrangler.toml`:

```toml
[browser]
binding = "BROWSER"
```

The binding type is `Fetcher` (Cloudflare's internal `cloudflare:workers` `WorkerEntrypoint`
type). The `@cloudflare/playwright` package wraps it into a Playwright-compatible API.

---

## Architecture

### Single Source of Truth: `BrowserFetcher`

All Playwright structural interfaces and the `EXTRACT_TEXT_SCRIPT` constant live exclusively
in `src/platform/BrowserFetcher.ts`. Nothing is duplicated in the worker layer.

```
src/platform/BrowserFetcher.ts
  ├── IBrowserWorker           — type of env.BROWSER
  ├── IPlaywrightBrowser       — slim Playwright Browser interface
  ├── IPlaywrightPage          — slim Playwright Page interface
  ├── BrowserConnector         — (binding: IBrowserWorker) => Promise<IPlaywrightBrowser>
  ├── BrowserFetcherOptions    — { timeout?: number; waitUntil?: BrowserWaitUntil; returnHtml?: boolean }
  ├── EXTRACT_TEXT_SCRIPT      — inline script injected into the page to extract filter rules
  └── BrowserFetcher           — IContentFetcher implementation
```

Worker utilities in `worker/handlers/browser.ts` import types and the constant from
`BrowserFetcher.ts`. They never re-define them.

### Dynamic Import

`@cloudflare/playwright` imports `cloudflare:workers` at module level. Loading it statically
crashes Deno's test runner. Worker code therefore loads it lazily:

```typescript
// worker/handlers/browser.ts
const { launch } = await import('@cloudflare/playwright');
const browser = await launch(binding);
```

This keeps the module out of Deno's static graph during `deno task check` and `deno task test`.

---

## Worker Endpoints

All three endpoints require the caller to be authenticated with a Bearer token.

### `POST /api/browser/resolve-url`

Navigates to a URL and returns the final canonical URL after all redirects.

**Request body**

```jsonc
{
    "url": "https://example.com/short-link",   // required
    "waitUntil": "networkidle"                 // optional, see §waitUntil Options
}
```

**Response `200`**

```jsonc
{
    "success": true,
    "resolvedUrl": "https://example.com/final-destination",
    "originalUrl": "https://example.com/short-link"
}
```

**Use case:** Discover the true destination of a redirect chain before scheduling a
filter-list download. Saves bandwidth on subsequent compilation runs.

---

### `POST /api/browser/monitor`

Performs parallel browser-based health checks on a list of filter-list source URLs.
For each URL the handler navigates with a headless browser, verifies non-empty text
content, and optionally captures a full-page PNG screenshot stored in R2.

The full result set is persisted to the KV key `browser:monitor:latest` so it can be
retrieved later without re-running the checks.

**Request body**

```jsonc
{
    "urls": [                                   // required, 1–10
        "https://example.com/filter-list.txt",
        "https://another.example.com/rules.txt"
    ],
    "captureScreenshots": false,               // optional — store a PNG per URL in R2
    "screenshotPrefix": "2025-07-01",          // optional — R2 key prefix (default: ISO date)
    "timeout": 30000,                          // optional — per-URL timeout in ms
    "waitUntil": "networkidle"                 // optional, see §waitUntil Options
}
```

**Response `200`**

```jsonc
{
    "success": true,
    "total": 2,
    "reachable": 1,
    "unreachable": 1,
    "results": [
        {
            "url": "https://example.com/filter-list.txt",
            "reachable": true,
            "checkedAt": "2025-07-01T12:00:00.000Z",
            "screenshotKey": "2025-07-01/a1b2c3d4e5f6.png"
        },
        {
            "url": "https://another.example.com/rules.txt",
            "reachable": false,
            "error": "net::ERR_NAME_NOT_RESOLVED",
            "checkedAt": "2025-07-01T12:00:01.000Z"
        }
    ]
}
```

`screenshotKey` is only present when `captureScreenshots` is `true` and `FILTER_STORAGE`
is configured. When a URL cannot be fetched, the result entry contains an `error` field
and `reachable` is `false`.

**Required bindings:** `BROWSER`
**Optional bindings:** `FILTER_STORAGE` (R2 for screenshots), `COMPILATION_CACHE` (KV for persistence)

---

### `GET /api/browser/monitor/latest`

Returns the most recent result set written by `POST /api/browser/monitor`. Useful for polling
or dashboards that need to display change status without triggering new browser navigations.

**Response `200`** — same shape as `POST /api/browser/monitor`

**Response `404`** — no monitor run has been persisted yet

**Required binding:** `COMPILATION_CACHE`

---

## `waitUntil` Options

All browser endpoints accept an optional `waitUntil` field that controls when Playwright
considers a page navigation complete.

| Value | Description |
|---|---|
| `load` | Fires when the `load` DOM event fires. Fastest; suitable for static pages. |
| `domcontentloaded` | Fires when the `DOMContentLoaded` event fires. |
| `networkidle` | **(default)** Waits until no network connections for 500 ms. Best for SPA-heavy pages. |

---

## `ISource.useBrowser` Flag

Set `useBrowser: true` on any source in a `WorkerCompiler` configuration to route that
source's download through `BrowserFetcher` instead of the standard HTTP fetcher:

```typescript
import { WorkerCompiler } from '@jk-com/adblock-compiler';

const compiler = new WorkerCompiler({
    fetcher: httpFetcher,
    browserConnector: launch,     // from @cloudflare/playwright
    browserBinding: env.BROWSER,
});

const result = await compiler.compile({
    sources: [
        {
            source: 'https://example.com/plain-list.txt',
        },
        {
            source: 'https://js-heavy-site.example.com/rules',
            useBrowser: true,     // ← uses BrowserFetcher for this source only
        },
    ],
    // ...
});
```

When `useBrowser` is `true` but `browserConnector` or `browserBinding` are not provided to
`WorkerCompiler`, the compiler throws an error.

---

## Using `BrowserFetcher` Directly

`BrowserFetcher` is exported from the library and can be used outside the Worker:

```typescript
import { BrowserFetcher } from '@jk-com/adblock-compiler';

// In a Cloudflare Worker:
import { launch } from '@cloudflare/playwright';

const fetcher = new BrowserFetcher(
    env.BROWSER,
    { timeout: 30_000, waitUntil: 'networkidle' },
    launch,
);

const content = await fetcher.fetch('https://example.com/filter-list.txt');
```

---

## Required Bindings Summary

| Binding | Type | Required for |
|---|---|---|
| `BROWSER` | `Fetcher` | All browser navigation |
| `FILTER_STORAGE` | `R2Bucket` | Screenshot capture (`POST /api/browser/monitor` with `captureScreenshots: true`) |
| `COMPILATION_CACHE` | `KVNamespace` | Result persistence (`POST /api/browser/monitor`, `GET /api/browser/monitor/latest`) |

Both `BROWSER` and `COMPILATION_CACHE` are already declared in `worker/types.ts` (`Env` interface) and `wrangler.toml`.
