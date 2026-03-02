# Nuxt 3 SSR Guide — Adblock Compiler PoC

This document explains how Server-Side Rendering (SSR) works in Nuxt 3 and how the patterns
used in this PoC compare to the Vue CDN PoC.

---

## What Is SSR and Why Does It Matter?

**Client-Side Rendering (CSR)** — the Vue CDN PoC model:
1. Browser downloads a mostly-empty HTML file
2. Browser downloads and executes JavaScript bundles
3. JavaScript renders the page content
4. Content becomes visible (and indexable) only after step 3

**Server-Side Rendering (SSR)** — the Nuxt model:
1. Browser requests a URL
2. Server executes Vue components, runs data fetching, and produces **complete HTML**
3. Browser displays content **immediately** — no JavaScript needed for first paint
4. JavaScript bundle loads in the background and **hydrates** the page (attaches event listeners)

### Why SSR Matters

| Concern | CSR (Vue CDN) | SSR (Nuxt) |
|---|---|---|
| **First Contentful Paint** | Delayed — JS must run first | Instant — HTML is pre-rendered |
| **SEO** | Crawlers see empty `<div id="app">` | Crawlers see full content |
| **Social previews** | No `<meta og:*>` content | Full Open Graph tags from `useHead()` |
| **Slow devices / networks** | Blank screen while JS loads | Content visible immediately |
| **Time to Interactive** | After JS parse + execute | After hydration (usually faster) |

---

## Key Nuxt SSR Primitives

### `useAsyncData(key, fetcher)`

Runs `fetcher` on **both server and client**. On the server the result is serialised into the
HTML payload (`<script id="__NUXT_DATA__">`). On the client Nuxt hydrates from that data —
**no second network request**.

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

Use when: you need fine-grained control over the fetch function or key.

---

### `useFetch(url, options?)`

Shorthand for `useAsyncData(url, () => $fetch(url, options))`. Same SSR hydration behaviour.

```typescript
// pages/compiler.vue
const { data, error } = await useFetch('/api/compile', {
    method: 'POST',
    body: payload,
});
```

Use when: calling a URL directly (most common case).

---

### `useState(key, initialiser?)`

SSR-safe shared reactive state. Unlike `ref()`, it is:
- **Serialised** into the server HTML payload
- **Hydrated** on the client without mismatch
- **Shared** across all components that call `useState('same-key')`

```typescript
// composables/useTheme.ts
const theme = useState<string>('theme', () => 'light');
```

Use when: you need shared state that survives the server→client handoff.

---

### `$fetch(url, options?)`

Nuxt's **isomorphic fetch utility** (powered by [ofetch](https://github.com/unjs/ofetch)):
- On the **server**: uses Node's `http` stack — bypasses CORS, can call internal APIs directly
- On the **client**: uses the browser's `fetch` API

```typescript
// works identically on server and client
const result = await $fetch('/api/compile', { method: 'POST', body: payload });
```

---

### `useHead(meta)` / `useSeoMeta(meta)`

Render `<title>`, `<meta>`, `<link>`, and other head tags on the **server**, so crawlers and
social media platforms see them without executing JavaScript.

```typescript
useHead({ title: 'Dashboard — Adblock Compiler' });

useSeoMeta({
    title: 'Adblock Compiler',
    ogTitle: 'Adblock Compiler',
    description: 'Compile adblock filter lists with transformations',
    ogDescription: 'Compile adblock filter lists with transformations',
});
```

---

## File-Based Routing vs Manual Routes

### Vue CDN PoC (manual)
```javascript
const routes = [
    { path: '/',                  component: HomePage },
    { path: '/compiler/:preset?', component: CompilerPage },
    { path: '/store',             component: StorePage },
    // …
];
const router = VueRouter.createRouter({ routes });
```

### Nuxt PoC (file-based, automatic)
```
pages/
  index.vue              → /
  compiler/
    [[preset]].vue       → /compiler  and  /compiler/:preset
  store.vue              → /store
  ssr.vue                → /ssr
  benchmark.vue          → /benchmark
  [...slug].vue          → /* (404 catch-all)
```

Nuxt reads the `pages/` directory and generates the router automatically. Route parameters
are encoded in the filename: `[param]` = required, `[[param]]` = optional, `[...slug]` = catch-all.

---

## Auto-Imports

Nuxt scans several directories and auto-imports their exports — no `import` statement needed
in `<script setup>`:

| Source | Examples |
|---|---|
| Vue core | `ref`, `reactive`, `computed`, `watch`, `onMounted` |
| Nuxt composables | `useAsyncData`, `useFetch`, `useState`, `useHead`, `useRoute`, `useRouter`, `$fetch` |
| `composables/` | `useTheme` (this project) |
| `utils/` | Any exported functions |
| `stores/` | ❌ **Not auto-imported** — use explicit `import { useCompilerStore } from '~/stores/compiler'` |

> **Note:** Pinia stores in `stores/` are **not** auto-imported by default. Always import them
> explicitly to avoid ambiguity.

---

## Pinia + SSR Hydration with `@pinia/nuxt`

In the Vue CDN PoC, Pinia state is initialised client-side only. In Nuxt, `@pinia/nuxt` hooks
into the SSR pipeline:

1. **Server**: Pinia store is initialised with default state, actions may be called during SSR
2. **Serialisation**: Store state is embedded in the HTML payload alongside `useAsyncData` data
3. **Client hydration**: Pinia restores the serialised state — no re-initialisation, no flicker

```typescript
// nuxt.config.ts
modules: ['@pinia/nuxt'],
// That's all — no extra configuration needed
```

---

## Server API Routes (Nitro)

Files in `server/api/` become HTTP endpoints served by **Nitro**, Nuxt's server engine.

```
server/
  api/
    compile.post.ts   → POST /api/compile
    health.get.ts     → GET  /api/health
    users/
      [id].get.ts     → GET  /api/users/:id
```

The `.post.ts` / `.get.ts` suffix restricts the method. Use `defineEventHandler` to handle
the request:

```typescript
// server/api/compile.post.ts
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    // proxy to upstream, or return mock data
    return { success: true, ruleCount: 1234 };
});
```

Benefits over a separate backend:
- No CORS configuration needed (server-to-server calls)
- Shared TypeScript types between frontend and backend
- Single `npm run dev` starts both the Nuxt app and the API server
- Deployable as a single unit

---

## Deployment Options

Nuxt 3 / Nitro supports multiple deployment targets:

| Target | Command | Description |
|---|---|---|
| **Node.js server** | `nuxt build` + `node .output/server/index.mjs` | Traditional Node server, full SSR |
| **Static (SSG)** | `nuxt generate` | Pre-renders all pages to HTML, no server needed |
| **Cloudflare Workers** | `nuxt build --preset=cloudflare-pages` | Edge-rendered, globally distributed |
| **Vercel / Netlify** | Auto-detected | Platform-specific edge functions |
| **Docker** | `nuxt build` + Dockerfile | Containerised Node server |

For this project (Cloudflare Workers backend), the recommended deployment is
**Cloudflare Pages** with the `cloudflare-pages` preset, so the Nuxt frontend runs on the
same edge network as the Worker API.

---

## Nuxt vs Vue CDN PoC — Full Comparison

| Feature | Vue CDN PoC | Nuxt 3 PoC |
|---|---|---|
| Rendering | Client-only (CSR) | Server + Client (SSR) |
| Build step | None (CDN) | `npm run build` |
| Routing | Manual `routes[]` array | File-based (`pages/`) |
| Data fetching | `fetch()` (client only) | `useFetch()` / `useAsyncData()` (SSR) |
| Shared state | `useState()` (local ref) | `useState()` (SSR-serialised) |
| Pinia hydration | Client-init only | Automatic via `@pinia/nuxt` |
| Head tags | Static HTML `<head>` | `useHead()` / `useSeoMeta()` (SSR) |
| API routes | Separate backend | `server/api/` (Nitro, built-in) |
| TypeScript | Optional | First-class, strict mode |
| Auto-imports | None | Vue, Nuxt, composables/, utils/ |
| SEO | ❌ Crawlers see empty HTML | ✅ Crawlers see full HTML |
| Performance | Loading flash on first paint | No flash — content in HTML |
| DevTools | Vue DevTools | Vue DevTools + Nuxt DevTools |
