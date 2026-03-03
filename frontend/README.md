# Angular 21 PoC — Adblock Compiler

A proof-of-concept Angular 21 application that is a **complete showcase of every major modern Angular API**. It uses Angular Material 3, zoneless change detection, and Server-Side Rendering (SSR).

---

## 🚀 How to Run

```bash
cd poc/angular
npm install
npm start              # CSR dev server  → http://localhost:4200
npm run build          # Production SSR + prerender build
npm run preview        # Cloudflare Workers local dev (wrangler dev) → http://localhost:8787
npm run deploy         # Deploy to Cloudflare Workers (after npm run build)
```

---

## Technology Stack

| Technology | Version | Role |
|---|---|---|
| **Angular** | ^21.0.0 | Application framework |
| **Angular Material** | ^21.0.0 | Material Design 3 component library |
| **@angular/ssr** | ^21.0.0 | Server-Side Rendering (edge-fetch adapter) |
| **RxJS** | ~7.8.2 | Async streams (HTTP, route params) |
| **TypeScript** | ~5.8.0 | Type safety throughout |
| **Cloudflare Workers** | — | Edge deployment platform |
| **Wrangler** | — | Cloudflare Workers CLI (deploy + local dev) |
| **Vitest** | ^3.0.0 | Fast unit test runner (replaces Karma) |
| **@analogjs/vitest-angular** | ^1.0.0 | Angular compiler plugin for Vitest |
| **@fontsource/roboto** | ^5.x | Roboto font — npm package, no CDN |
| **material-symbols** | ^0.31.0 | Material Symbols icon font — npm package, no CDN |

---

## Project Structure

```
src/
├── app/
│   ├── app.component.ts            # Root shell — viewChild(), ThemeService, ErrorBoundary
│   ├── app.config.ts               # Browser providers — provideAppInitializer(), GlobalErrorHandler, ServiceWorker
│   ├── app.config.server.ts        # SSR providers — mergeApplicationConfig()
│   ├── app.routes.ts               # Lazy-loaded routes with titles
│   ├── app.routes.server.ts        # Per-route SSR mode (Prerender / Server)
│   │
│   ├── compiler/
│   │   └── compiler.component.ts   # rxResource(), linkedSignal(), Turnstile, CDK Virtual Scroll, signal form wrappers
│   ├── home/
│   │   └── home.component.ts       # MetricsStore, @defer prefetch on hover, skeleton loading
│   ├── performance/
│   │   └── performance.component.ts  # httpResource(), MetricsStore, sparkline charts
│   ├── admin/
│   │   └── admin.component.ts      # CDK Virtual Scrolling, skeleton loading
│   ├── api-docs/
│   │   └── api-docs.component.ts   # httpResource() for version endpoint
│   ├── validation/
│   │   └── validation.component.ts # Rule validation with color-coded output
│   │
│   ├── error/
│   │   ├── global-error-handler.ts  # Custom ErrorHandler with signal-based state
│   │   └── error-boundary.component.ts  # Dismissible error overlay
│   ├── skeleton/
│   │   ├── skeleton-card.component.ts   # Shimmer card placeholder
│   │   └── skeleton-table.component.ts  # Shimmer table placeholder
│   ├── sparkline/
│   │   └── sparkline.component.ts  # Canvas 2D mini chart (zero deps)
│   ├── turnstile/
│   │   └── turnstile.component.ts  # Cloudflare Turnstile CAPTCHA widget
│   ├── store/
│   │   └── metrics.store.ts        # Shared singleton signal store with SWR
│   │
│   ├── services/
│   │   ├── compiler.service.ts     # Injectable with inject(), Observable HTTP
│   │   ├── theme.service.ts        # ThemeService — signal state, SSR-safe
│   │   ├── turnstile.service.ts    # Cloudflare Turnstile token management
│   │   ├── filter-parser.service.ts  # Web Worker bridge for filter parsing
│   │   └── swr-cache.service.ts    # Generic stale-while-revalidate signal cache
│   │
│   ├── workers/
│   │   └── filter-parser.worker.ts # Off-thread filter list parsing
│   │
│   └── stat-card/
│       ├── stat-card.component.ts  # input(), output(), model() signal APIs
│       └── stat-card.component.spec.ts  # Zoneless unit test with Vitest
│
├── e2e/                 # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── home.spec.ts
│   ├── compiler.spec.ts
│   └── navigation.spec.ts
├── index.html           # Turnstile script, fonts loaded from npm
├── main.ts              # bootstrapApplication()
├── main.server.ts       # Server bootstrap
├── test-setup.ts        # Vitest global setup — imports @angular/compiler
└── styles.css           # @fontsource/roboto + material-symbols imports
server.ts                # Cloudflare Workers fetch handler + CSP security headers
ngsw-config.json         # Angular Service Worker / PWA config
wrangler.toml            # Cloudflare Workers deployment config
vitest.config.ts         # Vitest + @analogjs/vitest-angular configuration
tsconfig.spec.json       # TypeScript config for spec files (vitest/globals types)
```

---

## Angular 21 Features Demonstrated

### 1. `signal()` / `computed()` / `effect()` — Core Reactivity

All mutable component state is a `signal()`. Derived values are `computed()`. Side-effects use `effect()`.

```typescript
compilationCount = signal(0);
doubleCount      = computed(() => this.compilationCount() * 2);

constructor() {
    effect(() => console.log('Count:', this.compilationCount()));
}
```

→ **See:** `signals/signals.component.ts`

---

### 2. `input()` / `input.required()` / `output()` / `model()` — Signal Component API (v19+)

Replaces `@Input()`, `@Output() + EventEmitter`, and the paired `@Input()/@Output()` pattern for two-way binding.

```typescript
// Signal inputs — compile-time error if required input is missing
readonly label       = input.required<string>();   // replaces @Input() label!: string
readonly color       = input<string>('#1976d2');   // replaces @Input() color = '#1976d2'

// Signal output — replaces @Output() clicked = new EventEmitter<string>()
readonly cardClicked = output<string>();

// model() — two-way writable signal — replaces @Input()/@Output() pair
readonly highlighted = model<boolean>(false);

// In template:  [(highlighted)]="isHighlighted"
```

→ **See:** `stat-card/stat-card.component.ts`

---

### 3. `viewChild()` / `viewChildren()` — Signal Queries (v17.3+)

Replaces `@ViewChild` / `@ViewChildren` decorators. Returns `Signal<T | undefined>`.

```typescript
// Replaces: @ViewChild('benchmarkTable') tableRef!: ElementRef
readonly benchmarkTableRef = viewChild<ElementRef>('benchmarkTable');
readonly sidenavRef        = viewChild<MatSidenav>('sidenav');

// Read like any signal — no AfterViewInit needed:
const height = this.benchmarkTableRef()?.nativeElement.offsetHeight;
```

→ **See:** `app.component.ts`, `home.component.ts`, `benchmark/benchmark.component.ts`

---

### 4. `@defer` — Deferrable Views (v17+)

Lazily loads and renders a block when a trigger fires. Enables incremental hydration in SSR.

```html
<!-- Render only when the block enters the viewport -->
@defer (on viewport) {
    <app-feature-highlights />
} @placeholder (minimum 200ms) {
    <mat-spinner diameter="32" />
} @loading (minimum 300ms; after 100ms) {
    <mat-spinner diameter="32" color="accent" />
}

<!-- Render when the browser is idle (requestIdleCallback) -->
@defer (on idle) {
    <app-summary-stats />
} @placeholder {
    <mat-spinner diameter="24" />
}
```

**Available triggers:** `on viewport`, `on idle`, `on interaction`, `on timer(n)`, `when (expr)`

→ **See:** `home/home.component.ts` (on viewport), `benchmark/benchmark.component.ts` (on idle)

---

### 5. `rxResource()` — Signal-Native HTTP (v19+)

From `@angular/core/rxjs-interop`. Replaces the `loading / error / result` signal trio + manual subscribe/unsubscribe.

```typescript
// OLD (removed):
readonly loading = signal(false);
readonly error   = signal<string | null>(null);
readonly results = signal<CompileResponse | null>(null);
this.svc.compile(...).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: r => { this.results.set(r); this.loading.set(false); },
    error: e => { this.error.set(e.message); this.loading.set(false); }
});

// NEW:
readonly compileResource = rxResource<CompileResponse, CompileRequest | undefined>({
    request: () => this.pendingRequest(),   // undefined → stays Idle
    loader: ({ request }) => this.svc.compile(request.urls, request.transformations),
});

// Template:
compileResource.isLoading()  // boolean signal
compileResource.value()      // CompileResponse | undefined signal
compileResource.error()      // unknown signal
compileResource.status()     // ResourceStatus signal
compileResource.reload()     // re-trigger the loader
```

→ **See:** `compiler/compiler.component.ts`

---

### 6. `linkedSignal()` — Derived Writable Signal (v19+)

Like `computed()` but writable. Resets its value when the source signal changes, but can be overridden manually between resets.

```typescript
// runCount drives the default transformation set
readonly runCount = signal<number>(5);

// selectedTransformations resets when runCount changes,
// but the user can still check/uncheck boxes manually
readonly selectedTransformations = linkedSignal<string[]>(() => {
    const preset = this.presets.find(p => p.count === this.runCount());
    return preset?.defaultTransformations ?? ['RemoveComments'];
});

// Preset-driven URL defaults in Compiler:
readonly presetUrls = linkedSignal(() => {
    const preset = this.presets.find(p => p.label === this.selectedPreset());
    return preset?.urls ?? [''];
});
```

→ **See:** `compiler/compiler.component.ts`, `benchmark/benchmark.component.ts`

---

### 7. `afterRenderEffect()` — Post-Render DOM Effects (v20+)

Correct API for reading/writing the DOM after Angular commits a render. Unlike `effect()` in the constructor, this is guaranteed to run after layout is complete.

```typescript
readonly tableHeight    = signal(0);
readonly benchmarkTableRef = viewChild<ElementRef>('benchmarkTable');

constructor() {
    afterRenderEffect(() => {
        const el = this.benchmarkTableRef()?.nativeElement as HTMLElement | undefined;
        if (el) {
            // Safe: DOM is fully committed at this point
            this.tableHeight.set(el.offsetHeight);
        }
    });
}
```

**Use cases:** chart integrations, scroll position restore, focus management, third-party DOM libraries.

→ **See:** `benchmark/benchmark.component.ts`

---

### 8. `provideAppInitializer()` — App Bootstrap Hook (v19+)

Replaces the verbose `APP_INITIALIZER` token + factory function.

```typescript
// OLD:
{ provide: APP_INITIALIZER,
  useFactory: (theme: ThemeService) => () => theme.loadPreferences(),
  deps: [ThemeService], multi: true }

// NEW:
provideAppInitializer(() => {
    inject(ThemeService).loadPreferences();
})
```

The callback runs before the first render. `inject()` works inside it — no `deps` array needed. Supports async (return a `Promise`).

→ **See:** `app.config.ts`, `services/theme.service.ts`

---

### 9. `toSignal()` — Observable → Signal Bridge

From `@angular/core/rxjs-interop`. Converts any Observable to a Signal. Auto-unsubscribes on component destroy.

```typescript
// Route queryParamMap (Observable) → Signal
private readonly queryParams = toSignal(
    inject(ActivatedRoute).queryParamMap,
    { initialValue: null }
);
```

→ **See:** `compiler/compiler.component.ts`

---

### 10. `takeUntilDestroyed()` — Declarative Subscription Teardown

From `@angular/core/rxjs-interop`. Replaces `Subject<void>` + `ngOnDestroy` pattern.

```typescript
private readonly destroyRef = inject(DestroyRef);

this.route.queryParamMap
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(params => { /* … */ });
// No ngOnDestroy needed
```

→ **See:** `compiler/compiler.component.ts`

---

### 11. `inject()` — Functional Dependency Injection

Replaces constructor DI. Works in components, services, directives, pipes, and `provideAppInitializer()`.

```typescript
private readonly router   = inject(Router);
private readonly http     = inject(HttpClient);
readonly themeService     = inject(ThemeService);
```

---

### 12. `@if` / `@for` / `@switch` — Built-in Control Flow (v17+)

Replaces `*ngIf`, `*ngFor`, `*ngSwitch` structural directives.

```html
@if (compileResource.isLoading()) {
    <mat-spinner />
} @else if (compileResource.value(); as r) {
    <pre>{{ r | json }}</pre>
}

@for (item of runs(); track item.run) {
    <tr>…</tr>
} @empty {
    <tr><td>No runs yet</td></tr>
}
```

---

### 13. Zoneless Change Detection

```typescript
provideZonelessChangeDetection()   // in app.config.ts
```

No `zone.js` in `polyfills`. Change detection is driven purely by signal writes and the microtask scheduler. Results in smaller bundles and more predictable rendering.

---

### 14. Multi-Mode SSR (Prerender + Server)

```typescript
// app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
    { path: '',   renderMode: RenderMode.Prerender }, // Home: SSG at build time
    { path: '**', renderMode: RenderMode.Server    }, // Others: SSR per request
];
```

The Home page is **prerendered** (SSG) — HTML generated once at build time and cached. Dynamic routes use **server rendering** per request.

---

### 15. Fonts via npm (No CDN)

```css
/* styles.css */
@import '@fontsource/roboto/300.css';
@import '@fontsource/roboto/400.css';
@import '@fontsource/roboto/500.css';
@import 'material-symbols/outlined.css';
```

No Google Fonts CDN requests — fonts are bundled by the Angular build pipeline. SSR-safe, GDPR-friendly, and faster on first load.

---

### 16. Zoneless Unit Testing with Vitest

```typescript
// stat-card.component.spec.ts
await TestBed.configureTestingModule({
    imports: [StatCardComponent],
    providers: [provideZonelessChangeDetection()],   // zoneless in tests too
}).compileComponents();

fixture.componentRef.setInput('label', 'Filter Lists');  // signal input setter
await fixture.whenStable();                              // flush microtask scheduler
```

Test runner: **Vitest** + **`@analogjs/vitest-angular`** — replaces Karma + Jasmine.

```bash
npm test               # vitest run (single pass)
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # coverage report via V8
```

→ **See:** `stat-card/stat-card.component.spec.ts`, `vitest.config.ts`, `src/test-setup.ts`

---

## Enhancement Items

The following 14 enhancements bring the PoC to production-grade quality across security, performance, architecture, and developer experience.

### E1. Cloudflare Turnstile (Bot Protection)

Integrates Cloudflare's privacy-preserving CAPTCHA alternative. The `TurnstileService` manages the widget lifecycle and token signals; `TurnstileComponent` renders the challenge. Wired into the Compiler page to gate form submission.

→ **See:** `services/turnstile.service.ts`, `turnstile/turnstile.component.ts`, `compiler/compiler.component.ts`

### E2. Content Security Policy (CSP) Headers

`server.ts` now injects `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers on all HTML responses. CSP is configured for self-hosted scripts/styles plus Cloudflare Turnstile origins.

→ **See:** `server.ts`

### E3. Sparkline Charts (Zero-Dependency)

`SparklineComponent` renders mini line/area charts using the Canvas 2D API — no chart library required. Accepts `data`, `color`, `filled`, `width`, and `height` inputs. Integrated into the Performance dashboard for latency trends.

→ **See:** `sparkline/sparkline.component.ts`, `performance/performance.component.ts`

### E4. Web Worker (Off-Thread Parsing)

`filter-parser.worker.ts` parses large filter lists on a background thread. `FilterParserService` wraps `Worker` with signal-based `result`, `isParsing`, `progress`, and `error` state. Wired into the Compiler to handle file drag-and-drop.

→ **See:** `workers/filter-parser.worker.ts`, `services/filter-parser.service.ts`

### E5. `@defer` with `prefetch on hover`

Home page navigation cards use `@defer (on viewport; prefetch on hover)` so the chunk for each card's full component is prefetched when the user hovers, making navigation feel instant. Skeleton placeholders show during load.

→ **See:** `home/home.component.ts`

### E6. CDK Virtual Scrolling

The Compiler's SSE stream log and the Admin's SQL results table use `<cdk-virtual-scroll-viewport>` from `@angular/cdk/scrolling` to efficiently render thousands of rows with fixed-height recycling.

→ **See:** `compiler/compiler.component.ts`, `admin/admin.component.ts`

### E7. `httpResource()` Migration

`PerformanceComponent` and `ApiDocsComponent` use Angular 21's `httpResource()` (from `@angular/common/http`) for declarative, signal-native HTTP fetching — replacing the manual `rxResource` + `HttpClient` pattern.

→ **See:** `performance/performance.component.ts`, `api-docs/api-docs.component.ts`

### E8. Signal-Based Form Wrappers

Reactive Forms in `CompilerComponent` are bridged to signals using `effect()` + `subscription` for `valueChanges` and `statusChanges`. This provides `formValue()` and `formValid()` signals for template consumption.

→ **See:** `compiler/compiler.component.ts`

### E9. MetricsStore (Shared Singleton Signal Store)

`MetricsStore` is a shared injectable providing `metrics()`, `health()`, `isLoading()`, and `isStale()` signals. Home and Performance components consume the same store instance, avoiding duplicate HTTP calls.

→ **See:** `store/metrics.store.ts`, `home/home.component.ts`, `performance/performance.component.ts`

### E10. PWA / Service Worker

`@angular/service-worker` is registered in `app.config.ts`. `ngsw-config.json` defines prefetch and lazy caching groups for app shell assets and API responses with a 1-hour max-age.

→ **See:** `ngsw-config.json`, `app.config.ts`

### E11. E2E Playwright Tests

End-to-end tests in `e2e/` cover home page rendering, compiler form interaction, and navigation flows. Configuration in `playwright.config.ts` targets the dev server at `localhost:4200`.

→ **See:** `e2e/playwright.config.ts`, `e2e/home.spec.ts`, `e2e/compiler.spec.ts`, `e2e/navigation.spec.ts`

### E12. SWR Cache (Stale-While-Revalidate)

`SwrCacheService` provides a generic, signal-based SWR cache. `get()` returns stale data immediately while revalidating in the background. Integrated into `MetricsStore` for seamless cache-then-refresh behavior.

→ **See:** `services/swr-cache.service.ts`, `store/metrics.store.ts`

### E13. Skeleton Loading States

`SkeletonCardComponent` and `SkeletonTableComponent` render animated shimmer placeholders with configurable line counts, widths, rows, and columns. Used in Home, Performance, and Admin as loading fallbacks.

→ **See:** `skeleton/skeleton-card.component.ts`, `skeleton/skeleton-table.component.ts`

### E14. Error Boundaries

`GlobalErrorHandler` extends Angular's `ErrorHandler`, storing the last error and history in signals. `ErrorBoundaryComponent` reads these signals and renders a dismissible error toast with "Reload Page" action. Registered globally in `app.config.ts`.

→ **See:** `error/global-error-handler.ts`, `error/error-boundary.component.ts`, `app.config.ts`

---

## Cloudflare Workers Deployment

The SSR server (`server.ts`) uses Angular 21's `AngularAppEngine` with the standard fetch API — no Express, no Node.js HTTP server. This architectural shift delivers several key benefits:

- **Edge compatibility** — runs in any [WinterCG](https://wintercg.org/)-compliant runtime (Cloudflare Workers, Deno Deploy, Fastly Compute) with no code changes
- **Faster cold starts** — no Express middleware chain, no Node.js HTTP server initialisation; the Worker isolate boots in milliseconds
- **Zero-overhead static assets** — JS, CSS, and fonts are served by Cloudflare's CDN via the `ASSETS` binding before the Worker is invoked, so Angular's SSR handler only processes HTML requests
- **Global distribution** — Workers deploy to 300+ edge locations automatically, reducing time-to-first-byte worldwide

```typescript
// server.ts (edge-compatible)
const angularApp = new AngularAppEngine();

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const response = await angularApp.handle(request);
        return response ?? new Response('Not found', { status: 404 });
    },
} satisfies ExportedHandler<Env>;
```

Static assets are served directly from Cloudflare's CDN via the `ASSETS` binding in `wrangler.toml` — the Worker only processes HTML (SSR) requests.

```bash
# Build then preview locally (mirrors production behaviour)
npm run build
npm run preview        # wrangler dev → http://localhost:8787

# Deploy to Cloudflare Workers
npm run deploy         # wrangler deploy
```

→ **See:** `server.ts`, `wrangler.toml`

---

| Feature | Before (v16) | Angular 21 |
|---|---|---|
| Component inputs | `@Input()` decorator | `input()` / `input.required()` signal |
| Component outputs | `@Output() + EventEmitter` | `output()` signal |
| Two-way binding | `@Input()` + `@Output()Change` pair | `model()` signal |
| View queries | `@ViewChild` decorator | `viewChild()` signal |
| Async data | Observable + manual subscribe | `rxResource()` / `resource()` |
| Linked state | `effect()` writing a signal | `linkedSignal()` |
| Post-render DOM | `ngAfterViewInit` | `afterRenderEffect()` |
| App init | `APP_INITIALIZER` token | `provideAppInitializer()` |
| Observable → template | Manual `AsyncPipe` | `toSignal()` |
| Lazy rendering | None | `@defer` with triggers |
| Change detection | Zone.js | `provideZonelessChangeDetection()` |
| SSR per-route mode | All-or-nothing | `RenderMode.Prerender / Server / Client` |
| Fonts | Google Fonts CDN | `@fontsource` / `material-symbols` npm packages |
| Test runner | Karma (deprecated) | Vitest + `@analogjs/vitest-angular` |
| SSR server | Express.js (Node) | Cloudflare Workers (`AngularAppEngine` fetch handler) |
| DI | Constructor params | `inject()` functional DI |
| NgModules | Required | Standalone components (no modules) |

---

## Further Reading

- [Angular Signals Guide](https://angular.dev/guide/signals)
- [New Control Flow](https://angular.dev/guide/templates/control-flow)
- [Deferrable Views](https://angular.dev/guide/defer)
- [resource() / rxResource()](https://angular.dev/guide/signals/resource)
- [linkedSignal()](https://angular.dev/guide/signals/linked-signal)
- [afterRenderEffect()](https://angular.dev/api/core/afterRenderEffect)
- [provideAppInitializer()](https://angular.dev/api/core/provideAppInitializer)
- [SSR with Angular](https://angular.dev/guide/ssr)
- [Angular Material 3](https://material.angular.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Vitest Docs](https://vitest.dev/)
- [AnalogJS vitest-angular](https://analogjs.org/docs/testing)
- [ANGULAR_SIGNALS.md](./ANGULAR_SIGNALS.md) — deep-dive signals guide
