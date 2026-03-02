import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite configuration for the Adblock Compiler frontend UI.
 *
 * Multi-page app setup — each HTML file in public/ is an independent entry point.
 * Dev server proxies API and WebSocket calls to the local Cloudflare Worker (port 8787).
 *
 * Plugins:
 *   @vitejs/plugin-vue     — Vue 3 Single-File Component support (.vue files)
 *   @vitejs/plugin-vue-jsx — Vue 3 JSX / TSX support
 *   @vitejs/plugin-react   — React JSX / TSX support with Fast Refresh
 *
 * Scripts:
 *   npm run ui:dev      — Start Vite dev server with HMR on http://localhost:5173
 *   npm run ui:build    — Production build → dist/
 *   npm run ui:preview  — Preview the production build locally
 *
 * For full-stack local development run both in parallel:
 *   wrangler dev        (Worker on :8787)
 *   npm run ui:dev      (Vite on :5173 → proxies /api, /sse, /ws to :8787)
 */
export default defineConfig({
    plugins: [tailwindcss(), vue(), vueJsx(), react()],
    // Use public/ as the project root so HTML files resolve assets correctly.
    root: 'public',

    // TS/JS modules in public/js/ are entry points processed by Vite (bundled, hashed).
    // Root-relative static assets (tailwind.css, shared-styles.css, docs/, etc.) are
    // copied to dist/ explicitly by the ui:build script, not via publicDir.
    publicDir: false,

    build: {
        // Output relative to repo root, not to the Vite root (public/).
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,

        rollupOptions: {
            input: {
                index: resolve(__dirname, 'public/index.html'),
                compiler: resolve(__dirname, 'public/compiler.html'),
                test: resolve(__dirname, 'public/test.html'),
                'admin-storage': resolve(__dirname, 'public/admin-storage.html'),
                'e2e-tests': resolve(__dirname, 'public/e2e-tests.html'),
                'validation-demo': resolve(__dirname, 'public/validation-demo.html'),
                'websocket-test': resolve(__dirname, 'public/websocket-test.html'),
                'tailwind-test': resolve(__dirname, 'public/tailwind-test.html'),
            },
        },
    },

    server: {
        port: 5173,
        // Proxy API/SSE/WebSocket calls to the local Cloudflare Worker.
        proxy: {
            '/api': 'http://localhost:8787',
            '/sse': 'http://localhost:8787',
            '/compile': 'http://localhost:8787',
            '/batch': 'http://localhost:8787',
            '/health': 'http://localhost:8787',
            '/ws': {
                target: 'ws://localhost:8787',
                ws: true,
            },
        },
    },
});
