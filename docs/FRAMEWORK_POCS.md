# Framework PoCs — Alpha / Experimental

> **Status: Alpha** — These implementations are incubator-stage experiments.
> They are not production code. APIs and UIs may change without notice.

## Overview

The `poc/` directory contains proof-of-concept implementations of the Adblock
Compiler frontend in two popular JavaScript frameworks. Each PoC explores how
the existing vanilla HTML/CSS/JS UI could be rewritten using a modern framework,
and serves as an evaluation baseline before any production migration decision is
made.

| PoC | Technology | Run method |
|-----|-----------|------------|
| [Vue 3](../poc/vue/index.html) | Vue 3 · Vue Router 4 · Pinia · Composition API | Open in browser (CDN) |
| [Angular](../poc/angular/) | Angular 21 · TypeScript · RxJS · Signals | `npm install && npm start` |

A side-by-side overview is available at [`/poc/index.html`](../poc/index.html).

## What Each PoC Demonstrates

Both implementations cover the same feature set:

- **Client-side routing** — full SPA navigation without page reloads
- **Component architecture** — decomposed, reusable UI building blocks
- **State management** — local and global reactive state (Pinia, Signals)
- **Theme toggle** — dark/light mode with `localStorage` persistence
- **API integration** — `POST /api/compile` with loading and error states
- **Benchmark page** — measures compilation API performance with `performance.now()`

## Build & Distribution

The `poc/` directory is included in every production build:

```bash
# Part of: npm run ui:build → npm run ui:copy-static
cp -r poc dist/poc
```

After building, the PoC files are served as static assets alongside the main UI:

```
/poc/index.html          ← Framework comparison hub
/poc/vue/index.html      ← Vue 3 PoC
/poc/angular/            ← Angular PoC (requires local dev server)
```

The Angular PoC requires a local dev server because it depends on Node.js build
tools and cannot be opened directly as a static file.

## Alpha Designation

These PoCs are labelled **Alpha** because:

- They are feature-incomplete (no admin, storage, or WebSocket pages)
- They use CDN-delivered libraries not yet reviewed for security compliance
- No automated tests exist for the PoC UI code
- No framework migration decision has been made
- Breaking changes may occur at any time

Use them for evaluation, learning, and prototyping. Do not reference them from
production documentation or expose them as supported user-facing features.

## Related Documentation

- [poc/README.md](../poc/README.md) — Full feature comparison and setup guide
- [Vite Integration](VITE.md) — How the build pipeline copies `poc/` to `dist/`
- [Admin Dashboard](ADMIN_DASHBOARD.md) — Production UI that the PoCs aim to replace
