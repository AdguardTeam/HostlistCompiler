# Angular 21 PoC — Adblock Compiler

A proof-of-concept Angular 21 application that is a **complete showcase of every major modern Angular API**. It uses Angular Material 3, zoneless change detection, and Server-Side Rendering (SSR).

---

## 🚀 How to Run

```bash
cd poc/angular
npm install
npm start              # CSR dev server  → http://localhost:4200
npm run serve:ssr      # SSR dev server  → http://localhost:4000 (after npm run build)
npm run build          # Production SSR + prerender build
```

---

## Technology Stack

| Technology | Version | Role |
|---|---|---|
| **Angular** | ^21.0.0 | Application framework |
| **Angular Material** | ^21.0.0 | Material Design 3 component library |
| **@angular/ssr** | ^21.0.0 | Server-Side Rendering (Express adapter) |
| **RxJS** | ~7.8.2 | Async streams (HTTP, route params) |
| **TypeScript** | ~5.8.0 | Type safety throughout |
| **@fontsource/roboto** | ^5.x | Roboto font — npm package, no CDN |
| **material-symbols** | ^0.31.0 | Material Symbols icon font — npm package, no CDN |

---

## Project Structure

```
src/
├── app/
│   ├── app.component.ts        # Root shell — viewChild(), ThemeService
│   ├── app.config.ts           # Browser providers — provideAppInitializer()
│   ├── app.config.server.ts    # SSR providers — mergeApplicationConfig()
│   ├── app.routes.ts           # Lazy-loaded routes with titles
│   ├── app.routes.server.ts    # Per-route SSR mode (Prerender / Server)
│   │
│   ├── benchmark/
│   │   └── benchmark.component.ts  # linkedSignal(), afterRenderEffect(), @defer
│   ├── compiler/
│   │   └── compiler.component.ts   # rxResource(), linkedSignal(), toSignal()
│   ├── home/
│   │   └── home.component.ts       # StatCardComponent, @defer on viewport
│   ├── signals/
│   │   └── signals.component.ts    # signal(), computed(), effect() showcase
│   │
│   ├── services/
│   │   ├── compiler.service.ts     # Injectable with inject(), Observable HTTP
│   │   └── theme.service.ts        # ThemeService — signal state, SSR-safe
│   │
│   └── stat-card/
│       ├── stat-card.component.ts  # input(), output(), model() signal APIs
│       └── stat-card.component.spec.ts  # Zoneless unit test with setInput()
│
├── index.html      # No CDN font links (fonts loaded from npm)
├── main.ts         # bootstrapApplication()
├── main.server.ts  # Server bootstrap
└── styles.css      # @fontsource/roboto + material-symbols imports
server.ts           # Express SSR server
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

### 16. Zoneless Unit Testing

```typescript
// stat-card.component.spec.ts
await TestBed.configureTestingModule({
    imports: [StatCardComponent],
    providers: [provideZonelessChangeDetection()],   // zoneless in tests too
}).compileComponents();

fixture.componentRef.setInput('label', 'Filter Lists');  // signal input setter
await fixture.whenStable();                              // flush microtask scheduler
```

→ **See:** `stat-card/stat-card.component.spec.ts`

---

## Angular 21 vs Previous Versions

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
| Test runner | Karma (deprecated) | Web Test Runner / Jest (migration path) |
| DI | Constructor params | `inject()` functional DI |
| NgModules | Required | Standalone components (no modules) |

---

## Karma → Web Test Runner Migration

The legacy Karma runner is deprecated in Angular 20+. Karma devDependencies have been removed from `package.json`. To complete the migration:

```bash
# Option A: Angular's experimental Web Test Runner
ng add @angular/build@next   # adds @angular/build:web-test-runner builder

# Option B: Jest
npm install --save-dev jest @types/jest jest-preset-angular
```

Then update the `"test"` target in `angular.json` to use the new builder.

The existing `stat-card.component.spec.ts` is compatible with both runners.

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
- [ANGULAR_SIGNALS.md](./ANGULAR_SIGNALS.md) — deep-dive signals guide
