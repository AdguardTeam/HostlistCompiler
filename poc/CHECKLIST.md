# PoC Implementation Checklist ✅

## Files Created / Modified

### Vue PoC
- [x] `poc/vue/index.html` — Vue 3 + Pinia + Vue Router CDN single-file app
- [x] `poc/vue/VUE_PINIA.md` — Pinia state management guide

### Vue + Nuxt PoC
- [x] `poc/vue/nuxt/package.json` — Nuxt 3, @pinia/nuxt, TypeScript
- [x] `poc/vue/nuxt/nuxt.config.ts` — SSR, modules, global CSS
- [x] `poc/vue/nuxt/app.vue` — Root shell (`<AppNav>` + `<NuxtPage>`)
- [x] `poc/vue/nuxt/assets/css/main.css` — CSS variables + styles
- [x] `poc/vue/nuxt/components/AppNav.vue` — Navigation with `<NuxtLink>`
- [x] `poc/vue/nuxt/composables/useTheme.ts` — SSR-safe theme via `useState()`
- [x] `poc/vue/nuxt/stores/compiler.ts` — Typed Pinia store with SSR hydration
- [x] `poc/vue/nuxt/pages/index.vue` — Dashboard with `useAsyncData()` + presets
- [x] `poc/vue/nuxt/pages/compiler/[[preset]].vue` — Compiler form (optional preset param)
- [x] `poc/vue/nuxt/pages/store.vue` — Live Pinia state inspector
- [x] `poc/vue/nuxt/pages/ssr.vue` — SSR features showcase
- [x] `poc/vue/nuxt/pages/benchmark.vue` — `performance.now()` benchmark runner
- [x] `poc/vue/nuxt/pages/[...slug].vue` — 404 catch-all
- [x] `poc/vue/nuxt/server/api/compile.post.ts` — Nitro API route (proxy + mock)
- [x] `poc/vue/nuxt/NUXT_SSR.md` — SSR concepts guide
- [x] `poc/vue/nuxt/README.md` — Setup, structure, SSR feature list

### Angular PoC — Core
- [x] `poc/angular/package.json` — Angular 21, `@fontsource/roboto`, `material-symbols`; **removed** `@angular/platform-browser-dynamic` and Karma
- [x] `poc/angular/angular.json` — `prerender: true` enabled
- [x] `poc/angular/tsconfig.json` / `tsconfig.app.json`
- [x] `poc/angular/src/index.html` — CDN font links removed
- [x] `poc/angular/src/styles.css` — fonts from npm (`@fontsource/roboto`, `material-symbols`)
- [x] `poc/angular/src/main.ts` — `bootstrapApplication()` (no NgModule)
- [x] `poc/angular/src/main.server.ts` — SSR bootstrap
- [x] `poc/angular/server.ts` — Express SSR server

### Angular PoC — App Config
- [x] `poc/angular/src/app/app.config.ts` — **`provideAppInitializer()`** + `provideZonelessChangeDetection()`
- [x] `poc/angular/src/app/app.config.server.ts` — `mergeApplicationConfig()` + `provideServerRendering(withRoutes())`
- [x] `poc/angular/src/app/app.routes.ts` — Lazy-loaded routes with titles
- [x] `poc/angular/src/app/app.routes.server.ts` — **`RenderMode.Prerender`** for Home, `RenderMode.Server` for all others

### Angular PoC — Components
- [x] `poc/angular/src/app/app.component.ts` — **`viewChild(MatSidenav)`**, ThemeService via `inject()`
- [x] `poc/angular/src/app/home/home.component.ts` — **`StatCardComponent`** (`input/output/model`), **`@defer (on viewport)`**, `viewChild()`
- [x] `poc/angular/src/app/compiler/compiler.component.ts` — **`rxResource()`**, **`linkedSignal()`** presets, **`toSignal()`** route params
- [x] `poc/angular/src/app/benchmark/benchmark.component.ts` — **`linkedSignal()`**, **`afterRenderEffect()`**, **`viewChild()`**, **`@defer (on idle)`**
- [x] `poc/angular/src/app/signals/signals.component.ts` — `signal()`, `computed()`, `effect()` showcase

### Angular PoC — Services
- [x] `poc/angular/src/app/services/compiler.service.ts` — `Injectable` with `inject(HttpClient)`
- [x] `poc/angular/src/app/services/theme.service.ts` — **`ThemeService`** with signal state, SSR-safe, used by `provideAppInitializer()`

### Angular PoC — Shared Components
- [x] `poc/angular/src/app/stat-card/stat-card.component.ts` — **`input.required()`**, **`input()`**, **`output()`**, **`model()`** demo
- [x] `poc/angular/src/app/stat-card/stat-card.component.spec.ts` — Zoneless unit test with `provideZonelessChangeDetection()` + `setInput()`

### Documentation
- [x] `poc/angular/README.md` — Full Angular 21 feature guide with all new APIs
- [x] `poc/angular/ANGULAR_SIGNALS.md` — Signals guide extended with `linkedSignal()`, `resource()`, `afterRenderEffect()`, `provideAppInitializer()`, `viewChild()` + quick-reference table
- [x] `poc/README.md` — Rewritten with comprehensive comparison tables (core, reactivity, component API, data fetching, performance, forms, testing, DX, ecosystem)
- [x] `poc/CHECKLIST.md` — This file
- [x] `poc/SUMMARY.md` — Implementation summary

---

## Angular 21 Features Checklist

### 🔴 Critical (Signal Component API)
- [x] `input()` / `input.required()` — signal inputs in `StatCardComponent`
- [x] `output()` — signal output in `StatCardComponent`
- [x] `model()` — two-way writable signal in `StatCardComponent`
- [x] `viewChild()` — in `AppComponent`, `HomeComponent`, `BenchmarkComponent`

### 🔴 Critical (@defer)
- [x] `@defer (on viewport)` — feature highlights card in `HomeComponent`
- [x] `@defer (on idle)` — summary stats card in `BenchmarkComponent`
- [x] `@placeholder` blocks in both `@defer` uses
- [x] `@loading` block in `HomeComponent`

### 🔴 Critical (resource() / rxResource())
- [x] `rxResource()` in `CompilerComponent` replacing Observable + loading/error/result signals

### 🟡 Medium (linkedSignal)
- [x] `linkedSignal()` in `CompilerComponent` for preset-driven URL defaults
- [x] `linkedSignal()` in `BenchmarkComponent` for preset-driven transformation defaults

### 🟡 Medium (afterRenderEffect)
- [x] `afterRenderEffect()` in `BenchmarkComponent` for post-render table height measurement

### 🟡 Medium (provideAppInitializer)
- [x] `ThemeService` extracted with `signal` state
- [x] `provideAppInitializer()` in `app.config.ts` initialising `ThemeService`

### 🟡 Medium (toSignal)
- [x] `toSignal()` in `CompilerComponent` for route queryParamMap

### 🟡 Medium (Test migration)
- [x] Karma devDependencies removed from `package.json`
- [x] `stat-card.component.spec.ts` with zoneless `TestBed` + `setInput()`
- [x] Migration path documented in `README.md` and `spec.ts` comments

### 🟢 Low (Cleanup)
- [x] `@angular/platform-browser-dynamic` removed from `package.json`
- [x] `@fontsource/roboto` + `material-symbols` added to `package.json`
- [x] CDN font links removed from `index.html`
- [x] `styles.css` updated to import fonts from npm
- [x] `angular.json` `prerender: true` enabled
- [x] `app.routes.server.ts` uses `RenderMode.Prerender` for Home route

---

## Status: ✅ ALL REQUIREMENTS MET

Ready for evaluation and framework selection decision.


### Vue + Nuxt PoC

- [x] `poc/vue/nuxt/package.json` - Nuxt 3, @pinia/nuxt, TypeScript dependencies
- [x] `poc/vue/nuxt/nuxt.config.ts` - SSR, modules, global CSS, head config
- [x] `poc/vue/nuxt/app.vue` - Root component (`<AppNav>` + `<NuxtPage>`)
- [x] `poc/vue/nuxt/assets/css/main.css` - Shared CSS variables + component styles
- [x] `poc/vue/nuxt/components/AppNav.vue` - Navigation with `<NuxtLink>`
- [x] `poc/vue/nuxt/composables/useTheme.ts` - SSR-safe theme via `useState()`
- [x] `poc/vue/nuxt/stores/compiler.ts` - Typed Pinia store with SSR hydration
- [x] `poc/vue/nuxt/pages/index.vue` - Dashboard with `useAsyncData()` + presets
- [x] `poc/vue/nuxt/pages/compiler/[[preset]].vue` - Compiler form (optional preset param)
- [x] `poc/vue/nuxt/pages/store.vue` - Live Pinia state inspector
- [x] `poc/vue/nuxt/pages/ssr.vue` - SSR features showcase + comparison table
- [x] `poc/vue/nuxt/pages/benchmark.vue` - `performance.now()` benchmark runner
- [x] `poc/vue/nuxt/pages/[...slug].vue` - 404 catch-all
- [x] `poc/vue/nuxt/server/api/compile.post.ts` - Nitro API route (proxy + mock fallback)
- [x] `poc/vue/nuxt/NUXT_SSR.md` - Comprehensive SSR concepts guide
- [x] `poc/vue/nuxt/README.md` - Setup, structure, SSR feature list

### Angular PoC

- [x] `poc/angular/package.json` - Dependencies
- [x] `poc/angular/angular.json` - Workspace config
- [x] `poc/angular/tsconfig.json` - TypeScript config
- [x] `poc/angular/tsconfig.app.json` - App TypeScript config
- [x] `poc/angular/src/index.html` - HTML entry
- [x] `poc/angular/src/main.ts` - Bootstrap
- [x] `poc/angular/src/styles.css` - Global styles
- [x] `poc/angular/src/app/app.component.ts` - Root component
- [x] `poc/angular/src/app/app.routes.ts` - Routes
- [x] `poc/angular/src/app/home/home.component.ts` - Home page
- [x] `poc/angular/src/app/compiler/compiler.component.ts` - Compiler page
- [x] `poc/angular/src/app/signals/signals.component.ts` - Signals demo page
- [x] `poc/angular/src/app/benchmark/benchmark.component.ts` - Benchmark page
- [x] `poc/angular/src/app/services/compiler.service.ts` - API service
- [x] `poc/angular/ANGULAR_SIGNALS.md` - Angular Signals guide

### Documentation

- [x] `poc/README.md` - Main overview (Vue, Vue+Nuxt, Angular)
- [x] `poc/SUMMARY.md` - Implementation summary
- [x] `poc/angular/README.md` - Angular setup guide
- [x] `poc/vue/nuxt/README.md` - Nuxt setup and SSR feature list
- [x] `poc/vue/nuxt/NUXT_SSR.md` - SSR concepts guide

## Features Implemented

### All Implementations

- [x] Component-based architecture
- [x] Client-side routing (Home ↔ Compiler)
- [x] Dark/light theme toggle
- [x] Theme persistence (localStorage)
- [x] Navigation with active link highlighting
- [x] Home/Dashboard page with stats cards
- [x] Compiler form page
- [x] Benchmark page (`/benchmark` route) with `performance.now()` timing, progress bar, results table, and summary statistics (min/max/avg)

### Vue CDN-Specific Features

- [x] Pinia state management store
- [x] StoreInspectorPage component
- [x] Store route (`/store`)
- [x] CompilerPage using Pinia store

### Vue + Nuxt-Specific Features

- [x] Server-Side Rendering (SSR) enabled by default
- [x] `useAsyncData()` for SSR-hydrated data (zero loading flash)
- [x] `useState()` for SSR-safe shared state (theme, avoids hydration mismatch)
- [x] `useHead()` for server-rendered `<title>` and `<meta>` tags on every page
- [x] `@pinia/nuxt` for automatic Pinia state SSR hydration
- [x] `$fetch()` isomorphic fetch utility
- [x] File-based routing (`pages/` directory, `[[preset]]` optional param, `[...slug]` catch-all)
- [x] Auto-imports for Vue and Nuxt composables
- [x] `server/api/compile.post.ts` — Nitro API route (proxy + mock fallback)
- [x] `/ssr` route — SSR features showcase with comparison table
- [x] TypeScript strict mode throughout

### Angular-Specific Features

- [x] Signals component (`/signals`)
- [x] signal(), computed(), effect() demonstrations
- [x] New @if/@for/@switch template syntax
- [x] Conversion of all components to new syntax
- [x] Zoneless change detection (`provideZonelessChangeDetection()`)

### Compiler Form Features

- [x] Dynamic URL input list (add/remove)
- [x] 11 transformation checkboxes:
  - [x] RemoveComments
  - [x] Compress
  - [x] RemoveModifiers
  - [x] Validate
  - [x] ValidateAllowIp
  - [x] Deduplicate
  - [x] InvertAllow
  - [x] RemoveEmptyLines
  - [x] TrimLines
  - [x] InsertFinalNewLine
  - [x] ConvertToAscii
- [x] Form validation
- [x] Submit button with loading state
- [x] Loading spinner during API call
- [x] Error state handling
- [x] Results display
- [x] Mock data fallback

### Styling & Design

- [x] Consistent color scheme (#667eea → #764ba2)
- [x] CSS custom properties for theming
- [x] Responsive layouts
- [x] Hover effects
- [x] Smooth transitions
- [x] Mobile-friendly design

### Code Quality

- [x] Comprehensive comments in all files
- [x] Architecture patterns explained
- [x] Clean, readable code
- [x] Proper error handling
- [x] Type safety (Angular, Vue)
- [x] Following framework best practices

## API Integration

- [x] POST /api/compile endpoint
- [x] Correct request payload format:
  ```json
  {
    "configuration": {
      "name": "...",
      "sources": [{"source": "..."}],
      "transformations": [...]
    },
    "benchmark": true
  }
  ```
- [x] Response handling
- [x] Mock data for demo purposes

## Documentation Quality

- [x] Main README with overview
- [x] Comparison table (Vue CDN / Vue+Nuxt / Angular)
- [x] How to run instructions
- [x] Framework recommendations
- [x] Angular-specific documentation
- [x] Nuxt-specific documentation (`NUXT_SSR.md`)
- [x] Implementation summary
- [x] Code examples
- [x] Learning resources

## Testing Instructions

- [x] Vue CDN: Open in browser or serve with http-server
- [x] Vue + Nuxt: `cd poc/vue/nuxt && npm install && npm run dev`
- [x] Angular: `cd poc/angular && npm install && npm start`

## Status

✅ **ALL REQUIREMENTS MET**

Ready for evaluation: YES
