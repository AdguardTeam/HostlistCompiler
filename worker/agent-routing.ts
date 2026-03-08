/**
 * Minimal, dependency-free Durable Object agent request router.
 *
 * Routes requests matching `/agents/{name}/{instanceId}[/…]` to the
 * corresponding Durable Object binding in `env`, with no Node.js built-in
 * dependencies (avoids `async_hooks`, `path`, etc. that the `agents` SDK
 * pulls in and that break wrangler's esbuild bundler).
 */

import type { Env } from './types.ts';

/** Matches `/agents/<agentName>/<instanceId>[/rest]` */
const AGENT_PATH_RE = /^\/agents\/([^/]+)\/([^/]+)(\/.*)?$/;

/**
 * Converts a kebab-case agent name (from the URL segment) to the
 * UPPER_SNAKE_CASE Env binding key.
 * e.g. `mcp-agent` → `MCP_AGENT`
 */
export function agentNameToBindingKey(name: string): string {
    return name.replace(/-/g, '_').toUpperCase();
}

/**
 * Routes incoming requests to the appropriate Durable Object agent and returns
 * the agent's Response, or `null` when the URL does not match an agents path.
 *
 * URL pattern: `/agents/{binding-kebab-case}/{agentId}[/*]`
 * Example SSE endpoint: `GET /agents/mcp-agent/default/sse`
 */
export async function routeAgentRequest(request: Request, env: Env): Promise<Response | null> {
    const url = new URL(request.url);
    const match = url.pathname.match(AGENT_PATH_RE);
    if (!match) return null;

    const [, agentName, instanceId] = match;
    const bindingKey = agentNameToBindingKey(agentName) as keyof Env;
    const ns = env[bindingKey] as DurableObjectNamespace | undefined;
    if (!ns || typeof ns.idFromName !== 'function') return null;

    const stub = ns.get(ns.idFromName(instanceId));
    return stub.fetch(request);
}
