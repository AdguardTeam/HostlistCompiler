# Vite Integration

This document describes how Vite is used as the build tool for the Adblock Compiler
frontend UI (the static files served by the Cloudflare Worker).

## Overview

Vite processes all HTML pages in `public/` as a **multi-page application**:

- Bundles local JavaScript/TypeScript modules (`public/js/`)
- Extracts and optimises CSS (including the shared design-system styles)
- Replaces CDN Chart.js with a tree-shaken npm bundle
- Outputs production-ready assets to `dist/`
- Supports Vue 3 Single-File Components (`.vue` files) via `@vitejs/plugin-vue`
- Supports Vue 3 JSX/TSX via `@vitejs/plugin-vue-jsx`
- Supports React JSX/TSX with Fast Refresh via `@vitejs/plugin-react`

External scripts that must stay as CDN references (Cloudflare Web Analytics, Cloudflare
Turnstile) are left untouched by Vite.

## Plugins

| Plugin | Version | Purpose |
|---|---|---|
| `@vitejs/plugin-vue` | `^6.0.4` | Vue 3 Single-File Component (`.vue`) support |
| `@vitejs/plugin-vue-jsx` | `^5.1.4` | Vue 3 JSX and TSX transform support |
| `@vitejs/plugin-react` | `^5.1.4` | React JSX/TSX transform with Babel Fast Refresh |

All three plugins are active for every build and dev-server session. They have no impact
on pages that do not import Vue or React components.

## Directory Structure

```
public/                     ← Vite root (source files)
├── js/
│   ├── theme.ts            ← Dark/light mode toggle (ES module)
│   └── chart.ts            ← Chart.js npm import + global registration
├── shared-styles.css       ← Design-system CSS variables
├── validation-ui.js        ← Validation UI component (ES module)
├── index.html              ← Admin dashboard
├── compiler.html           ← Main compiler UI
├── test.html               ← API tester
├── admin-storage.html      ← Storage admin
├── e2e-tests.html          ← E2E test runner
├── validation-demo.html    ← Validation demo
└── websocket-test.html     ← WebSocket tester

dist/                       ← Vite build output (git-ignored)
vite.config.ts              ← Vite configuration
```

## Scripts

| Command | Description |
|---|---|
| `npm run ui:dev` | Start the Vite dev server on `http://localhost:5173` with HMR |
| `npm run ui:build` | Production build → `dist/` |
| `npm run ui:preview` | Serve the `dist/` build locally for smoke-testing |

## Development Workflow

### Option A — Vite dev server only (UI changes)

```bash
# Terminal 1: start the Cloudflare Worker backend
wrangler dev          # listens on http://localhost:8787

# Terminal 2: start the Vite dev server
npm run ui:dev        # proxies /api, /compile, /health, /ws → :8787
```

Open `http://localhost:5173` in the browser.  Hot-module replacement (HMR) means UI
changes are reflected immediately without a full page reload.

### Option B — Wrangler dev only (worker changes)

If you only need to iterate on the Worker code and the UI is not changing, build the UI
once and then use Wrangler's built-in static-asset serving:

```bash
npm run ui:build      # generates dist/
wrangler dev          # serves dist/ as static assets on :8787
```

Open `http://localhost:8787` in the browser.

## Production Deployment

`npm run ui:build` orchestrates a 3-step pipeline. Wrangler's `[build]` config invokes it
automatically before every `wrangler deploy`:

```bash
wrangler deploy
# ↳ runs: npm run ui:build
#         1. npm run build:css:prod  → generates public/tailwind.css (minified)
#         2. vite build              → bundles JS/TS modules, extracts CSS → dist/
#         3. npm run ui:copy-static  → copies tailwind.css, shared-styles.css,
#                                      shared-theme.js, compiler-worker.js, docs/ → dist/
# ↳ deploys Worker + static assets from dist/
```

> **Note:** `npm run build:css` / `npm run build:css:watch` are still useful during
> development when working outside the Vite dev server (e.g. previewing raw HTML files
> directly in a browser without running `npm run ui:dev`).

## What Was Migrated

| Before | After |
|---|---|
| Chart.js loaded from jsDelivr CDN | Bundled from `chart.js` npm package |
| `shared-theme.js` (global IIFE) | `public/js/theme.ts` (typed ES module, `window.AdblockTheme` still available) |
| `validation-ui.js` (no exports) | `validation-ui.js` (adds `export { ValidationUI }`) |
| Empty `[build]` in `wrangler.toml` | `npm run ui:build` wires Vite into the deploy pipeline |
| Assets served from `./public` | Assets served from `./dist` (Vite output) |
| No Vue/React plugin support | `@vitejs/plugin-vue`, `@vitejs/plugin-vue-jsx`, `@vitejs/plugin-react` integrated |

## Proxy Configuration

The Vite dev server (`vite.config.ts`) proxies the following paths to the local Worker:

| Path | Target |
|---|---|
| `/api` | `http://localhost:8787` |
| `/compile` | `http://localhost:8787` |
| `/batch` | `http://localhost:8787` |
| `/health` | `http://localhost:8787` |
| `/sse` | `http://localhost:8787` |
| `/ws` | `ws://localhost:8787` (WebSocket) |

## Adding a New Page

1. Create `public/your-page.html` with a `<script type="module" src="/js/your-module.ts">` entry.
2. Add an entry to `rollupOptions.input` in `vite.config.ts`:
   ```ts
   'your-page': resolve(__dirname, 'public/your-page.html'),
   ```
3. Create `public/js/your-module.ts` with the page-specific TypeScript.

## Adding a New Shared Module

1. Create `public/js/your-module.ts` as a standard ES module.
2. Import it from any HTML entry point using `<script type="module" src="/js/your-module.ts">`.
3. To expose it as a global (for inline `<script>` compatibility), assign to `window`:
   ```ts
   window.YourModule = YourModule;
   ```
