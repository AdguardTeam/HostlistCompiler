/**
 * Unit tests for the self-contained DO agent router.
 *
 * No Node.js built-ins are imported, so these tests run directly under
 * `deno test` without any Cloudflare Workers runtime (no skip/ignore needed).
 */

import { assertEquals, assertMatch } from '@std/assert';
import { agentNameToBindingKey, routeAgentRequest } from './agent-routing.ts';
import type { Env } from './types.ts';

// ---------------------------------------------------------------------------
// agentNameToBindingKey
// ---------------------------------------------------------------------------

Deno.test('agentNameToBindingKey - converts single-segment name', () => {
    assertEquals(agentNameToBindingKey('mcp-agent'), 'MCP_AGENT');
});

Deno.test('agentNameToBindingKey - converts multi-segment name', () => {
    assertEquals(agentNameToBindingKey('my-cool-agent'), 'MY_COOL_AGENT');
});

Deno.test('agentNameToBindingKey - already uppercase is preserved', () => {
    assertEquals(agentNameToBindingKey('AGENT'), 'AGENT');
});

// ---------------------------------------------------------------------------
// routeAgentRequest — non-matching paths → null
// ---------------------------------------------------------------------------

Deno.test('routeAgentRequest - returns null for a non-agent path', async () => {
    const req = new Request('https://example.com/api/compile');
    assertEquals(await routeAgentRequest(req, {} as Env), null);
});

Deno.test('routeAgentRequest - returns null for root path', async () => {
    const req = new Request('https://example.com/');
    assertEquals(await routeAgentRequest(req, {} as Env), null);
});

Deno.test('routeAgentRequest - returns null for path starting with "agent" but missing segments', async () => {
    const req = new Request('https://example.com/agents');
    assertEquals(await routeAgentRequest(req, {} as Env), null);
});

Deno.test('routeAgentRequest - returns null for /agents/<name> (no instance ID)', async () => {
    const req = new Request('https://example.com/agents/mcp-agent');
    assertEquals(await routeAgentRequest(req, {} as Env), null);
});

Deno.test('routeAgentRequest - returns null when binding is absent from env', async () => {
    // URL matches the pattern but no MCP_AGENT binding in env
    const req = new Request('https://example.com/agents/mcp-agent/default/sse');
    assertEquals(await routeAgentRequest(req, {} as Env), null);
});

// ---------------------------------------------------------------------------
// routeAgentRequest — matching path with mock DO binding
// ---------------------------------------------------------------------------

Deno.test('routeAgentRequest - forwards matching request to the DO stub', async () => {
    const mockBody = 'agent response';
    const mockResponse = new Response(mockBody, { status: 200 });

    // Minimal Durable Object namespace mock
    const mockNs = {
        idFromName: (_name: string) => ({ toString: () => 'mock-id' }),
        get: (_id: unknown) => ({ fetch: (_req: Request) => Promise.resolve(mockResponse) }),
    } as unknown as DurableObjectNamespace;

    const env = { MCP_AGENT: mockNs } as unknown as Env;
    const req = new Request('https://example.com/agents/mcp-agent/default/sse');
    const result = await routeAgentRequest(req, env);

    assertEquals(result, mockResponse);
    assertEquals(await result!.text(), mockBody);
});

Deno.test('routeAgentRequest - uses instanceId from URL as the DO name', async () => {
    let capturedName = '';

    const mockNs = {
        idFromName: (name: string) => { capturedName = name; return { toString: () => name }; },
        get: (_id: unknown) => ({ fetch: (_req: Request) => Promise.resolve(new Response('ok')) }),
    } as unknown as DurableObjectNamespace;

    const env = { MCP_AGENT: mockNs } as unknown as Env;
    const req = new Request('https://example.com/agents/mcp-agent/my-session/sse');
    await routeAgentRequest(req, env);

    assertEquals(capturedName, 'my-session');
});

Deno.test('routeAgentRequest - resolves binding key via agentNameToBindingKey', async () => {
    // Verify mcp-agent → MCP_AGENT look-up (not some other binding)
    const mockNs = {
        idFromName: (_name: string) => ({ toString: () => 'id' }),
        get: (_id: unknown) => ({ fetch: (_req: Request) => Promise.resolve(new Response('mcp')) }),
    } as unknown as DurableObjectNamespace;

    const env = { MCP_AGENT: mockNs } as unknown as Env;
    const req = new Request('https://example.com/agents/mcp-agent/default');
    const result = await routeAgentRequest(req, env);

    assertMatch(await result!.text(), /mcp/);
});

