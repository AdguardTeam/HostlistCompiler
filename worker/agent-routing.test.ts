/**
 * Unit tests for the agent-routing wrapper.
 *
 * The wrapper delegates to `agents` SDK's `routeAgentRequest` and guarantees
 * it always returns `Response | null` (never `undefined`).
 *
 * Non-matching URLs are the primary case we can test without a live Worker
 * runtime: the `agents` SDK short-circuits at URL pattern inspection and
 * returns `undefined` before touching any `env` bindings.
 *
 * Note: The `agents` npm package imports `cloudflare:*` modules at the top
 * level.  Outside the Cloudflare Workers runtime (e.g. `deno test`) those
 * imports fail with ERR_UNSUPPORTED_ESM_URL_SCHEME.  Tests here use a dynamic
 * import and are skipped automatically when the runtime is unavailable.
 */

import { assertEquals } from '@std/assert';

type RouteAgentFn = (request: Request, env: unknown) => Promise<Response | null>;

// Attempt to load the module; it requires the Cloudflare Workers runtime.
let routeAgentRequest: RouteAgentFn | null = null;
try {
    const mod = await import('./agent-routing.ts');
    routeAgentRequest = mod.routeAgentRequest;
} catch {
    // Not in Cloudflare Workers runtime — tests below will be skipped.
}

const skip = routeAgentRequest === null;

Deno.test({
    name: 'routeAgentRequest - returns null for a non-agent path',
    ignore: skip,
    async fn() {
        const request = new Request('https://example.com/api/compile', { method: 'GET' });
        const result = await routeAgentRequest!(request, {});
        assertEquals(result, null);
    },
});

Deno.test({
    name: 'routeAgentRequest - returns null for root path',
    ignore: skip,
    async fn() {
        const request = new Request('https://example.com/', { method: 'GET' });
        const result = await routeAgentRequest!(request, {});
        assertEquals(result, null);
    },
});

Deno.test({
    name: 'routeAgentRequest - returns null for a path that starts with "agent" but is not a valid agent route',
    ignore: skip,
    async fn() {
        const request = new Request('https://example.com/agent-tools', { method: 'GET' });
        const result = await routeAgentRequest!(request, {});
        assertEquals(result, null);
    },
});

Deno.test({
    name: 'routeAgentRequest - returns null for a POST to a non-agent path',
    ignore: skip,
    async fn() {
        const request = new Request('https://example.com/compile', { method: 'POST' });
        const result = await routeAgentRequest!(request, {});
        assertEquals(result, null);
    },
});

Deno.test({
    name: 'routeAgentRequest - returns null when env is empty and URL does not match',
    ignore: skip,
    async fn() {
        const request = new Request('https://adblock-compiler.jk-com.workers.dev/api/version', { method: 'GET' });
        const result = await routeAgentRequest!(request, {});
        assertEquals(result, null);
    },
});
