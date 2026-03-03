# Frontend Framework Migration — Proof of Concept

This directory contains two proof-of-concept implementations for migrating the Adblock Compiler frontend away from its current vanilla HTML/CSS/JS stack. The goal is to choose a modern framework for the production migration.

## PoC Implementations

| PoC | Stack | Directory |
|---|---|---|
| **Vue CDN** | Vue 3 + Pinia (no build step) | `vue/index.html` |
| **Nuxt 3** | Vue 3 + Pinia + SSR (full project) | `vue/nuxt/` |
| **Angular 21** | Angular + Material 3 + SSR + full signal API | `angular/` |

---

## How to Run

### Vue CDN
```bash
cd poc/vue
python3 -m http.server 8001   # or: npx http-server
# Visit: http://localhost:8001
```

### Nuxt 3
```bash
cd poc/vue/nuxt
npm install
npm run dev    # → http://localhost:3000
```

### Angular 21
```bash
cd poc/angular
npm install
npm start      # CSR dev server → http://localhost:4200
```

---

## Detailed Feature Comparison

### Core Framework Capabilities

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Rendering** | Client-only (CSR) | Server + Client (SSR) | Server + Client (SSR) |
| **Prerendering (SSG)** | ❌ | ✅ `nuxt generate` | ✅ `RenderMode.Prerender` per route |
| **Mixed SSR/SSG per route** | ❌ | ✅ `routeRules` | ✅ `ServerRoute[]` per-path |
| **File-based routing** | ❌ Manual `routes[]` | ✅ `pages/` directory | ❌ Manual `routes.ts` |
| **Build step required** | ❌ None (CDN) | ✅ `npm run build` | ✅ `ng build` |
| **TypeScript** | Optional (JSDoc) | ✅ Strict | ✅ Required |
| **Bundle strategy** | CDN global script | Tree-shaken chunks | Tree-shaken chunks |
| **Language** | JavaScript + JSDoc | TypeScript | TypeScript |

### Reactivity & State

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Reactive primitive** | `ref()` / `reactive()` | `ref()` / `reactive()` | `signal()` |
| **Derived state** | `computed()` | `computed()` | `computed()` |
| **Side effects** | `watch()` / `watchEffect()` | `watch()` / `watchEffect()` | `effect()` |
| **Linked/derived writable state** | `ref()` + `watch()` | `ref()` + `watch()` | ✅ `linkedSignal()` |
| **State management** | Pinia (official) | Pinia + SSR hydration | Services + RxJS + signals |
| **SSR state hydration** | ❌ | ✅ `@pinia/nuxt` auto-hydrates stores | ✅ Express transfer state |
| **Two-way component binding** | `v-model` / `defineModel()` | `defineModel()` | ✅ `model()` signal |
| **Change detection** | Fine-grained (Proxy) | Fine-grained (Proxy) | Zoneless signals (no Zone.js) |

### Component API

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Component inputs** | `defineProps()` | `defineProps()` | `input()` / `input.required()` |
| **Component outputs** | `defineEmits()` | `defineEmits()` | `output()` |
| **Two-way model** | `defineModel()` (v3.4+) | `defineModel()` | `model()` |
| **Template queries** | `useTemplateRef()` (v3.5+) | `useTemplateRef()` | `viewChild()` / `viewChildren()` |
| **Dependency injection** | `provide()` / `inject()` | `provide()` / `inject()` | `inject()` functional DI |
| **Lifecycle hooks** | `onMounted`, `onUnmounted`, etc. | Same as Vue | `ngOnInit`, `afterRenderEffect()`, etc. |
| **Post-render DOM effects** | `onMounted()` / `nextTick()` | Same as Vue | ✅ `afterRenderEffect()` (v20+) |

### Data Fetching & HTTP

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **HTTP client** | Fetch API (manual) | `$fetch()` (isomorphic) | `HttpClient` (RxJS) |
| **Signal-native async** | ❌ Manual loading/error | ✅ `useAsyncData()` / `useFetch()` | ✅ `resource()` / `rxResource()` |
| **SSR data fetching** | ❌ Client-only | ✅ Fetched on server, embedded in HTML | ✅ `TransferState` |
| **Observable streams** | ❌ | ❌ (uses Promises) | ✅ RxJS full operator suite |
| **Auto-unsubscribe** | N/A (Promises) | N/A | ✅ `takeUntilDestroyed()` / `toSignal()` |
| **Retry / debounce / switchMap** | Manual | Manual | ✅ RxJS operators |
| **Server API routes** | ❌ External backend | ✅ `server/api/` (Nitro built-in) | ❌ External backend |

### Performance & Rendering

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Lazy route loading** | ✅ `() => import()` | ✅ Automatic (file-based) | ✅ `loadComponent()` |
| **Deferred rendering** | ❌ | ❌ | ✅ `@defer` with triggers |
| **Incremental hydration** | ❌ | ✅ (Nuxt 3.12+ `LazyHydration`) | ✅ `@defer` with SSR |
| **View Transitions API** | Manual | `app.vue` transitions | ✅ `withViewTransitions()` |
| **SEO / meta tags** | ❌ Static `<title>` | ✅ `useHead()` / `useSeoMeta()` — SSR | ✅ Route `title` property |
| **Initial paint** | Blank until JS | ✅ Full HTML from server | ✅ Full HTML from server |
| **CDN font requests** | 2 (Google Fonts) | Configurable | ✅ 0 (npm: `@fontsource` + `material-symbols`) |

### Forms

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Form binding** | `v-model` | `v-model` | `ReactiveFormsModule` |
| **Dynamic controls** | Manual array | Manual array | ✅ `FormArray` / `FormBuilder` |
| **Built-in validation** | HTML5 + manual | HTML5 + manual | ✅ `Validators.*` |
| **Form groups** | Manual object | Manual object | ✅ `FormGroup` |
| **Control error states** | Manual | Manual | ✅ `.hasError()` / `<mat-error>` |

### Testing

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Recommended test runner** | Vitest | Vitest | Web Test Runner / Jest (Karma deprecated) |
| **Component testing** | `@vue/test-utils` | `@vue/test-utils` + `@nuxt/test-utils` | `TestBed` |
| **Zoneless testing** | N/A | N/A | ✅ `provideZonelessChangeDetection()` in TestBed |
| **Signal input in tests** | `setProps()` | `setProps()` | ✅ `fixture.componentRef.setInput()` |
| **Spec files in PoC** | ❌ | ❌ | ✅ `stat-card.component.spec.ts` |

### Developer Experience

| Feature | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Learning curve** | 🟢 Easy | 🟢 Easy (same Vue API) | 🔴 Steep |
| **Boilerplate** | Minimal | Minimal | Moderate |
| **Error messages** | Good | Good | Excellent (strict templates) |
| **DevTools** | Vue DevTools | Vue DevTools + Nuxt DevTools | Angular DevTools |
| **CLI** | None needed | Nuxt CLI | `@angular/cli` |
| **Hot module reload** | ✅ (via CDN) | ✅ Nuxt HMR | ✅ `ng serve` |
| **Strict type-checking** | JSDoc only | ✅ `vue-tsc` | ✅ `ngc` with `strictTemplates` |
| **IDE support** | VSCode + Volar | VSCode + Volar | VSCode + Angular Language Service |

### Corporate & Ecosystem

| Factor | Vue CDN / Nuxt 3 | Angular 21 |
|---|---|---|
| **Primary sponsor** | Independent (Evan You) | Google |
| **Enterprise adoption** | Growing | Very high |
| **Job market** | Large | Very large |
| **Release cadence** | ~6 months | Every 6 months (predictable) |
| **LTS support** | 18 months per major | 18 months per major |
| **Breaking changes** | Rare | Rare (strict semver) |
| **UI component library** | Vuetify / PrimeVue (separate) | ✅ Angular Material (official) |

---

## Angular 21 Modern APIs — Complete List

All APIs below are demonstrated live in `poc/angular/`:

| API | Version Introduced | Where in PoC | What It Replaces |
|---|---|---|---|
| `signal()` | v16 | All components | Class field + `markForCheck()` |
| `computed()` | v16 | All components | Getter + `markForCheck()` |
| `effect()` | v17 | `signals.component.ts` | `ngOnInit` + subscribe |
| `@if` / `@for` / `@switch` | v17 | All templates | `*ngIf`, `*ngFor`, `*ngSwitch` |
| `@defer` (on viewport, on idle) | v17 | `home`, `benchmark` | None (new capability) |
| `viewChild()` | v17.3 | `app`, `home`, `benchmark` | `@ViewChild` decorator |
| `input()` / `input.required()` | v19 | `stat-card.component.ts` | `@Input()` decorator |
| `output()` | v19 | `stat-card.component.ts` | `@Output() + EventEmitter` |
| `model()` | v19 | `stat-card.component.ts` | `@Input()` + `@Output()Change` |
| `linkedSignal()` | v19 | `compiler`, `benchmark` | `effect()` writing a signal |
| `resource()` / `rxResource()` | v19 | `compiler.component.ts` | Observable + manual subscribe |
| `provideAppInitializer()` | v19 | `app.config.ts` | `APP_INITIALIZER` token |
| `toSignal()` | v16 | `compiler.component.ts` | `AsyncPipe` / manual subscribe |
| `afterRenderEffect()` | v20 | `benchmark.component.ts` | `ngAfterViewInit` + DOM access |
| `RenderMode.Prerender` | v17 | `app.routes.server.ts` | `prerender: true` (all routes) |
| `provideZonelessChangeDetection()` | v18 | `app.config.ts` | Zone.js |
| `ThemeService` + `provideAppInitializer()` | v19 | `theme.service.ts` | Inline `ngOnInit` theme init |
| `@fontsource` / `material-symbols` (npm) | — | `styles.css` | Google Fonts CDN links |
| Karma removed | v20 | `package.json` | Karma test runner (deprecated) |
| `@angular/platform-browser-dynamic` removed | v15+ | `package.json` | Legacy NgModule bootstrap |

---

## Migration Path Recommendations

### Choose **Vue CDN** if:
- ✅ Zero build step required
- ✅ Embedding into an existing HTML page
- ✅ Prototyping with no SSR or SEO requirements
- ❌ Not suitable for production migration of the Adblock Compiler

### Choose **Nuxt 3** if:
- ✅ Vue's easy, gentle learning curve is the team's priority
- ✅ SSR and SEO meta tags are required
- ✅ Full-stack setup (frontend + API routes in one repo) is desired
- ✅ File-based routing is preferred over manual route config
- ✅ Cloudflare Pages / Vercel / Netlify deployment is planned
- ✅ Pinia state management is a priority
- ✅ Team has existing Vue.js experience

### Choose **Angular 21** if:
- ✅ Building a large-scale, long-lived enterprise application
- ✅ Team consistency and enforced structure are priorities
- ✅ Strongly opinionated, "batteries included" framework is preferred
- ✅ Angular Material's official component library is desired
- ✅ Google's backing and Angular LTS cadence are important
- ✅ TypeScript is a firm requirement
- ✅ Showcasing the latest reactive patterns (signals, resource, defer) matters
- ✅ Existing team has Angular experience

---

## Existing App Analysis

### Current Stack
- Multi-page application (`compiler.html`, `index.html`, `admin-storage.html`, `test.html`)
- Vanilla JavaScript with manual DOM manipulation
- CSS Custom Properties for theming
- Chart.js for visualization
- No build step — direct HTML/CSS/JS

### Migration Benefits (All Frameworks)
1. **SPA** — No page reloads, faster navigation
2. **Component reusability** — DRY principle, maintainable code
3. **State management** — Predictable data flow
4. **Developer experience** — HMR, debugging tools, linting
5. **Testing** — Unit + integration tests
6. **Type safety** — Fewer runtime errors
7. **Performance** — Code splitting, lazy loading, SSR

---

## API Contract (Both PoCs)

**Endpoint:** `POST /api/compile`

**Request:**
```json
{
    "configuration": {
        "name": "Filter List Name",
        "sources": [{ "source": "https://example.com/filters.txt" }],
        "transformations": ["RemoveComments", "Deduplicate", "TrimLines"]
    },
    "benchmark": true
}
```

**Response:**
```json
{
    "success": true,
    "ruleCount": 1234,
    "sources": 1,
    "transformations": ["RemoveComments", "Deduplicate"],
    "benchmark": { "duration": "123ms", "rulesPerSecond": 10000 }
}
```

**Available Transformations:**
`RemoveComments`, `Compress`, `RemoveModifiers`, `Validate`, `ValidateAllowIp`,
`Deduplicate`, `InvertAllow`, `RemoveEmptyLines`, `TrimLines`, `InsertFinalNewLine`, `ConvertToAscii`

---

## Further Reading

- [Angular PoC README](./angular/README.md) — full Angular 21 feature guide
- [ANGULAR_SIGNALS.md](./angular/ANGULAR_SIGNALS.md) — deep-dive signals reference
- [Nuxt PoC README](./vue/nuxt/README.md) — Nuxt 3 setup and SSR patterns
- [NUXT_SSR.md](./vue/nuxt/NUXT_SSR.md) — SSR concepts guide
- [VUE_PINIA.md](./vue/VUE_PINIA.md) — Pinia state management guide
- [docs/SPA_BENEFITS.md](../docs/SPA_BENEFITS.md) — full SPA migration analysis

