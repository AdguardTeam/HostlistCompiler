/**
 * Unit tests for the PlaywrightMcpAgent module.
 *
 * `PlaywrightMcpAgent` is produced at module evaluation time by `createMcpAgent`
 * from `@cloudflare/playwright-mcp`.  These tests verify that the module exports
 * are properly wired and that the value has the shape expected by the Cloudflare
 * Workers runtime (a constructor function / Durable Object class).
 *
 * Note: `@cloudflare/playwright-mcp` transitively imports `cloudflare:*` modules
 * at the top level.  Outside the Cloudflare Workers runtime (e.g. `deno test`)
 * those imports fail with ERR_UNSUPPORTED_ESM_URL_SCHEME.  Tests here use a
 * dynamic import and are skipped automatically when the runtime is unavailable.
 */

import { assertEquals, assertExists } from '@std/assert';

// deno-lint-ignore no-explicit-any
type AnyConstructor = new (...args: any[]) => any;
interface McpAgentModule {
    PlaywrightMcpAgent: AnyConstructor;
    default: AnyConstructor;
}

// Attempt to load the module; it requires the Cloudflare Workers runtime.
let mcpModule: McpAgentModule | null = null;
try {
    mcpModule = await import('./mcp-agent.ts') as McpAgentModule;
} catch {
    // Not in Cloudflare Workers runtime — tests below will be skipped.
}

const skip = mcpModule === null;

Deno.test({
    name: 'PlaywrightMcpAgent - named export exists',
    ignore: skip,
    fn() {
        assertExists(mcpModule!.PlaywrightMcpAgent);
    },
});

Deno.test({
    name: 'PlaywrightMcpAgent - named export is a constructor (function)',
    ignore: skip,
    fn() {
        assertEquals(typeof mcpModule!.PlaywrightMcpAgent, 'function');
    },
});

Deno.test({
    name: 'PlaywrightMcpAgent - default export matches named export',
    ignore: skip,
    fn() {
        assertEquals(mcpModule!.default, mcpModule!.PlaywrightMcpAgent);
    },
});

Deno.test({
    name: 'PlaywrightMcpAgent - has a prototype (is a class)',
    ignore: skip,
    fn() {
        assertExists(mcpModule!.PlaywrightMcpAgent.prototype);
    },
});
