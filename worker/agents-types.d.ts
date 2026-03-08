/**
 * Minimal type declarations for the `agents` npm package.
 *
 * The full `agents` type graph (partyserver + ai-sdk + MCP SDK + …) causes
 * Deno's TypeScript checker to overflow its call stack inside large worker
 * files.  These minimal stubs provide just enough type information for the
 * code paths we actually use, while keeping `deno check` stable.
 *
 * @see https://www.npmjs.com/package/agents
 */

declare module 'agents' {
    /**
     * Routes an incoming request to the appropriate Durable Object agent.
     * Returns a Response when the URL matches an agents path
     * (`/agents/{binding-kebab}/{id}` or WebSocket upgrade for the same),
     * or `undefined` when it does not.
     */
    export function routeAgentRequest(
        request: Request,
        // deno-lint-ignore no-explicit-any
        env: any,
        // deno-lint-ignore no-explicit-any
        options?: any,
    ): Promise<Response | undefined>;
}
