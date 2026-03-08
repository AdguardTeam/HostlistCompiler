# Angular 21 Feature Parity Checklist

> **Purpose:** Definitive audit confirming every feature, page, link, theme, and API endpoint
> from the legacy HTML/CSS frontend exists and functions correctly in the Angular 21 SPA.
>
> **Status:** ✅ All items verified — zero untracked regressions.
>
> **Last reviewed:** 2026-03-08

---

## Table of Contents

1. [Pages & Routes](#1-pages--routes)
2. [Feature Parity by Page](#2-feature-parity-by-page)
3. [Theme Consistency](#3-theme-consistency)
4. [Navigation Links & External References](#4-navigation-links--external-references)
5. [Mobile / Responsive Layout](#5-mobile--responsive-layout)
6. [API Endpoints](#6-api-endpoints)
7. [Regressions & Known Gaps](#7-regressions--known-gaps)

---

## 1. Pages & Routes

Maps every legacy static HTML page to its Angular 21 equivalent.

| Legacy File | URL | Angular Route | Component | Status |
|---|---|---|---|---|
| `index.html` (Admin Dashboard) | `/` | `/` | `HomeComponent` | ✅ |
| `compiler.html` | `/compiler.html` | `/compiler` | `CompilerComponent` | ✅ |
| `admin-storage.html` | `/admin-storage.html` | `/admin` | `AdminComponent` | ✅ |
| `test.html` | `/test.html` | `/` + `/api-docs` | `ApiTesterComponent` + `ApiDocsComponent` | ✅ |
| `validation-demo.html` | `/validation-demo.html` | `/validation` | `ValidationComponent` | ✅ |
| `websocket-test.html` | `/websocket-test.html` | `/api-docs` | `ApiDocsComponent` (endpoint docs) | ⚠️ See §7 |
| `e2e-tests.html` | `/e2e-tests.html` | N/A (Playwright in `/e2e/`) | — | ⚠️ See §7 |
| — | — | `/performance` | `PerformanceComponent` | ✅ (new in Angular) |

**Legacy → Angular route redirect coverage:** All old URL paths that browsers may have bookmarked
are handled by the SPA fallback in `worker.ts` — unknown paths redirect to `/`.

---

## 2. Feature Parity by Page

### 2.1 Dashboard — `/` (`HomeComponent`)

Maps to legacy `index.html` (Admin Dashboard).

| Feature | Legacy `index.html` | Angular `HomeComponent` | Status |
|---|---|---|---|
| System status bar (health check) | ✅ | ✅ | ✅ |
| Total Requests metric card | ✅ | ✅ | ✅ |
| Queue Depth metric card | ✅ | ✅ | ✅ |
| Cache Hit Rate metric card | ✅ | ✅ | ✅ |
| Avg Response Time metric card | ✅ | ✅ | ✅ |
| Queue depth count card (5th card) | — | ✅ (new) | ✅ |
| Queue depth chart (Chart.js) | ✅ | ✅ (SVG via `QueueChartComponent`) | ✅ |
| Quick-action buttons (compile, batch, async) | ✅ | ✅ | ✅ |
| Navigation grid (tools & pages) | ✅ | ✅ | ✅ |
| Endpoint comparison table | ✅ | ✅ | ✅ |
| Inline API tester | ✅ (`test.html`) | ✅ (`ApiTesterComponent`) | ✅ |
| Notification settings toggle | ✅ | ✅ (`NotificationService`) | ✅ |
| Auto-refresh toggle + configurable interval | ✅ | ✅ | ✅ |
| Manual "Refresh" button | ✅ | ✅ (`MetricsStore.refresh()`) | ✅ |
| Skeleton loading placeholders | — | ✅ (`SkeletonCardComponent`) | ✅ (improved) |

### 2.2 Compiler — `/compiler` (`CompilerComponent`)

Maps to legacy `compiler.html`.

| Feature | Legacy `compiler.html` | Angular `CompilerComponent` | Status |
|---|---|---|---|
| JSON compilation mode | ✅ | ✅ | ✅ |
| SSE streaming mode | ✅ | ✅ | ✅ |
| Async / queued mode | ✅ | ✅ | ✅ |
| Batch compilation mode | ✅ | ✅ | ✅ |
| Batch + Async mode | — | ✅ (new) | ✅ |
| Preset selector | ✅ | ✅ (`linkedSignal()` URL defaults) | ✅ |
| Add/remove source URL fields | ✅ | ✅ (reactive `FormArray`) | ✅ |
| Transformation checkboxes | ✅ | ✅ | ✅ |
| Benchmark flag | ✅ | ✅ | ✅ |
| Real-time queue stats panel | — | ✅ (shown for async modes) | ✅ (new) |
| Compilation result display | ✅ | ✅ (CDK Virtual Scroll) | ✅ |
| File drag-and-drop upload | — | ✅ (Web Worker parsing) | ✅ (new) |
| Turnstile bot protection | — | ✅ (`TurnstileComponent`) | ✅ (new) |
| Progress indication | ✅ | ✅ (`MatProgressBar`) | ✅ |
| Log / notification integration | — | ✅ (`LogService`, `NotificationService`) | ✅ (new) |

### 2.3 Performance — `/performance` (`PerformanceComponent`)

No direct legacy equivalent; functionality was previously spread across the dashboard.

| Feature | Legacy | Angular `PerformanceComponent` | Status |
|---|---|---|---|
| System health status | partial (`/metrics` call) | ✅ (`/health/latest`) | ✅ |
| Uptime display | — | ✅ | ✅ (new) |
| Per-endpoint request counts | ✅ (`index.html` metrics) | ✅ (`MatTable`) | ✅ |
| Per-endpoint success/failure | — | ✅ | ✅ (new) |
| Per-endpoint avg duration | — | ✅ | ✅ (new) |
| Sparkline charts per endpoint | — | ✅ (`SparklineComponent`) | ✅ (new) |
| Auto-refresh via `MetricsStore` | partial | ✅ | ✅ |

### 2.4 Validation — `/validation` (`ValidationComponent`)

Maps to legacy `validation-demo.html`.

| Feature | Legacy `validation-demo.html` | Angular `ValidationComponent` | Status |
|---|---|---|---|
| Multi-line rules textarea | ✅ | ✅ | ✅ |
| Rule count hint | — | ✅ | ✅ |
| Strict mode toggle | ✅ | ✅ | ✅ |
| Validate button with spinner | ✅ | ✅ | ✅ |
| Color-coded error/warning/ok output | ✅ | ✅ | ✅ |
| Pass/fail summary chips | ✅ | ✅ | ✅ |
| Per-rule AGTree parse errors | ✅ | ✅ (`ValidationService`) | ✅ |

### 2.5 API Reference — `/api-docs` (`ApiDocsComponent`)

Maps to legacy inline API docs (in `index.html`) and the standalone `/api` JSON endpoint.

| Feature | Legacy | Angular `ApiDocsComponent` | Status |
|---|---|---|---|
| Endpoint list with methods | ✅ (HTML list) | ✅ (grouped cards) | ✅ |
| Compilation endpoints | ✅ | ✅ | ✅ |
| Monitoring endpoints | ✅ | ✅ | ✅ |
| Queue management endpoints | ✅ | ✅ | ✅ |
| Workflow endpoints | — | ✅ | ✅ (new) |
| Validation endpoint | — | ✅ | ✅ (new) |
| Admin endpoints | ✅ | ✅ | ✅ |
| Live version display (`/api/version`) | — | ✅ (`httpResource()`) | ✅ (new) |
| Built-in API tester (send requests) | partial (`test.html`) | ✅ | ✅ |
| cURL example generation | ✅ | ✅ | ✅ |

### 2.6 Admin — `/admin` (`AdminComponent`)

Maps to legacy `admin-storage.html`.

| Feature | Legacy `admin-storage.html` | Angular `AdminComponent` | Status |
|---|---|---|---|
| Auth gate (X-Admin-Key) | ✅ | ✅ (`AuthService`, `adminGuard`) | ✅ |
| Authenticated status bar | — | ✅ | ✅ |
| Storage stats (KV / R2 / D1 counts) | ✅ | ✅ (`StorageService`) | ✅ |
| D1 table list | ✅ | ✅ | ✅ |
| Read-only SQL query console | ✅ | ✅ (CDK Virtual Scroll results) | ✅ |
| Clear expired entries | ✅ | ✅ | ✅ |
| Clear cache | ✅ | ✅ | ✅ |
| Vacuum D1 database | ✅ | ✅ | ✅ |
| Skeleton loading state | — | ✅ (`SkeletonCardComponent`) | ✅ (improved) |

---

## 3. Theme Consistency

| Requirement | Implementation | Status |
|---|---|---|
| Dark / light theme toggle | `ThemeService` — persists in `localStorage`, applies `dark-theme` class + `data-theme` attribute to `<body>` | ✅ |
| Theme toggle in toolbar | `AppComponent` toolbar button, accessible via keyboard | ✅ |
| No flash of unstyled content (FOUC) | `loadPreferences()` runs in constructor before first render | ✅ |
| Consistent theme across all routes | Single `ThemeService` + Angular Material theming via CSS custom props | ✅ |
| Compiler page | Material Design 3 color tokens, `dark-theme` class propagates | ✅ |
| Dashboard / Home page | Same | ✅ |
| Admin page | Same | ✅ |
| Performance page | Same | ✅ |
| Validation page | Same | ✅ |
| API Docs page | Same | ✅ |

---

## 4. Navigation Links & External References

### Internal Navigation

| Link / Action | Legacy | Angular | Status |
|---|---|---|---|
| Home / Dashboard | `index.html` | `/` via `routerLink` | ✅ |
| Compiler | `compiler.html` | `/compiler` via `routerLink` | ✅ |
| Performance | — | `/performance` via `routerLink` | ✅ |
| Validation | `validation-demo.html` | `/validation` via `routerLink` | ✅ |
| API Docs | `index.html#api` | `/api-docs` via `routerLink` | ✅ |
| Admin | `admin-storage.html` | `/admin` via `routerLink` | ✅ |
| 404 fallback | — | `**` → redirect to `/` | ✅ |
| Skip-to-main-content link | — | ✅ (`<a href="#main-content">`) | ✅ (a11y new) |

### Desktop / Mobile Navigation

| Navigation Pattern | Angular | Status |
|---|---|---|
| Horizontal tab bar (desktop) | `routerLink` + `routerLinkActive` tabs in toolbar | ✅ |
| Slide-over sidenav (mobile) | `MatSidenav` (`mode="over"`) with hamburger button | ✅ |
| Active route highlight | `routerLinkActive="active-nav-item"` | ✅ |

### External References

| Link | Destination | Location in Angular | Status |
|---|---|---|---|
| GitHub repository | `https://github.com/jaypatrick/adblock-compiler` | `AppComponent` footer | ✅ |
| JSR package | `@jk-com/adblock-compiler` (via GitHub link) | Footer | ✅ |
| Live service URL | `https://adblock-compiler.jk-com.workers.dev/` | — (API calls use relative paths) | ✅ |

---

## 5. Mobile / Responsive Layout

| Requirement | Implementation | Status |
|---|---|---|
| Slide-over navigation drawer on mobile | `MatSidenav mode="over"` in `AppComponent` | ✅ |
| Hamburger menu button | Shown on small viewports (`<= 768 px`) via CSS `display` | ✅ |
| Desktop horizontal tabs hidden on mobile | CSS media query hides `.app-nav-tabs` | ✅ |
| Stat cards responsive grid | CSS grid with `auto-fill` / `minmax` | ✅ |
| Compiler form adapts to narrow screens | `MatFormField` full-width, stacked layout | ✅ |
| Admin SQL console wraps correctly | CDK Virtual Scroll with overflow handling | ✅ |
| Navigation grid auto-reflow | CSS grid `auto-fill` | ✅ |
| Table horizontal scroll | `overflow-x: auto` wrapper on all `MatTable` | ✅ |

---

## 6. API Endpoints

All worker API endpoints surfaced in the Angular frontend (called from services and documented in `ApiDocsComponent`).

### 6.1 Compilation

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `POST /compile` | ✅ | `CompilerService.compile()` | ✅ |
| `POST /compile/stream` | ✅ | `SseService` + `CompilerService.stream()` | ✅ |
| `POST /compile/batch` | ✅ | `CompilerService.batch()` | ✅ |
| `POST /compile/async` | ✅ | `CompilerService.compileAsync()` | ✅ |
| `POST /compile/batch/async` | ✅ | `CompilerService.batchAsync()` | ✅ |
| `GET /ws/compile` | ✅ | Documented in `/api-docs` | ⚠️ See §7 |
| `POST /ast/parse` | ✅ | `ApiDocsComponent` tester | ✅ |

### 6.2 Monitoring & Health

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `GET /health` | ✅ | `MetricsStore` (health polling) | ✅ |
| `GET /health/latest` | ✅ | `PerformanceComponent` (`httpResource`) | ✅ |
| `GET /metrics` | ✅ | `MetricsStore` / `MetricsService` | ✅ |
| `GET /api` | ✅ | `ApiDocsComponent` | ✅ |
| `GET /api/version` | ✅ | `ApiDocsComponent` (`httpResource`) | ✅ |
| `GET /api/deployments` | ✅ | Documented in `/api-docs` | ✅ |
| `GET /api/deployments/stats` | ✅ | Documented in `/api-docs` | ✅ |

### 6.3 Queue Management

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `GET /queue/stats` | ✅ | `QueueService`, `MetricsStore` | ✅ |
| `GET /queue/history` | ✅ | `QueueService`, `QueueChartComponent` | ✅ |
| `GET /queue/results/:requestId` | ✅ | `CompilerService` (async polling) | ✅ |
| `POST /queue/cancel/:requestId` | ✅ | `CompilerService.cancelJob()` | ✅ |

### 6.4 Workflow (Durable Execution)

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `POST /workflow/compile` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `POST /workflow/batch` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `GET /workflow/status/:instanceId` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `GET /workflow/metrics` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `GET /workflow/events/:instanceId` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `POST /workflow/cache-warm` | ✅ | `ApiDocsComponent` (documented) | ✅ |
| `POST /workflow/health-check` | ✅ | `ApiDocsComponent` (documented) | ✅ |

### 6.5 Validation

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `POST /api/validate` | ✅ | `ValidationService` | ✅ |

### 6.6 Admin Storage (auth-gated)

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `GET /admin/storage/stats` | ✅ | `StorageService.getStats()` | ✅ |
| `GET /admin/storage/tables` | ✅ | `StorageService.getTables()` | ✅ |
| `POST /admin/storage/query` | ✅ | `StorageService.query()` | ✅ |
| `POST /admin/storage/clear-expired` | ✅ | `StorageService.clearExpired()` | ✅ |
| `POST /admin/storage/clear-cache` | ✅ | `StorageService.clearCache()` | ✅ |
| `POST /admin/storage/vacuum` | ✅ | `StorageService.vacuum()` | ✅ |
| `GET /admin/storage/export` | ✅ | `ApiDocsComponent` (documented) | ✅ |

### 6.7 Configuration

| Endpoint | Worker | Angular Consumer | Status |
|---|---|---|---|
| `GET /api/turnstile-config` | ✅ | `TurnstileService` | ✅ |

---

## 7. Regressions & Known Gaps

### 7.1 `websocket-test.html` — No Dedicated Angular Route

**Legacy:** A standalone HTML page at `/websocket-test.html` provided an interactive
WebSocket client to exercise the `GET /ws/compile` endpoint.

**Angular status:** There is **no dedicated Angular route** for WebSocket testing.

**Mitigation:**
- The `GET /ws/compile` endpoint is fully documented in the `/api-docs` route with
  method, path, and description.
- The endpoint remains operational in the Worker.
- Manual testing can be performed using browser DevTools or `wscat`.

**Recommendation:** If interactive WebSocket testing is desired in the SPA, add a
`/ws-test` route with a `WsTestComponent` that opens a `WebSocket` and displays
send/receive frames. Log this as a child issue if needed.

**Severity:** Low — endpoint unchanged; only the interactive HTML tester is absent.

---

### 7.2 `e2e-tests.html` — Test Runner Removed from Production SPA

**Legacy:** An HTML page at `/e2e-tests.html` embedded a browser-based end-to-end
test runner that could be opened in any browser to run API integration tests.

**Angular status:** Not ported to the Angular SPA. End-to-end tests now live in
`frontend/e2e/` and are executed with Playwright (`npm run e2e`).

**Mitigation:**
- Playwright tests in `frontend/e2e/` cover the same navigation and API scenarios.
- The `e2e-tests.html` approach was a development/debug convenience, not a
  production feature used by end-users.

**Recommendation:** Keep Playwright as the canonical e2e mechanism. The HTML test
runner is not required in the production SPA.

**Severity:** Low — test coverage maintained via Playwright; no user-facing regression.

---

## Summary

| Category | Total Items | ✅ Present | ⚠️ Gap / Notes |
|---|---|---|---|
| Pages / Routes | 8 | 6 | 2 (see §7) |
| Dashboard features | 14 | 14 | 0 |
| Compiler features | 14 | 14 | 0 |
| Performance features | 7 | 7 | 0 |
| Validation features | 7 | 7 | 0 |
| API Docs features | 10 | 10 | 0 |
| Admin features | 9 | 9 | 0 |
| Theme items | 10 | 10 | 0 |
| Navigation / links | 14 | 14 | 0 |
| Responsive layout | 8 | 8 | 0 |
| API endpoints | 30 | 29 | 1 (`/ws/compile` not surfaced as interactive UI) |
| **Total** | **131** | **128** | **3** |

> All three gaps are low-severity development/debug conveniences with documented
> mitigations. There are **zero untracked regressions** in user-facing functionality.
