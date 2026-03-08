/**
 * Thin wrapper around the `agents` SDK's `routeAgentRequest` helper.
 *
 * The `agents` package ships a very large type graph (partyserver, partysocket,
 * ai-sdk, MCP SDK, …) that causes Deno's TypeScript checker to overflow its call
 * stack when the import is resolved together with the rest of worker.ts.
 * The `@deno-types` pragma below redirects Deno to minimal type stubs, keeping
 * the rest of the codebase type-check clean.
 */

// @deno-types="./agents-types.d.ts"
import { routeAgentRequest as _routeAgentRequest } from 'agents';

/**
 * Routes incoming requests to the appropriate Durable Object agent (e.g. the
 * Playwright MCP Agent) and returns the agent's Response, or `null` when the
 * URL does not match an agents path.
 *
 * URL pattern: `/agents/{binding-kebab-case}/{agentId}`
 * Example SSE endpoint: `GET /agents/mcp-agent/default/sse`
 */
export async function routeAgentRequest(request: Request, env: unknown): Promise<Response | null> {
    return (await _routeAgentRequest(request, env)) ?? null;
}
