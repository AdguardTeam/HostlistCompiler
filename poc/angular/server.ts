/**
 * Cloudflare Workers SSR handler for Angular 21
 *
 * Architecture overview:
 *   - `AngularAppEngine` (from `@angular/ssr`) is the edge-compatible SSR engine.
 *     It speaks the standard fetch `Request`/`Response` API, making it portable
 *     across Cloudflare Workers, Deno Deploy, and any other WinterCG-compliant runtime.
 *   - Static assets (JS, CSS, fonts) are served by Cloudflare's `ASSETS` binding,
 *     configured in `wrangler.toml`. The Workers runtime intercepts asset requests
 *     before this handler is invoked, so `angularApp.handle()` only sees document
 *     (HTML) requests.
 *   - For routes that Angular cannot handle (e.g. unknown paths not covered by the
 *     Angular router), `handle()` returns `null` and we fall through to a 404.
 *
 * SSR render modes (defined in `src/app/app.routes.server.ts`):
 *   - `RenderMode.Prerender` — Home page is pre-rendered at `ng build` time and
 *     served as a static HTML file from the ASSETS binding.
 *   - `RenderMode.Server`    — All other routes are server-rendered per request
 *     inside the Worker.
 *
 * Local development:
 *   npx wrangler dev          (uses wrangler.toml — mirrors production)
 *
 * Deployment:
 *   npx wrangler deploy       (after `npm run build`)
 */

import { AngularAppEngine } from '@angular/ssr';
// Side-effect import: loading main.server registers the Angular application with
// AngularAppEngine's global app registry. Without this import the engine has no
// application to render, even though the symbol itself is not referenced directly.
import './src/main.server';

// Instantiate the Angular SSR engine once at module scope so it is reused
// across requests within the same Worker isolate — avoids re-initialising the
// Angular application on every request.
const angularApp = new AngularAppEngine();

/**
 * Cloudflare Workers fetch handler.
 *
 * Cloudflare calls this `fetch` export for every incoming HTTP request that is
 * not matched by a static asset in the ASSETS binding.
 *
 * @param request  - The incoming `Request` object (standard fetch API).
 * @param env      - Cloudflare Workers environment bindings (see `Env` below).
 * @param ctx      - Execution context — used for `ctx.waitUntil()` / `ctx.passThroughOnException()`.
 * @returns A `Response` — either SSR-rendered HTML from Angular or a 404.
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Delegate the request to AngularAppEngine.
        // Returns a fully-formed Response (with HTML + headers) for Angular routes,
        // or null if the engine cannot handle the request (e.g. unrecognised path).
        const response = await angularApp.handle(request);
        return response ?? new Response('Not found', { status: 404 });
    },
} satisfies ExportedHandler<Env>;

/**
 * Cloudflare Workers environment bindings.
 *
 * Add KV namespaces, D1 databases, R2 buckets, or secret variables here as
 * the PoC grows. These are declared in `wrangler.toml` and injected by the
 * runtime into the `env` parameter of `fetch()`.
 *
 * Example:
 *   interface Env {
 *     MY_KV: KVNamespace;
 *     API_SECRET: string;
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Env {
    // No bindings configured yet. Add KV namespaces, D1 databases, R2 buckets,
    // or secret variables here as the PoC grows (see JSDoc above for examples).
}
