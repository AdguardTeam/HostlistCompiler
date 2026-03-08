/**
 * Playwright MCP Agent using Cloudflare Browser Rendering.
 *
 * Exposes a Model Context Protocol (MCP) server over Server-Sent Events (SSE),
 * enabling AI tools such as GitHub Copilot to control a real browser via the
 * Cloudflare Browser Rendering service — no local browser installation required.
 *
 * When running locally with `wrangler dev`, the SSE endpoint is available at:
 *   http://localhost:8787/agents/mcp-agent/default/sse
 *
 * When deployed to production:
 *   https://adblock-compiler.jk-com.workers.dev/agents/mcp-agent/default/sse
 *
 * The URL segment `mcp-agent` is derived automatically from the `MCP_AGENT` binding
 * name by the agents SDK (UPPER_SNAKE_CASE → kebab-case).
 *
 * @see https://developers.cloudflare.com/browser-rendering/
 * @see https://github.com/cloudflare/playwright-mcp
 * @see https://developers.cloudflare.com/agents/
 */

import { env } from 'cloudflare:workers';
// @deno-types="./cloudflare-playwright-mcp-types.d.ts"
import { createMcpAgent } from '@cloudflare/playwright-mcp';

// deno-lint-ignore no-explicit-any
export const PlaywrightMcpAgent = createMcpAgent((env as any).BROWSER);
export default PlaywrightMcpAgent;
