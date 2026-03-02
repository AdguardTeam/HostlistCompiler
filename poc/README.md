# Frontend Framework Migration - Proof of Concept

This directory contains proof-of-concept implementations of the Adblock Compiler frontend in two popular JavaScript frameworks: **Vue 3** and **Angular 21**.

## 📋 Overview

Each PoC demonstrates how the existing vanilla HTML/CSS/JS frontend would be implemented in a modern framework, showcasing:

- ✅ Component-based architecture
- ✅ Client-side routing (SPA)
- ✅ State management (forms, theme, API data)
- ✅ Theme toggle (dark/light mode)
- ✅ API integration pattern
- ✅ Loading and error states
- ✅ Form validation
- ✅ Benchmarking — measure compilation API performance across multiple runs

## 🎯 PoC Implementations

### 1. Vue 3 PoC ([vue/index.html](./vue/index.html))

**Technology Stack:**

- Vue 3 (via CDN)
- Vue Router 4 (via CDN)
- Pinia 2 (via CDN) - Official state management
- Composition API

**Key Patterns:**

- **Pinia** for centralized state management (replaces Vuex)
- Store with state, getters, and actions
- Reactive store accessible from any component
- Vue Router for declarative routing, named routes, and route metadata
- Route parameters with `useRoute()` for bookmarkable application states
- Programmatic navigation with `useRouter().push()`
- Navigation guards with `router.beforeEach()` for cross-cutting concerns
- Composition API with `setup()`
- `ref()` and `reactive()` for reactive state
- `computed()` for derived state
- `watch()` for side effects
- Template-based declarative rendering
- Two-way data binding with `v-model`
- Composables for reusable logic

**State Management:**

The Vue PoC demonstrates **Pinia**, the official state management library for Vue 3. Pinia provides a centralized store where application state lives, making it easy to share data between components without prop drilling. See [vue/VUE_PINIA.md](./vue/VUE_PINIA.md) for a detailed explanation of why Pinia is the modern choice for Vue 3 state management.

**Why Vue Router Is Worth Using:**

Vue Router is not just a convenience layer — it enables architectural patterns that would be
painful to implement by hand:

| Benefit | What it Gives You |
| --- | --- |
| **Declarative links** | `<router-link>` auto-applies active classes; no DOM querying needed |
| **Programmatic navigation** | `router.push('/compiler/dns')` from any component or service |
| **Route parameters** | `/compiler/:preset` makes URLs shareable and bookmarkable |
| **Navigation guards** | `router.beforeEach()` centralises auth, analytics, and title updates |
| **Route metadata** | Attach arbitrary data (`meta.title`, `meta.requiresAuth`) to routes |
| **Lazy loading** | `component: () => import('./Page.vue')` splits routes into separate chunks |
| **Nested routes** | Multi-level `<router-view>` outlets for complex layouts |
| **Named routes** | Stable names decouple navigation code from URL structure |

The Vue PoC demonstrates the first five of these benefits in a single CDN-based HTML file.

**Benchmark:**

The `/benchmark` route measures compilation API performance across multiple runs. It uses `performance.now()` for accurate wall-clock timing, shows a live progress bar and per-run results table, and exposes computed summary statistics (min, max, avg) via `computed()`. Demonstrates `ref()`, `reactive()`, `computed()`, and sequential `async/await` in a Composition API `setup()`.

**How to Run:**

```bash
cd poc/vue
# Open index.html in a web browser
# OR serve with a local server:
python3 -m http.server 8001
# Then visit: http://localhost:8001
```

**Advantages:**

- 🎨 Progressive framework (start simple, scale up)
- 📖 Excellent documentation
- 🔄 Two-way data binding
- 🎯 Intuitive template syntax
- ⚡ Great performance with reactivity system
- 🛠️ Official router and state management

**Considerations:**

- Smaller ecosystem than React
- Less corporate backing
- Composition API is newer (learning curve)

#### 1a. Nuxt 3 PoC ([vue/nuxt/](./vue/nuxt/))

Nuxt 3 is a **meta-framework built on top of Vue 3** — it uses the same `.vue` single-file components, Composition API, and Pinia, and adds a production-ready layer on top. Because Nuxt is Vue (not a separate framework), the Nuxt PoC lives alongside the CDN version inside `poc/vue/` rather than as a peer to Angular.

**What Nuxt adds over the CDN Vue PoC:**

| Feature | Vue CDN PoC | Nuxt 3 PoC |
| --- | --- | --- |
| **Rendering** | Client-only (CSR) | **Server + Client (SSR)** |
| **SEO** | ❌ Crawlers see empty HTML | ✅ Crawlers see full HTML |
| **Routing** | Manual `routes[]` array | **File-based** (`pages/` directory) |
| **Data fetching** | `fetch()` — client only | **`useFetch()` / `useAsyncData()`** — SSR |
| **Pinia state** | Client-init only | **SSR-hydrated** via `@pinia/nuxt` |
| **Head / SEO tags** | Static `<title>` only | **`useHead()` / `useSeoMeta()`** — SSR |
| **API routes** | External backend | **`server/api/`** — Nitro built-in |
| **TypeScript** | JSDoc annotations | **Strict TypeScript throughout** |
| **Build step** | None (CDN) | `npm run build` |

**Key SSR patterns demonstrated:**

- `useAsyncData()` — data fetched on the server, embedded in the HTML payload, zero loading flash
- `useState()` — SSR-safe shared state that survives the server→client handoff without mismatch
- `useHead()` — server-rendered `<title>` and `<meta>` tags for SEO on every page
- `@pinia/nuxt` — Pinia store state serialised into the HTML and hydrated on the client
- `$fetch()` — isomorphic fetch utility (Node http on server, browser Fetch on client)
- `server/api/compile.post.ts` — Nitro server route that proxies to the Worker API, eliminating CORS
- File-based routing — `[[preset]]` for optional params, `[...slug]` for catch-all 404

**How to Run:**

```bash
cd poc/vue/nuxt
npm install
npm run dev
# → http://localhost:3000
```

See [vue/nuxt/NUXT_SSR.md](./vue/nuxt/NUXT_SSR.md) for a full explanation of SSR concepts and patterns used.

---

### 2. Angular PoC ([angular/](./angular/))

**Technology Stack:**

- Angular 21 (Standalone Components)
- TypeScript
- RxJS
- Reactive Forms
- **Signals** - Modern reactive state management

**Key Patterns:**

- Standalone components (no NgModules)
- **Angular Signals** - `signal()`, `computed()`, `effect()`
- **New `@if` / `@for` / `@switch` template syntax** (replaces `*ngIf/*ngFor/*ngSwitch`)
- **Functional DI with `inject()`** - No constructor needed
- Dependency Injection
- Reactive Forms with FormBuilder
- RxJS Observables for async operations
- Services for business logic
- Component-scoped styles

**Modern Reactivity:**

The Angular PoC demonstrates **Angular Signals**, a revolutionary reactive primitive that enables fine-grained reactivity and better performance than traditional Zone.js change detection. Signals provide explicit dependencies, simpler mental models, and seamless interop with RxJS. See [angular/ANGULAR_SIGNALS.md](./angular/ANGULAR_SIGNALS.md) for a comprehensive guide.

**Benchmark:**

The `/benchmark` route measures compilation API performance across multiple runs. It uses `performance.now()` for accurate wall-clock timing and showcases Angular Signals throughout: `signal()` for mutable state (run count, running flag, accumulated results), `computed()` for derived progress percentage and summary statistics, and `inject()` for functional dependency injection. Results update reactively after each run.

**How to Run:**

```bash
cd poc/angular
npm install
npm start
# Visit: http://localhost:4200
```

**Advantages:**

- 🏢 Enterprise-ready framework
- 📘 Full TypeScript integration
- 🧰 Complete solution (router, forms, HTTP, testing)
- 🔒 Strong typing and interfaces
- 🎓 Opinionated architecture (consistency)
- 💼 Popular in enterprise environments
- ⚡ Modern signals for fine-grained reactivity
- 🚀 New template syntax for better performance

**Considerations:**

- Steeper learning curve
- More boilerplate code
- Larger bundle size
- Requires Node.js and build tools

---

## 🔍 Feature Comparison

| Feature               | Vue CDN              | Vue + Nuxt 3         | Angular              |
| --------------------- | -------------------- | -------------------- | -------------------- |
| **Learning Curve**    | Easy                 | Easy (same Vue API)  | Steep                |
| **Bundle Size**       | Small (CDN)          | Small (tree-shaken)  | Large                |
| **Performance**       | Excellent            | Excellent + SSR      | Very Good            |
| **TypeScript**        | Optional (JSDoc)     | Yes (strict)         | Required             |
| **State Management**  | **Pinia** (Official) | **Pinia** + SSR hydration | Services + RxJS + Signals |
| **Form Handling**     | v-model + validation | v-model + validation | Reactive Forms       |
| **Routing**           | Vue Router (manual)  | File-based (auto)    | Angular Router       |
| **Build Setup**       | None (CDN)           | Nuxt / Nitro         | Angular CLI          |
| **SSR**               | ❌                   | ✅ (built-in)        | Optional (Angular Universal) |
| **SEO**               | ❌ (CSR only)        | ✅ (`useHead()`)     | Optional             |
| **API Routes**        | External backend     | `server/api/` (built-in) | External backend |
| **Testing**           | Vitest / Jest        | Vitest / Jest        | Jasmine + Karma      |
| **Community**         | Large                | Large                | Large                |
| **Corporate Backing** | Independent          | Independent          | Google               |

## 🎨 Visual Comparison

Both PoCs implement the same design using the existing color scheme:

- **Primary Gradient**: `#667eea` → `#764ba2`
- **Dark Mode**: Supported in both implementations
- **Responsive Design**: Mobile-friendly layouts
- **Consistent UX**: Same user experience across frameworks

## 📊 Code Structure Comparison

### Vue CDN

```
- Single HTML file (no build step)
- Template syntax (HTML-like)
- Composition API for logic
- Reactive data binding
- Props & emits for communication
```

### Vue + Nuxt 3

```
- .vue single-file components (same as Vue CDN)
- File-based routing (pages/ directory)
- Server-side rendering (Nitro engine)
- Auto-imported composables and Vue APIs
- server/api/ for backend API routes
```

### Angular

```
- Class-based components
- Inline or external templates
- Decorators (@Component, @Injectable)
- Services for shared logic
- Input/Output for communication
```

## 🚀 Migration Path Recommendations

### Choose **Vue CDN** if:

- ✅ You want zero setup and no build step
- ✅ Prototyping or embedding in an existing HTML page
- ✅ No SSR / SEO requirements

### Choose **Vue + Nuxt 3** if:

- ✅ You want Vue's easy learning curve with production-grade SSR
- ✅ SEO or social-preview meta tags are needed
- ✅ You want a full-stack setup (frontend + API routes) in one repo
- ✅ Progressive enhancement or Cloudflare Pages deployment is desired

### Choose **Angular** if:

- ✅ You need an enterprise framework
- ✅ TypeScript is a requirement
- ✅ You want a complete solution
- ✅ Team consistency is critical
- ✅ You're building a large-scale app

## 📈 Existing App Analysis

### Current Stack

- **Multi-page application** (compiler.html, index.html, admin-storage.html, test.html)
- **Vanilla JavaScript** with manual DOM manipulation
- **CSS Custom Properties** for theming
- **Chart.js** for visualization
- **No build step** - direct HTML/CSS/JS

### Migration Benefits

**All Frameworks Provide:**

1. **Single Page Application** - No page reloads, faster navigation
2. **Component Reusability** - DRY principle, maintainable code
3. **State Management** - Predictable data flow
4. **Developer Experience** - Hot reload, debugging tools
5. **Testing** - Unit tests, integration tests
6. **Type Safety** (with TypeScript) - Fewer runtime errors
7. **Modern Tooling** - Linting, formatting, bundling
8. **Performance** - Code splitting, lazy loading

## 🔧 API Integration

Both PoCs use the same API contract:

**Endpoint:** `POST /api/compile`

**Request:**

```json
{
    "configuration": {
        "name": "Filter List Name",
        "sources": [
            { "source": "https://example.com/filters.txt" }
        ],
        "transformations": [
            "RemoveComments",
            "Deduplicate",
            "TrimLines",
            "RemoveEmptyLines"
        ]
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
  "transformations": [...],
  "benchmark": {
    "duration": "123ms",
    "rulesPerSecond": 10000
  }
}
```

**Available Transformations:**

- RemoveComments
- Compress
- RemoveModifiers
- Validate
- ValidateAllowIp
- Deduplicate
- InvertAllow
- RemoveEmptyLines
- TrimLines
- InsertFinalNewLine
- ConvertToAscii

## 📝 Implementation Notes

### Vue (CDN Version)

- Single HTML file, no build step required
- Suitable for PoC and small projects
- For production, use Nuxt 3 (see below) or Vite

### Vue + Nuxt 3

- Full Nuxt 3 project with SSR, file-based routing, and TypeScript
- Requires Node.js and npm
- Extends the CDN version with everything needed for production

### Angular

- Requires Node.js and npm
- Uses Angular CLI for development
- Production-ready setup out of the box

### Production Considerations

1. **Build Process**: All frameworks need bundling for production
2. **Code Splitting**: Lazy load routes and components
3. **SEO**: Use Nuxt 3 (Vue) or Angular Universal for SSR
4. **PWA**: Add service workers for offline support
5. **Testing**: Set up unit and E2E tests
6. **CI/CD**: Automate builds and deployments

## 🧪 Testing the PoCs

### Vue CDN

1. Open the HTML file directly in a browser
2. Or serve with a local HTTP server:
   ```bash
   python3 -m http.server 8001
   npx http-server
   ```

### Vue + Nuxt 3

1. Install dependencies: `cd poc/vue/nuxt && npm install`
2. Run dev server: `npm run dev`
3. Visit: `http://localhost:3000`
4. Build for production: `npm run build`

### Angular

1. Install dependencies: `npm install`
2. Run dev server: `npm start`
3. Build for production: `npm run build`

## 🎓 Learning Resources

### Vue / Nuxt

- [Official Vue Docs](https://vuejs.org/)
- [Vue Router](https://router.vuejs.org/)
- [Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Nuxt 3 Docs](https://nuxt.com/docs)
- [Pinia Docs](https://pinia.vuejs.org/)
- [NUXT_SSR.md](./vue/nuxt/NUXT_SSR.md) — SSR concepts guide

### Angular

- [Official Angular Docs](https://angular.io/docs)
- [Standalone Components](https://angular.io/guide/standalone-components)
- [Reactive Forms](https://angular.io/guide/reactive-forms)

## 📞 Next Steps

1. **Review each PoC** - Test functionality and developer experience
2. **Read the SPA Benefits Analysis** - See [docs/SPA_BENEFITS.md](../docs/SPA_BENEFITS.md) for a full analysis
3. **Gather team feedback** - Which framework feels most intuitive?
4. **Consider requirements** - Project size, timeline, team skills
5. **Prototype further** - Implement more complex features
6. **Make decision** - Choose framework and plan migration
7. **Set up tooling** - Configure build process, linting, testing
8. **Migrate incrementally** - Start with one page/feature

## 🤝 Contributing

These PoCs are starting points. Feel free to extend them with:

- Additional pages (admin-storage, test)
- Chart.js integration
- WebSocket support
- Authentication
- Error boundaries
- Loading skeletons
- Animations

---

**Questions or Feedback?** Open an issue or discussion in the repository!
