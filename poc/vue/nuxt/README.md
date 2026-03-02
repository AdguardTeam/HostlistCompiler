# Adblock Compiler — Nuxt 3 PoC

A **Nuxt 3** proof-of-concept that mirrors the [Vue CDN PoC](../index.html) but adds
full **Server-Side Rendering (SSR)**, file-based routing, auto-imports, and Nitro API routes.

---

## Technology Stack

| Technology | Version | Role |
|---|---|---|
| **Nuxt 3** | ^3.16 | Full-stack Vue framework with SSR |
| **Vue 3** | ^3.5 | Component model + Composition API |
| **Pinia** | ^3.0 | Centralized state management |
| **@pinia/nuxt** | ^0.10 | SSR hydration for Pinia stores |
| **Nitro** | (bundled) | Server engine + API routes |
| **TypeScript** | ^5.8 | Type safety throughout |
| **vue-tsc** | ^2.2 | Vue-aware TypeScript compiler |

---

## How to Run

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (SSR + HMR)
npm run dev
# → http://localhost:3000
```

### Other commands

```bash
npm run build     # Production SSR build → .output/
npm run preview   # Preview the production build locally
npm run generate  # Static-site generation (SSG) → .output/public/
```

---

## Project Structure

```
poc/vue/nuxt/
├── app.vue                          # Root component (nav + <NuxtPage>)
├── nuxt.config.ts                   # Nuxt configuration (SSR, modules, CSS, head)
├── package.json
│
├── assets/
│   └── css/
│       └── main.css                 # Global CSS variables + component styles
│
├── components/
│   └── AppNav.vue                   # Navigation bar (auto-imported by Nuxt)
│
├── composables/
│   └── useTheme.ts                  # Dark/light theme (auto-imported, SSR-safe)
│
├── stores/
│   └── compiler.ts                  # Pinia store — urls, transformations, result
│
├── pages/                           # File-based routing
│   ├── index.vue                    # /           — Dashboard + stats + presets
│   ├── compiler/
│   │   └── [[preset]].vue           # /compiler   and  /compiler/:preset
│   ├── store.vue                    # /store      — Live Pinia state inspector
│   ├── ssr.vue                      # /ssr        — SSR features showcase
│   ├── benchmark.vue                # /benchmark  — performance.now() runs
│   └── [...slug].vue                # /*          — 404 catch-all
│
└── server/
    └── api/
        └── compile.post.ts          # POST /api/compile  — proxies to Worker API
```

---

## Key SSR Features Demonstrated

### 1. `useAsyncData()` — Zero-flash data fetching
Dashboard stats are fetched on the server and embedded in the HTML response.
The client hydrates without a second request — no loading spinner on first paint.

```typescript
// pages/index.vue
const { data: stats } = await useAsyncData('dashboard-stats', () =>
    Promise.resolve([
        { label: 'Filter lists', value: 3 },
        { label: 'Transformations', value: 8 },
        { label: 'Output size (KB)', value: 42 },
    ])
);
```

### 2. `useState()` — SSR-safe shared state
The theme state is stored with `useState()` rather than `ref()`, so it is
serialised into the server HTML and hydrated on the client without mismatch.

```typescript
// composables/useTheme.ts
const theme = useState<string>('theme', () => 'light');
```

### 3. `useHead()` — Server-rendered SEO tags
Every page calls `useHead()` so `<title>` and `<meta>` tags are present in the
raw HTML — visible to search engines and social-media crawlers.

```typescript
useHead({ title: 'Dashboard — Adblock Compiler' });
```

### 4. File-based routing
Routes are derived automatically from the `pages/` directory. No manual `routes[]`
array needed. `[[preset]]` double brackets = optional parameter.

### 5. Pinia SSR hydration
`@pinia/nuxt` serialises store state into the server HTML payload. The client
restores it without re-initialisation — cross-route state (e.g. typed URLs) persists
seamlessly between server render and client navigation.

### 6. Server API proxy (`server/api/compile.post.ts`)
`POST /api/compile` is handled by Nitro on the server. It proxies to the real
Adblock Compiler Worker API at `localhost:8787`, falling back to mock data in PoC mode.
Because this runs server-side, there are no CORS issues.

### 7. `$fetch()` — Isomorphic fetch
`$fetch('/api/compile', { method: 'POST', body })` works identically on both
server (Node http) and client (browser Fetch) — no `if (import.meta.server)` branching.

---

## Comparison to Vue CDN PoC

| Feature | Vue CDN PoC (`poc/vue/index.html`) | Nuxt 3 PoC (this project) |
|---|---|---|
| Rendering | Client-only | **Server + Client (SSR)** |
| Build step | None (CDN `<script>` tags) | `npm run build` |
| Routing | Manual `routes[]` array | **File-based** (`pages/`) |
| Data fetching | `fetch()` client-only | **`useFetch()` / `useAsyncData()`** |
| Pinia hydration | Client-init only | **Automatic via `@pinia/nuxt`** |
| SEO / head tags | Static `<title>` only | **`useHead()` / `useSeoMeta()`** |
| API routes | External backend required | **`server/api/` (Nitro built-in)** |
| TypeScript | No | **Yes (strict mode)** |
| Auto-imports | No | **Yes (composables, Vue, Nuxt)** |
| Initial page load | Blank until JS runs | **Full HTML immediately** |

---

## Further Reading

- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [`@pinia/nuxt` module](https://nuxt.com/modules/pinia)
- [Nitro Server Engine](https://nitro.unjs.io/)
- [`ofetch` ($fetch)](https://github.com/unjs/ofetch)
- [NUXT_SSR.md](./NUXT_SSR.md) — detailed SSR concepts guide (this project)
