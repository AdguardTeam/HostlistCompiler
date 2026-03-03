# Issue #559: Migrate Angular PoC to Replace Current Frontend

## Problem Statement

The current frontend is vanilla HTML + TailwindCSS + plain JS served as static files from `public/`. It lacks componentization, proper state management, SSR, and accessibility. The Angular 21 PoC in `poc/angular/` demonstrates modern patterns (signals, rxResource, SSR on Cloudflare Workers) but only covers ~5 components. This plan migrates the PoC into a production-ready frontend that replaces `public/`.

## Current State

**Existing frontend (`public/`):**
- Static HTML pages: `index.html` (dashboard), `compiler.html`, `api.html`, `validation-demo.html`, `admin-storage.html`, etc.
- TailwindCSS + custom CSS variables for light/dark theming
- Vanilla JS with Chart.js for metrics, SSE streaming for compile output
- Cloudflare Turnstile integration for bot protection
- Served via Wrangler `[assets] directory = "./dist"` (Vite build)

**Angular PoC (`poc/angular/`):**
- Angular 21 with zoneless change detection, Material Design 3, Vitest
- SSR on Cloudflare Workers via `AngularAppEngine` + `server.ts`
- Components: AppComponent (shell), HomeComponent (dashboard), CompilerComponent (forms with rxResource/linkedSignal), BenchmarkComponent, SignalsComponent, StatCardComponent
- Services: CompilerService (mock API fallback), ThemeService (signal-based dark/light)
- Lazy-loaded routes, `@defer` blocks, view transitions

**Backend API (`worker/worker.ts`):**
- `/api/compile` (JSON), `/compile/stream` (SSE), `/api/compile/batch`, `/api/health`, `/api/metrics`, `/api/version`, `/api/validate`
- Cloudflare bindings: KV (cache, rate limit, metrics), R2 (storage), D1 (database), Queues, Workflows, Analytics Engine, Durable Objects

**CI (`ci.yml`):**
- Deno-only: lint, format, typecheck, test with coverage
- No Angular build/test step

## Proposed Changes

### Phase 1: Project Scaffold & Build Integration

Move the Angular app from `poc/angular/` to a top-level `frontend/` directory. This keeps clear separation between the Deno backend/compiler core and the Angular frontend while sharing a single repo.

- Move `poc/angular/` → `frontend/`
- Update `frontend/package.json` name to `adblock-compiler-frontend`
- Update the root `wrangler.toml` `[build]` command to include the Angular build: the `[assets]` directory should point to `frontend/dist/adblock-compiler-poc/browser`
- Add a root-level deno task (`ui:build:ng`) that runs `npm --prefix frontend run build`
- Preserve the existing Vite build path as a fallback during migration; both can coexist temporarily
- Wire Angular's `server.ts` SSR entry into the main Worker or as a separate Cloudflare Workers route (decision: keep SSR as a separate Worker initially for isolation, merge later if desired)

### Phase 2: Core Pages — Dashboard & Compiler

Build out the two primary pages to feature parity with `public/index.html` and `public/compiler.html`.

**Dashboard (HomeComponent):**
- Replace hardcoded stat values with live data from `/api/metrics` and `/api/health` using `rxResource()`
- Add a navigation grid matching the current dashboard cards (Compiler, API Docs, Validation, Storage Admin)
- Integrate Chart.js or Angular-native charting (e.g., `ngx-charts` or custom Canvas with signals) for metrics visualization
- Wire Cloudflare Web Analytics snippet into `index.html` or via Angular's `APP_INITIALIZER`

**Compiler (CompilerComponent):**
- Implement SSE streaming integration: create an `SseService` that wraps `EventSource` and exposes signals for each event type (log, metric, result, error, done)
- Add drag-and-drop file input using Angular CDK `DragDropModule` for uploading local filter lists
- Implement diff viewer for comparing current vs. previous compilation
- Add AST viewer tab — use `@defer` for lazy loading
- Wire Cloudflare Turnstile verification before compile submission

### Phase 3: Additional Pages

- **API Docs page:** Migrate `api.html` — embed OpenAPI/Swagger UI or build a custom Angular component reading from `/api/openapi.json`
- **Validation page:** Migrate `validation-demo.html` — form-based filter rule validation using `/api/validate`
- **Admin/Storage page:** Migrate `admin-storage.html` — R2 bucket browser, requires auth
- Add route guards (`canActivate`) for admin pages using an `AuthService`

### Phase 4: API Integration & Services

Create Angular services that wrap all backend endpoints:

- `CompilerService` — already exists, extend for SSE streaming, batch compile, diff
- `MetricsService` — `/api/metrics`, `/api/health` (polling with `rxResource` + `interval`)
- `ValidationService` — `/api/validate`
- `StorageService` — R2 admin endpoints
- `AuthService` — Turnstile token management, admin key auth
- `SseService` — generic `EventSource` wrapper returning signals

All services should use `inject(HttpClient)` with `withFetch()` for SSR compatibility. For SSE, use the native `EventSource` API wrapped in an Angular service that produces signals.

### Phase 5: Accessibility (ARIA) & UX Polish

- Audit all components with Angular Material's built-in a11y (mat-label, aria-label, etc.)
- Add `@angular/cdk/a11y` `FocusTrapDirective` for modals/dialogs
- Implement keyboard navigation for all interactive elements
- Add Angular Animations (`@angular/animations`) for route transitions (already using `withViewTransitions()`), card interactions, and loading states
- Ensure color contrast meets WCAG AA using Material Design 3 theme tokens
- Add `live` ARIA announcements for async operations (compilation progress, errors)

### Phase 6: CI/CD Pipeline

Extend `ci.yml` to include Angular frontend:

- Add a `frontend-test` job: `npm --prefix frontend run test` (Vitest)
- Add a `frontend-build` job: `npm --prefix frontend run build` (depends on lint passing)
- Add a `frontend-lint` job: `ng lint` (add `@angular-eslint` if not already present)
- Update the deploy workflow to build Angular before `wrangler deploy`
- Cache `frontend/node_modules` with `actions/cache` keyed on `frontend/package-lock.json`

### Phase 7: Documentation & Cleanup

- Delete `public/` directory and all vanilla HTML/CSS/JS files once Angular frontend is feature-complete
- Remove Vite config (`vite.config.ts`, `postcss.config.js`) and Tailwind dependencies from root `package.json`
- Update `README.md` with new frontend architecture, dev workflow, and deployment instructions
- Update `CONTRIBUTING.md` with Angular development guidelines
- Document the SSE integration pattern and signal-based state management approach

## Key Decisions

**Material Design vs. TailwindCSS:** Use Angular Material (already in PoC with M3 theme). Material handles ARIA, theming, and form controls natively. No need for Tailwind in the Angular app.

**Vitest vs. Deno tests:** Vitest for all Angular/frontend code (already configured). Deno test runner remains for backend (`src/`, `worker/`). No mixing within a single build target.

**Node vs. Deno for Angular:** Angular CLI requires Node for building. The built SSR output runs on Cloudflare Workers (WinterCG-compatible). Deno remains the runtime for the backend compiler core. Accept this split — fighting it adds complexity with no benefit.

**SSR architecture:** Keep Angular SSR as a separate Worker initially for isolation during migration; unify with the main Worker later if desired.
