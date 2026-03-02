<script setup lang="ts">
definePageMeta({ title: 'SSR Features' });
useHead({ title: 'SSR Features — Adblock Compiler' });

const route = useRoute();

// Nuxt Pattern: useAsyncData() — runs on server, result embedded in HTML
// Second arg is a unique key; Nuxt deduplicates concurrent requests
const { data: ssrTime, pending } = await useAsyncData('ssr-time', () =>
    Promise.resolve(new Date().toISOString()),
);

// Nuxt Pattern: useFetch() is shorthand for useAsyncData + $fetch combined.
// Use it when fetching from an API endpoint.
// const { data, error } = await useFetch('/api/health');

// Nuxt Pattern: useRuntimeConfig() exposes public runtime config values.
// Server-only secrets stay in runtimeConfig.private; public values in runtimeConfig.public.
const config = useRuntimeConfig();
</script>

<template>
    <div>
        <h1>🚀 SSR Features</h1>
        <p class="mb-2" style="color: var(--text-muted)">
            How Nuxt 3 enables Server-Side Rendering on top of the Vue PoC
        </p>

        <!-- Live Route Inspector (same as Vue PoC's About page) -->
        <div class="route-info">
            <div>📍 <strong>Current path:</strong> <span>{{ route.path }}</span></div>
            <div>🏷️  <strong>Route name:</strong> <span>{{ route.name }}</span></div>
            <div>🖥️  <strong>Server render time:</strong> <span>{{ ssrTime }}</span></div>
            <div>⚡  <strong>SSR pending:</strong> <span>{{ pending }}</span></div>
        </div>

        <div class="alert alert-success mb-2">
            <strong>✅ This page is server-rendered.</strong> The timestamp above was set on the
            <em>server</em> and embedded in the HTML response — no client-side fetch required.
            Refresh the page to see it update; navigating client-side will call
            <code>useAsyncData</code> again in the browser.
        </div>

        <h2 style="margin-bottom: 16px;">Nuxt SSR Patterns</h2>

        <div class="feature-grid">
            <div class="feature-card">
                <h4>🔄 <code>useAsyncData()</code></h4>
                <p>
                    Runs a data-fetching function on <strong>both server and client</strong>.
                    On the server the result is serialised into the HTML payload; on the client
                    Nuxt hydrates from that payload — eliminating the loading flash entirely.
                </p>
            </div>
            <div class="feature-card">
                <h4>⚡ <code>useFetch()</code></h4>
                <p>
                    Shorthand for <code>useAsyncData + $fetch</code>. Automatically handles
                    base URL, request deduplication, and SSR hydration. The go-to primitive
                    for fetching from API routes.
                </p>
            </div>
            <div class="feature-card">
                <h4>🗂️ <code>useState()</code></h4>
                <p>
                    SSR-safe shared state that is serialised into the server response and
                    hydrated on the client. Unlike a bare <code>ref()</code>, it is shared
                    across components <em>and</em> survives the server-to-client handoff
                    without hydration mismatch.
                </p>
            </div>
            <div class="feature-card">
                <h4>🔗 <code>$fetch()</code></h4>
                <p>
                    Nuxt's isomorphic fetch utility. On the server it uses Node's http stack
                    (bypasses CORS restrictions); on the client it uses the browser Fetch API.
                    No <code>if (import.meta.server)</code> branching needed.
                </p>
            </div>
            <div class="feature-card">
                <h4>📄 <code>useHead()</code> / <code>useSeoMeta()</code></h4>
                <p>
                    Render <code>&lt;title&gt;</code>, <code>&lt;meta&gt;</code>, and other
                    head tags on the <strong>server</strong>. Search engines and social-media
                    crawlers see fully-populated meta tags without waiting for JavaScript — a
                    key limitation of CSR-only SPAs.
                </p>
            </div>
            <div class="feature-card">
                <h4>🗺️ File-Based Routing</h4>
                <p>
                    Nuxt generates routes from the <code>pages/</code> directory automatically.
                    <code>pages/compiler/[[preset]].vue</code> becomes
                    <code>/compiler/:preset?</code> — no manual route config needed. Compare
                    this with the hand-written <code>routes</code> array in the Vue CDN PoC.
                </p>
            </div>
            <div class="feature-card">
                <h4>🔌 Auto-Imports</h4>
                <p>
                    Vue composables (<code>ref</code>, <code>computed</code>, …),
                    Nuxt composables (<code>useAsyncData</code>, <code>useHead</code>, …),
                    and files from <code>composables/</code> and <code>stores/</code> are
                    auto-imported. No boilerplate <code>import</code> statements in
                    <code>&lt;script setup&gt;</code>.
                </p>
            </div>
            <div class="feature-card">
                <h4>🖥️ Server API Routes</h4>
                <p>
                    Files in <code>server/api/</code> become API endpoints served by Nitro,
                    Nuxt's server engine. <code>server/api/compile.post.ts</code> handles
                    <code>POST /api/compile</code> — enabling a full-stack app in one repo
                    with no separate backend needed.
                </p>
            </div>
        </div>

        <div class="alert alert-info mt-2">
            <strong>📖 Why SSR Matters:</strong> In the Vue CDN PoC, the browser downloads
            a mostly-empty HTML page, then executes JavaScript to render content. Search engines
            and slow devices see a blank page first. With Nuxt SSR, the server sends fully-rendered
            HTML — content is visible immediately, and crawlers index real content. Hydration then
            makes the page interactive without a re-render.
        </div>

        <div class="alert alert-success">
            <strong>🧭 Nuxt vs Vue CDN PoC:</strong>
            <table style="width: 100%; margin-top: 8px; font-size: 13px; border-collapse: collapse;">
                <tr>
                    <th style="text-align: left; padding: 6px 12px; border-bottom: 1px solid var(--border-color);">Feature</th>
                    <th style="text-align: left; padding: 6px 12px; border-bottom: 1px solid var(--border-color);">Vue CDN PoC</th>
                    <th style="text-align: left; padding: 6px 12px; border-bottom: 1px solid var(--border-color);">Nuxt PoC</th>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Rendering</td>
                    <td style="padding: 6px 12px;">Client-only</td>
                    <td style="padding: 6px 12px; color: var(--success); font-weight: 600;">Server + Client</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">SEO</td>
                    <td style="padding: 6px 12px;">❌ Blank HTML for crawlers</td>
                    <td style="padding: 6px 12px; color: var(--success); font-weight: 600;">✅ Full HTML for crawlers</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Data fetching</td>
                    <td style="padding: 6px 12px;"><code>fetch()</code> (client only)</td>
                    <td style="padding: 6px 12px;"><code>useFetch()</code> / <code>useAsyncData()</code></td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Routing</td>
                    <td style="padding: 6px 12px;">Manual <code>routes[]</code> array</td>
                    <td style="padding: 6px 12px;">File-based (automatic)</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Pinia state</td>
                    <td style="padding: 6px 12px;">Client-init only</td>
                    <td style="padding: 6px 12px; color: var(--success); font-weight: 600;">SSR hydrated</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Head / SEO tags</td>
                    <td style="padding: 6px 12px;">Static HTML only</td>
                    <td style="padding: 6px 12px;"><code>useHead()</code> / <code>useSeoMeta()</code></td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">API routes</td>
                    <td style="padding: 6px 12px;">Separate backend</td>
                    <td style="padding: 6px 12px;"><code>server/api/</code> (built-in)</td>
                </tr>
                <tr>
                    <td style="padding: 6px 12px;">Build required</td>
                    <td style="padding: 6px 12px;">No (CDN)</td>
                    <td style="padding: 6px 12px;">Yes (<code>npm run build</code>)</td>
                </tr>
            </table>
        </div>
    </div>
</template>
