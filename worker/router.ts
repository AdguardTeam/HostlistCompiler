/**
 * Thin orchestrator router for the Cloudflare Worker.
 *
 * This module demonstrates the modular routing pattern that the worker.ts
 * should migrate towards. It imports handlers from dedicated modules
 * and orchestrates routing with minimal logic.
 *
 * Migration path:
 * 1. Use this router for new endpoints
 * 2. Gradually move existing endpoints from worker.ts
 * 3. Eventually replace worker.ts with this pattern
 */

import type { Env } from './types.ts';
import { JsonResponse } from './utils/response.ts';
import { checkRateLimit, verifyAdminAuth, verifyTurnstileToken } from './middleware/index.ts';
import { handleASTParseRequest, handleCompileAsync, handleCompileBatch, handleCompileBatchAsync, handleCompileJson, handleCompileStream } from './handlers/compile.ts';
import { handleMetrics, recordMetric } from './handlers/metrics.ts';
import { handleQueueResults, handleQueueStats } from './handlers/queue.ts';
import {
    handleAdminClearCache,
    handleAdminClearExpired,
    handleAdminExport,
    handleAdminListTables,
    handleAdminQuery,
    handleAdminStorageStats,
    handleAdminVacuum,
} from './handlers/admin.ts';

// Re-export Env type for external use
export type { Env };

/**
 * Route handler type
 */
type RouteHandler = (
    request: Request,
    env: Env,
    params: RouteParams,
) => Promise<Response>;

/**
 * Route parameters extracted from URL
 */
interface RouteParams {
    pathname: string;
    searchParams: URLSearchParams;
    ip: string;
    requestId: string;
    pathParams: Record<string, string>;
}

/**
 * Route definition
 */
interface Route {
    method: string;
    pattern: RegExp | string;
    handler: RouteHandler;
    rateLimit?: boolean;
    requireAuth?: boolean;
    turnstile?: boolean;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * CORS preflight handler
 */
function handleCors(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/**
 * API info handler
 */
async function handleInfo(
    _request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    return JsonResponse.success({
        name: 'adblock-compiler-worker',
        version: env.COMPILER_VERSION || 'unknown',
        endpoints: {
            compile: 'POST /compile',
            compileStream: 'POST /compile/stream',
            compileBatch: 'POST /compile/batch',
            compileAsync: 'POST /compile/async',
            metrics: 'GET /metrics',
            queueStats: 'GET /queue/stats',
            health: 'GET /health',
        },
    });
}

/**
 * Route definitions using the modular handlers
 */
const routes: Route[] = [
    // API Info
    {
        method: 'GET',
        pattern: '/api',
        handler: handleInfo,
    },

    // Metrics
    {
        method: 'GET',
        pattern: '/metrics',
        handler: async (_req, env) => handleMetrics(env),
    },

    // Queue Stats
    {
        method: 'GET',
        pattern: '/queue/stats',
        handler: async (_req, env) => handleQueueStats(env),
    },

    // Queue Results (with path parameter)
    {
        method: 'GET',
        pattern: /^\/queue\/results\/(?<requestId>[^/]+)$/,
        handler: async (_req, env, params) =>
            handleQueueResults(params.pathParams.requestId, env),
    },

    // Compilation endpoints
    {
        method: 'POST',
        pattern: '/compile',
        handler: async (req, env, params) =>
            handleCompileJson(req, env, undefined, params.requestId),
        rateLimit: true,
        turnstile: true,
    },
    {
        method: 'POST',
        pattern: '/compile/stream',
        handler: async (req, env) =>
            handleCompileStream(req, env),
        rateLimit: true,
        turnstile: true,
    },
    {
        method: 'POST',
        pattern: '/compile/batch',
        handler: async (req, env) =>
            handleCompileBatch(req, env),
        rateLimit: true,
        turnstile: true,
    },
    {
        method: 'POST',
        pattern: '/compile/async',
        handler: async (req, env) =>
            handleCompileAsync(req, env),
        rateLimit: true,
        turnstile: true,
    },
    {
        method: 'POST',
        pattern: '/compile/batch/async',
        handler: async (req, env) =>
            handleCompileBatchAsync(req, env),
        rateLimit: true,
        turnstile: true,
    },
    {
        method: 'POST',
        pattern: '/ast/parse',
        handler: async (req, env) =>
            handleASTParseRequest(req, env),
        rateLimit: true,
    },

    // Admin endpoints
    {
        method: 'GET',
        pattern: '/admin/storage/stats',
        handler: async (_req, env) => handleAdminStorageStats(env),
        requireAuth: true,
    },
    {
        method: 'POST',
        pattern: '/admin/storage/clear-expired',
        handler: async (_req, env) => handleAdminClearExpired(env),
        requireAuth: true,
    },
    {
        method: 'POST',
        pattern: '/admin/storage/clear-cache',
        handler: async (_req, env) => handleAdminClearCache(env),
        requireAuth: true,
    },
    {
        method: 'GET',
        pattern: '/admin/storage/export',
        handler: async (_req, env) => handleAdminExport(env),
        requireAuth: true,
    },
    {
        method: 'POST',
        pattern: '/admin/storage/vacuum',
        handler: async (_req, env) => handleAdminVacuum(env),
        requireAuth: true,
    },
    {
        method: 'GET',
        pattern: '/admin/storage/tables',
        handler: async (_req, env) => handleAdminListTables(env),
        requireAuth: true,
    },
    {
        method: 'POST',
        pattern: '/admin/storage/query',
        handler: async (req, env) => handleAdminQuery(req, env),
        requireAuth: true,
    },
];

/**
 * Find matching route for a request
 */
function findRoute(
    method: string,
    pathname: string,
): { route: Route; pathParams: Record<string, string> } | null {
    for (const route of routes) {
        if (route.method !== method) continue;

        if (typeof route.pattern === 'string') {
            if (route.pattern === pathname) {
                return { route, pathParams: {} };
            }
        } else {
            const match = pathname.match(route.pattern);
            if (match) {
                return {
                    route,
                    pathParams: match.groups || {},
                };
            }
        }
    }
    return null;
}

/**
 * Main router function - thin orchestrator pattern
 *
 * This is the pattern that worker.ts should migrate towards.
 * Routes are defined declaratively with middleware flags.
 */
export async function handleRequest(
    request: Request,
    env: Env,
): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const requestId = generateRequestId('api');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return handleCors();
    }

    // Find matching route
    const match = findRoute(request.method, pathname);

    if (!match) {
        return JsonResponse.error('Not found', 404);
    }

    const { route, pathParams } = match;
    const params: RouteParams = {
        pathname,
        searchParams,
        ip,
        requestId,
        pathParams,
    };

    // Apply middleware based on route flags
    const startTime = performance.now();

    try {
        // Rate limiting
        if (route.rateLimit) {
            const allowed = await checkRateLimit(env, ip);
            if (!allowed) {
                return JsonResponse.error('Rate limit exceeded', 429);
            }
        }

        // Admin authentication
        if (route.requireAuth) {
            const auth = verifyAdminAuth(request, env);
            if (!auth.authorized) {
                return JsonResponse.error(auth.error || 'Unauthorized', 401);
            }
        }

        // Turnstile verification
        if (route.turnstile) {
            try {
                const body = await request.clone().json() as { turnstileToken?: string };
                if (body.turnstileToken) {
                    const result = await verifyTurnstileToken(env, body.turnstileToken, ip);
                    if (!result.success) {
                        return JsonResponse.error(result.error || 'Turnstile verification failed', 403);
                    }
                }
            } catch {
                // Body parsing failed, skip turnstile check
            }
        }

        // Execute handler
        const response = await route.handler(request, env, params);

        // Record metrics
        const duration = performance.now() - startTime;
        await recordMetric(env, pathname, duration, response.ok);

        return response;
    } catch (error) {
        const duration = performance.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        await recordMetric(env, pathname, duration, false, message);

        return JsonResponse.error(message, 500);
    }
}

/**
 * Create a worker export using the thin orchestrator
 *
 * Example usage in wrangler.toml:
 * ```toml
 * main = "worker/router.ts"
 * ```
 */
export default {
    fetch: handleRequest,
};
