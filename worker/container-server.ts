/**
 * Cloudflare Container HTTP Server
 *
 * Minimal Deno HTTP server that runs inside the AdblockCompiler Cloudflare
 * Container. The Container Durable Object in worker.ts extends `Container`
 * from `@cloudflare/containers`, which starts this server and proxies
 * incoming Worker requests to it on `defaultPort` (8787).
 *
 * Endpoints:
 *   GET  /health   — liveness probe used by Cloudflare and the Docker HEALTHCHECK
 *   POST /compile  — compile a filter list and return the result as plain text
 */

import { WorkerCompiler } from '../src/platform/index.ts';
import type { IConfiguration } from '../src/types/index.ts';
import { VERSION } from '../src/version.ts';

const PORT = parseInt(Deno.env.get('PORT') ?? '8787', 10);

/**
 * Request body accepted by `POST /compile`.
 */
interface ContainerCompileRequest {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
}

async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json({ status: 'ok', version: VERSION });
    }

    if (request.method === 'POST' && url.pathname === '/compile') {
        let body: ContainerCompileRequest;
        try {
            body = await request.json() as ContainerCompileRequest;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new Response(`Invalid JSON body: ${message}`, { status: 400 });
        }

        if (!body?.configuration) {
            return new Response('Missing required field: configuration', { status: 400 });
        }

        try {
            const compiler = new WorkerCompiler({
                preFetchedContent: body.preFetchedContent,
            });
            const rules = await compiler.compile(body.configuration);
            const output = rules.join('\n');
            return new Response(output, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[container-server] Compilation error:', message);
            return new Response(`Compilation failed: ${message}`, { status: 500 });
        }
    }

    return new Response('Not Found', { status: 404 });
}

console.log(`[container-server] Listening on port ${PORT}`);
Deno.serve({ port: PORT, hostname: '0.0.0.0' }, handler);
