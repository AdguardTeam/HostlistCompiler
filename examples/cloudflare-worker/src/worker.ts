/**
 * Cloudflare Worker for compiling hostlists.
 *
 * This worker demonstrates how to use the @anthropic/hostlist-compiler
 * package in a Cloudflare Workers environment.
 *
 * Features:
 * - Compile filter lists from remote URLs
 * - Support for pre-fetched content
 * - Real-time progress events via Server-Sent Events
 * - JSON API for programmatic access
 */

import {
    WorkerCompiler,
    type IConfiguration,
    type ICompilerEvents,
    type WorkerCompilationResult,
} from '../../../src/index.ts';

/**
 * Environment bindings for the worker.
 */
export interface Env {
    COMPILER_VERSION: string;
    // KV namespaces
    COMPILATION_CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    // Static assets namespace (Wrangler Sites)
    __STATIC_CONTENT?: KVNamespace;
    __STATIC_CONTENT_MANIFEST?: string;
}

/**
 * Compile request body structure.
 */
interface CompileRequest {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
}

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

/**
 * Cache TTL in seconds
 */
const CACHE_TTL = 3600; // 1 hour

/**
 * Check rate limit for an IP address
 */
async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    const now = Date.now();
    
    // Get current count
    const data = await env.RATE_LIMIT.get(key, 'json') as { count: number; resetAt: number } | null;
    
    if (!data || now > data.resetAt) {
        // First request or window expired, start new window
        await env.RATE_LIMIT.put(
            key,
            JSON.stringify({ count: 1, resetAt: now + (RATE_LIMIT_WINDOW * 1000) }),
            { expirationTtl: RATE_LIMIT_WINDOW + 10 }
        );
        return true;
    }
    
    if (data.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false; // Rate limit exceeded
    }
    
    // Increment count
    await env.RATE_LIMIT.put(
        key,
        JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }),
        { expirationTtl: RATE_LIMIT_WINDOW + 10 }
    );
    
    return true;
}

/**
 * Generate cache key from configuration
 */
function getCacheKey(config: IConfiguration): string {
    // Create deterministic hash of configuration
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    return `cache:${hashString(normalized)}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Creates a logger that sends events through a TransformStream.
 */
function createStreamingLogger(writer: WritableStreamDefaultWriter<Uint8Array>) {
    const encoder = new TextEncoder();

    const sendEvent = (type: string, data: unknown) => {
        const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(event));
    };

    return {
        sendEvent,
        logger: {
            info: (message: string) => sendEvent('log', { level: 'info', message }),
            warn: (message: string) => sendEvent('log', { level: 'warn', message }),
            error: (message: string) => sendEvent('log', { level: 'error', message }),
            debug: (message: string) => sendEvent('log', { level: 'debug', message }),
        },
    };
}

/**
 * Creates compiler event handlers that stream progress via SSE.
 */
function createStreamingEvents(
    sendEvent: (type: string, data: unknown) => void,
): ICompilerEvents {
    return {
        onSourceStart: (event) => sendEvent('source:start', event),
        onSourceComplete: (event) => sendEvent('source:complete', event),
        onSourceError: (event) => sendEvent('source:error', {
            ...event,
            error: event.error.message,
        }),
        onTransformationStart: (event) => sendEvent('transformation:start', event),
        onTransformationComplete: (event) => sendEvent('transformation:complete', event),
        onTransformationError: (event) => sendEvent('transformation:error', {
            ...event,
            error: event.error.message,
        }),
        onProgress: (event) => sendEvent('progress', event),
        onCompilationComplete: (event) => sendEvent('compilation:complete', event),
    };
}

/**
 * Handle compile requests with streaming response.
 */
async function handleCompileStream(
    request: Request,
    env: Env,
): Promise<Response> {
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;

    // Create a TransformStream for streaming the response
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start compilation in the background
    (async () => {
        try {
            const { sendEvent, logger } = createStreamingLogger(writer);
            const events = createStreamingEvents(sendEvent);

            const compiler = new WorkerCompiler({
                logger,
                events,
                preFetchedContent,
            });

            const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);

            // Send final result
            sendEvent('result', {
                rules: result.rules,
                ruleCount: result.rules.length,
                metrics: result.metrics,
            });

            await writer.write(encoder.encode('event: done\ndata: {}\n\n'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await writer.write(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
            );
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Handle compile requests with JSON response.
 */
async function handleCompileJson(
    request: Request,
    env: Env,
): Promise<Response> {
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;

    // Check cache if no pre-fetched content (pre-fetched = dynamic, don't cache)
    if (!preFetchedContent || Object.keys(preFetchedContent).length === 0) {
        const cacheKey = getCacheKey(configuration);
        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'json');
        
        if (cached) {
            return Response.json({
                ...cached,
                cached: true,
            }, {
                headers: {
                    'X-Cache': 'HIT',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    }

    try {
        const compiler = new WorkerCompiler({
            preFetchedContent,
        });

        const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);

        const response = {
            success: true,
            rules: result.rules,
            ruleCount: result.rules.length,
            metrics: result.metrics,
        };

        // Cache the result if no pre-fetched content
        if (!preFetchedContent || Object.keys(preFetchedContent).length === 0) {
            const cacheKey = getCacheKey(configuration);
            await env.COMPILATION_CACHE.put(
                cacheKey,
                JSON.stringify(response),
                { expirationTtl: CACHE_TTL }
            );
        }

        return Response.json(response, {
            headers: {
                'X-Cache': 'MISS',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}

/**
 * Handle GET requests - return API info and example.
 */
function handleInfo(env: Env): Response {
    const info = {
        name: 'Hostlist Compiler Worker',
        version: env.COMPILER_VERSION,
        endpoints: {
            'GET /': 'Web UI for interactive compilation',
            'GET /api': 'API information (this endpoint)',
            'POST /compile': 'Compile a filter list (JSON response)',
            'POST /compile/stream': 'Compile with real-time progress (SSE)',
        },
        example: {
            method: 'POST',
            url: '/compile',
            body: {
                configuration: {
                    name: 'My Filter List',
                    sources: [
                        {
                            name: 'Example Source',
                            source: 'https://example.com/filters.txt',
                        },
                    ],
                    transformations: ['Deduplicate', 'RemoveEmptyLines'],
                },
                benchmark: true,
            },
        },
    };

    return Response.json(info, {
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Handle CORS preflight requests.
 */
function handleCors(): Response {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/**
 * Serve the web UI HTML.
 */
function serveWebUI(): Response {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hostlist Compiler</title>
</head>
<body style="font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
    <h1>🛡️ Hostlist Compiler API</h1>
    <p>The web UI is available for local development only.</p>
    <p>To use the web interface locally, run:</p>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">npm run dev</pre>
    <p>Then visit: <code>http://localhost:8787</code></p>
    
    <h2>API Endpoints</h2>
    <ul>
        <li><strong>GET /api</strong> - API information</li>
        <li><strong>POST /compile</strong> - Compile filter list (JSON response)</li>
        <li><strong>POST /compile/stream</strong> - Compile with real-time progress (SSE)</li>
    </ul>
    
    <h2>Example Usage</h2>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">curl -X POST https://adblock-compiler.jayson-knight.workers.dev/compile \\
  -H "Content-Type: application/json" \\
  -d '{
    "configuration": {
      "name": "My Filter List",
      "sources": [
        { "source": "https://example.com/filters.txt" }
      ],
      "transformations": ["Deduplicate", "RemoveEmptyLines"]
    }
  }'</pre>
  
    <p><a href="/api">View full API documentation →</a></p>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
    });
}

/**
 * Main fetch handler for the Cloudflare Worker.
 */
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const { pathname } = url;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCors();
        }

        // Handle API routes
        if (pathname === '/api' && request.method === 'GET') {
            return handleInfo(env);
        }

        // Rate limit compile endpoints
        if ((pathname === '/compile' || pathname === '/compile/stream') && request.method === 'POST') {
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            const allowed = await checkRateLimit(env, ip);
            
            if (!allowed) {
                return Response.json(
                    { 
                        success: false, 
                        error: 'Rate limit exceeded. Maximum 10 requests per minute.' 
                    },
                    { 
                        status: 429,
                        headers: {
                            'Retry-After': '60',
                            'Access-Control-Allow-Origin': '*',
                        },
                    }
                );
            }

            if (pathname === '/compile') {
                return handleCompileJson(request, env);
            }

            if (pathname === '/compile/stream') {
                return handleCompileStream(request, env);
            }
        }

        // Serve web UI for root path
        if (pathname === '/' && request.method === 'GET') {
            return serveWebUI();
        }

        return new Response('Not Found', { status: 404 });
    },
};
