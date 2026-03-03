# Framework Migration PoC — Implementation Summary

## Overview

Two production-viable framework stacks have been implemented as proof of concepts for the Adblock Compiler frontend migration. This document summarises what was built, the key patterns demonstrated, and how to make the final framework decision.

---

## PoC 1: Vue 3 CDN (no build step)

**File:** `poc/vue/index.html` (~1,400 lines)

A single-file Vue 3 application loaded via CDN — no build step, no Node.js required.

### Patterns Demonstrated

| Pattern | API Used |
|---|---|
| Reactive state | `ref()`, `reactive()` |
| Derived state | `computed()` |
| Side effects | `watch()`, `watchEffect()` |
| Component composition | Composition API + `setup()` |
| Routing | Vue Router 4 |
| State management | Pinia (official Vue store) |
| Two-way binding | `v-model` |
| Reusable logic | Composables (`useTheme()`) |
| Type safety | JSDoc `@ts-check` annotations |

### Verdict

✅ Great for prototyping and embedding  
❌ Not recommended for production migration (no SSR, no build optimisation)

---

## PoC 2: Nuxt 3 (SSR, full project)

**Directory:** `poc/vue/nuxt/`

A full Nuxt 3 project with SSR, file-based routing, Pinia, and Nitro API routes.

### Key SSR Patterns

| Pattern | API | Benefit |
|---|---|---|
| Server data fetch | `useAsyncData()` | Zero loading flash — data in HTML |
| SSR-safe state | `useState()` | No hydration mismatch |
| SEO meta tags | `useHead()` / `useSeoMeta()` | Crawlable on every page |
| Pinia SSR hydration | `@pinia/nuxt` | Store state serialised into HTML |
| Isomorphic fetch | `$fetch()` | Same code on server and client |
| File-based routing | `pages/` directory | Auto-routes, optional params |
| Built-in API routes | `server/api/*.ts` (Nitro) | No CORS, no external backend |

### Routes Implemented

| Route | File | Demonstrates |
|---|---|---|
| `/` | `pages/index.vue` | `useAsyncData()`, `useHead()`, preset cards |
| `/compiler/:preset?` | `pages/compiler/[[preset]].vue` | Optional route param, Pinia form state |
| `/store` | `pages/store.vue` | Live Pinia state inspector |
| `/ssr` | `pages/ssr.vue` | SSR features showcase, comparison table |
| `/benchmark` | `pages/benchmark.vue` | `performance.now()` benchmark |
| `/*` | `pages/[...slug].vue` | 404 catch-all |

### Verdict

✅ Best choice if the team wants Vue's easy learning curve with production SSR  
✅ Full-stack in one repo (frontend + API routes)  
✅ Strong Cloudflare Pages / Vercel deployment story

---

## PoC 3: Angular 21 (Full Modern API Showcase)

**Directory:** `poc/angular/`

A complete Angular 21 application demonstrating **every major modern Angular API** released in v17–v21. Uses Angular Material 3, zoneless change detection, and multi-mode SSR.

### Angular 21 APIs Demonstrated

| API | Stability | Component | What It Replaces |
|---|---|---|---|
| `signal()` / `computed()` / `effect()` | v16 | All | Class fields + Zone.js |
| `@if` / `@for` / `@switch` | v17 | All templates | `*ngIf`, `*ngFor`, `*ngSwitch` |
| `@defer (on viewport)` | v17 | `home` | None — new capability |
| `@defer (on idle)` | v17 | `benchmark` | None — new capability |
| `viewChild()` | v17.3 | `app`, `home`, `benchmark` | `@ViewChild` |
| `input()` / `input.required()` | v19 | `stat-card` | `@Input()` |
| `output()` | v19 | `stat-card` | `@Output() + EventEmitter` |
| `model()` | v19 | `stat-card` | `@Input()` + `@Output()Change` pair |
| `linkedSignal()` | v19 | `compiler`, `benchmark` | `effect()` writing signals |
| `rxResource()` | v19 | `compiler` | Observable + manual subscribe |
| `provideAppInitializer()` | v19 | `app.config.ts` | `APP_INITIALIZER` token |
| `toSignal()` | v16 | `compiler` | `AsyncPipe` / manual subscribe |
| `takeUntilDestroyed()` | v16 | `compiler` | `Subject<void>` + `ngOnDestroy` |
| `afterRenderEffect()` | v20 | `benchmark` | `ngAfterViewInit` + DOM access |
| `provideZonelessChangeDetection()` | v18 | `app.config.ts` | Zone.js |
| `RenderMode.Prerender` | v17 | `app.routes.server.ts` | All-routes SSR |
| Fonts from npm | — | `styles.css` | Google Fonts CDN |
| Karma removed | v20 | `package.json` | Legacy test runner |

### Pages Implemented

| Route | Component | Key Patterns |
|---|---|---|
| `/` | `HomeComponent` | `StatCardComponent` (signal API), `@defer (on viewport)`, `viewChild()` |
| `/compiler` | `CompilerComponent` | `rxResource()`, `linkedSignal()`, `toSignal()`, presets |
| `/signals` | `SignalsComponent` | `signal()`, `computed()`, `effect()` interactive demo |
| `/benchmark` | `BenchmarkComponent` | `linkedSignal()`, `afterRenderEffect()`, `viewChild()`, `@defer (on idle)` |

### Material Design 3 Components Used

`MatToolbar`, `MatSidenav`, `MatCard`, `MatButton`, `MatIcon`, `MatFormField`, `MatInput`, `MatSelect`, `MatCheckbox`, `MatChips`, `MatTable`, `MatProgressBar`, `MatProgressSpinner`, `MatDivider`, `MatList`, `MatRipple`, `MatTooltip`, `MatBadge`

### Verdict

✅ Best choice for enterprise-scale, long-lived application  
✅ Complete "batteries included" solution  
✅ Most comprehensive modern Angular showcase  
⚠️ Steeper learning curve than Vue/Nuxt

---

## Side-by-Side Summary

| Aspect | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| **Lines of Code** | ~1,400 (1 file) | ~900 (16 files) | ~3,000 (20+ files) |
| **Build Required** | No | Yes | Yes |
| **Setup Time** | 0 min | 5 min | 5 min |
| **Learning Curve** | Easy | Easy | Steep |
| **Type Safety** | JSDoc | Strict TS | Required TS |
| **SSR** | ❌ | ✅ Built-in | ✅ @angular/ssr |
| **SSG/Prerender** | ❌ | ✅ `nuxt generate` | ✅ per-route `RenderMode` |
| **File-based routing** | ❌ | ✅ | ❌ |
| **Built-in API routes** | ❌ | ✅ Nitro | ❌ |
| **State management** | Pinia | Pinia + SSR hydration | Services + signals |
| **Signal-native HTTP** | ❌ | ✅ `useAsyncData()` | ✅ `rxResource()` |
| **Linked/derived writable state** | Manual `watch()` | Manual `watch()` | ✅ `linkedSignal()` |
| **Deferred rendering** | ❌ | ✅ `LazyHydration` (3.12+) | ✅ `@defer` |
| **Official UI library** | ❌ (external) | ❌ (external) | ✅ Angular Material 3 |
| **Zoneless** | N/A | N/A | ✅ `provideZonelessChangeDetection()` |
| **Corporate backing** | Independent | Independent | Google |

---

## Decision Criteria

### Framework Fit Matrix

| Priority | Vue CDN | Nuxt 3 | Angular 21 |
|---|---|---|---|
| Low learning curve | 🟢 Best | 🟢 Best | 🔴 Steepest |
| SSR out of the box | ❌ | 🟢 Best | 🟡 Needs config |
| File-based routing | ❌ | 🟢 Best | ❌ |
| Full-stack in one repo | ❌ | 🟢 Best | ❌ |
| Enterprise structure | ❌ | 🟡 | 🟢 Best |
| Latest reactive APIs | 🟡 | 🟡 | 🟢 Most complete |
| Official UI components | ❌ | ❌ | 🟢 Best |
| Google/LTS backing | ❌ | ❌ | 🟢 Best |
| Cloudflare Pages | 🟢 | 🟢 Best | 🟡 |

---

## How to Evaluate

1. **Run both PoCs** — `cd poc/angular && npm install && npm start` / `cd poc/vue/nuxt && npm install && npm run dev`
2. **Assess team skills** — Vue knowledge vs Angular knowledge
3. **Consider timeline** — Angular has more initial boilerplate
4. **Consider SEO/SSR needs** — both Nuxt and Angular support SSR; Nuxt's is more zero-config
5. **Consider scale** — Angular's enforced structure is a long-term advantage for large teams

---

## Resources

- [Angular PoC README](./angular/README.md) — all Angular 21 features explained
- [ANGULAR_SIGNALS.md](./angular/ANGULAR_SIGNALS.md) — signals deep-dive reference
- [Nuxt PoC README](./vue/nuxt/README.md) — Nuxt 3 setup and SSR guide
- [NUXT_SSR.md](./vue/nuxt/NUXT_SSR.md) — SSR concepts
- [poc/README.md](./README.md) — full comparison tables


## 📁 Files Created
