/**
 * Minimal type declarations for `@cloudflare/playwright-mcp`.
 *
 * The full package's type graph transitively pulls in the entire `agents` SDK
 * (McpAgent → Agent → Server → partyserver → ai-sdk + MCP SDK) which causes
 * Deno's TypeScript checker to overflow its call stack when the exported class
 * is referenced inside large worker files.
 *
 * These stubs expose just enough typing for the code paths we use while
 * keeping `deno check` stable.  The real types are only needed by the
 * Cloudflare Workers runtime / wrangler bundler, which uses tsc directly and
 * handles the complexity without issue.
 */

declare module '@cloudflare/playwright-mcp' {
    /**
     * Creates a Durable Object class that acts as a Playwright MCP server,
     * backed by Cloudflare Browser Rendering.
     *
     * @param endpoint - The `BROWSER` binding from the Worker `env`, or a
     *   string endpoint URL.
     * @param options  - Optional configuration (passed through to the agent).
     * @returns A Durable Object constructor compatible with the Cloudflare
     *   Workers runtime.
     */
    // deno-lint-ignore no-explicit-any
    export function createMcpAgent(endpoint: any, options?: any): new (ctx: any, env: any) => any;
}
