# SPA Benefits Analysis — Adblock Compiler

## Question: Would This App Benefit From Being a Single Page Application?

**Short answer: Yes.**

The Adblock Compiler is currently a **multi-page application** (MPA) where each
`public/*.html` file is an independent page that triggers a full browser reload on
every navigation. Converting to a **Single Page Application** (SPA) would meaningfully
improve the user experience, developer experience, and long-term maintainability.

Two complete proof-of-concept implementations demonstrate how this migration would
look in practice — see [`poc/`](../poc/).

---

## Current Architecture (Multi-Page)

```
public/
├── index.html          ← Admin dashboard
├── compiler.html       ← Compiler UI
├── admin-storage.html  ← Storage admin
├── test.html           ← API tester
├── e2e-tests.html      ← E2E test runner
├── validation-demo.html
└── websocket-test.html
```

**Each page is isolated.** Navigation between them triggers a full browser reload,
re-downloads shared CSS/JS, and discards all in-memory state (form inputs, results,
theme settings not yet flushed to `localStorage`).

---

## SPA Benefits

### 1. Instant Navigation (No Full-Page Reloads)

In the current MPA, clicking "Compiler" from the dashboard causes the browser to:

1. Send a new HTTP request
2. Download and parse `compiler.html`
3. Re-download shared CSS and JS modules
4. Re-initialise theme, chart libraries, and event listeners

With a SPA, navigation is handled entirely in JavaScript — the URL changes, the
current "page" component is swapped out, and the rest of the shell (navigation,
theme, cached data) stays intact. Page transitions feel instant.

### 2. Shared State Across Views

With an MPA, sharing data between pages requires `localStorage`, `sessionStorage`,
URL parameters, or a server round-trip. With a SPA, all views share the same
JavaScript heap:

```
compiler result → still in memory when navigating to "Test" page
theme selection → applied once, persisted in the Vue/Angular state
API health data → fetched once at app startup, reused everywhere
```

This eliminates redundant API calls and simplifies state management.

### 3. Component Reusability and DRY Code

The current pages duplicate:

- Theme toggle HTML, CSS, and JS (repeated in every `.html` file)
- Navigation markup and link styling
- Shared CSS variable declarations
- Loading spinner HTML patterns

A SPA consolidates these into reusable components that render once and are shared
across all views. Changes to the navigation or theme toggle are made in one place.

### 4. Code Splitting and Lazy Loading

Modern SPA frameworks paired with Vite automatically split the app bundle by route.
Code for the "Admin Storage" page is never downloaded unless the user navigates there.
This improves Time to Interactive (TTI) for all users.

The existing Vite configuration already supports this via `@vitejs/plugin-vue` — no additional tooling changes are required.

### 5. Better Loading UX

SPAs enable skeleton screens, optimistic updates, and progressive loading that are
impossible with full-page reloads:

- Show the navigation shell instantly
- Stream in stats as they arrive from the API
- Display "Compiling…" inline without a blank white flash

### 6. Improved Testability

Component-based SPAs are significantly easier to unit test:

- Each component can be rendered in isolation
- State changes are predictable and inspectable
- Mocking API calls is straightforward
- End-to-end tests navigate within the same page context (no cross-page coordination)

### 7. Mobile and PWA Readiness

SPAs are the natural foundation for Progressive Web Apps (PWAs). Adding a service
worker for offline support, app-shell caching, and push notifications is
straightforward once the app is already an SPA.

---

## What the PoCs Demonstrate

Two PoC implementations in [`poc/`](../poc/) prove that the migration is
practical with the existing project infrastructure:

| PoC | Framework | Approach | Routing | State |
|---|---|---|---|---|
| [Vue 3](../poc/vue/index.html) | Vue 3 | CDN (no build) | Vue Router 4 | Pinia |
| [Angular](../poc/angular/) | Angular 21 | Full build (npm) | Angular Router | Signals + RxJS |

Both PoCs implement the same set of features:

- ✅ Component-based architecture
- ✅ Client-side routing (Home ↔ Compiler ↔ Benchmark)
- ✅ Dark/light theme toggle with `localStorage` persistence
- ✅ Compiler form with dynamic URL list and transformation checkboxes
- ✅ API integration (`POST /api/compile`) with loading and error states
- ✅ Benchmark page with `performance.now()` timing and summary statistics (min/max/avg)
- ✅ Mock data fallback when the API is not running

---

## Why the Infrastructure Is Already Ready

The Vite build system already ships `@vitejs/plugin-vue`:

```ts
// vite.config.ts (excerpt)
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig({
    plugins: [vue(), vueJsx()],
    // ...
});
```

This means `.vue` Single-File Components can already be
imported and bundled without any additional tooling changes. Adding a new SPA
entry point requires only:

1. A new `*.html` entry in `vite.config.ts` `rollupOptions.input`
2. A `main.ts` that mounts the Vue root
3. Route components for each current page

---

## Recommended Migration Path

### Phase 1 — Add a Vue SPA entry (lowest risk)

Add a new `public/app.html` entry that mounts a Vue 3 SPA alongside the
existing MPA pages. Users can opt in to the new SPA experience while the
existing pages remain untouched.

### Phase 2 — Migrate pages incrementally

Migrate pages one at a time from static HTML into Vue route components:

1. **Home dashboard** (`index.html` → `/`) — stats, chart, health status
2. **Compiler** (`compiler.html` → `/compiler`) — form, results, SSE streaming
3. **Test** (`test.html` → `/test`) — API test runner
4. **Admin Storage** (`admin-storage.html` → `/admin`) — storage management

### Phase 3 — Remove legacy pages

Once all pages are ported and the SPA is stable, the legacy `.html` files can be
removed and the SPA entry can become the single `index.html`.

---

## Framework Recommendation

For this project, **Vue 3** is the recommended choice:

| Criterion | Vue 3 | Angular |
|---|---|---|
| Learning curve | Low | High |
| Bundle size | Small | Large |
| TypeScript | Optional (excellent) | Required |
| Official router | ✅ Vue Router 4 | ✅ Angular Router |
| State management | ✅ Pinia (official) | ✅ Signals + RxJS |
| Vite integration | ✅ First-class | Partial |
| Cloudflare Workers | ✅ | ✅ |

Vue 3 balances a low learning curve, excellent TypeScript support, first-class Vite
integration, and an official router and state management library. The project's
existing Vite setup already has `@vitejs/plugin-vue` installed and active.

---

## Related Documentation

- [`poc/README.md`](../poc/README.md) — Framework comparison guide
- [`poc/SUMMARY.md`](../poc/SUMMARY.md) — Implementation summary
- [`docs/VITE.md`](VITE.md) — Vite integration guide
- [`poc/vue/VUE_PINIA.md`](../poc/vue/VUE_PINIA.md) — Pinia state management guide
- [`poc/angular/ANGULAR_SIGNALS.md`](../poc/angular/ANGULAR_SIGNALS.md) — Angular Signals guide
