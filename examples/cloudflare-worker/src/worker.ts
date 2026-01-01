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
} from '@anthropic/hostlist-compiler';

/**
 * Environment bindings for the worker.
 */
export interface Env {
    COMPILER_VERSION: string;
    // Optional KV binding for caching
    FILTER_CACHE?: KVNamespace;
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

    try {
        const compiler = new WorkerCompiler({
            preFetchedContent,
        });

        const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);

        return Response.json({
            success: true,
            rules: result.rules,
            ruleCount: result.rules.length,
            metrics: result.metrics,
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

        // Route requests
        switch (pathname) {
            case '/':
                if (request.method === 'GET') {
                    return handleInfo(env);
                }
                break;

            case '/compile':
                if (request.method === 'POST') {
                    return handleCompileJson(request, env);
                }
                break;

            case '/compile/stream':
                if (request.method === 'POST') {
                    return handleCompileStream(request, env);
                }
                break;
        }

        return new Response('Not Found', { status: 404 });
    },
};
