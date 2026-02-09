/**
 * Standardized response utilities for the Cloudflare Worker.
 * Provides consistent JSON response formatting with CORS headers.
 */

import { ErrorUtils } from '../../src/utils/index.ts';

/**
 * Default CORS headers applied to all responses
 */
const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
};

/**
 * Response options for customizing responses
 */
export interface ResponseOptions {
    status?: number;
    headers?: Record<string, string>;
    cache?: 'no-cache' | 'public' | 'private';
    maxAge?: number;
}

/**
 * Standardized JSON response factory.
 * All responses include CORS headers and consistent structure.
 */
export const JsonResponse = {
    /**
     * Create a success response
     * @param data - Response data (will be merged with { success: true })
     * @param options - Response options
     */
    success<T extends Record<string, unknown>>(
        data: T,
        options: ResponseOptions = {},
    ): Response {
        const headers = buildHeaders(options);
        return Response.json(
            { success: true, ...data },
            { status: options.status ?? 200, headers },
        );
    },

    /**
     * Create an error response
     * @param error - Error message or Error object
     * @param status - HTTP status code (default: 500)
     * @param options - Additional response options
     */
    error(
        error: string | Error | unknown,
        status = 500,
        options: Omit<ResponseOptions, 'status'> = {},
    ): Response {
        const message = ErrorUtils.getMessage(error);
        const headers = buildHeaders({ ...options, status });
        return Response.json(
            { success: false, error: message },
            { status, headers },
        );
    },

    /**
     * Create a 400 Bad Request response
     */
    badRequest(error: string | Error | unknown, options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.error(error, 400, options);
    },

    /**
     * Create a 401 Unauthorized response
     */
    unauthorized(error = 'Unauthorized', options: Omit<ResponseOptions, 'status'> = {}): Response {
        const headers = buildHeaders({ ...options, status: 401 });
        headers['WWW-Authenticate'] = 'X-Admin-Key';
        return Response.json(
            { success: false, error },
            { status: 401, headers },
        );
    },

    /**
     * Create a 403 Forbidden response
     */
    forbidden(error: string | Error | unknown, options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.error(error, 403, options);
    },

    /**
     * Create a 404 Not Found response
     */
    notFound(error = 'Not found', options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.error(error, 404, options);
    },

    /**
     * Create a 429 Rate Limited response
     * @param retryAfter - Seconds until the rate limit resets
     */
    rateLimited(retryAfter = 60, options: Omit<ResponseOptions, 'status'> = {}): Response {
        const headers = buildHeaders({ ...options, status: 429 });
        headers['Retry-After'] = retryAfter.toString();
        return Response.json(
            {
                success: false,
                error: `Rate limit exceeded. Maximum requests per ${retryAfter} seconds.`,
            },
            { status: 429, headers },
        );
    },

    /**
     * Create a 500 Internal Server Error response
     */
    serverError(error: string | Error | unknown, options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.error(error, 500, options);
    },

    /**
     * Create a 503 Service Unavailable response
     */
    serviceUnavailable(error: string | Error | unknown, options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.error(error, 503, options);
    },

    /**
     * Create a 202 Accepted response (for async operations)
     */
    accepted<T extends Record<string, unknown>>(data: T, options: Omit<ResponseOptions, 'status'> = {}): Response {
        return this.success(data, { ...options, status: 202 });
    },

    /**
     * Create a cached success response
     * @param data - Response data
     * @param maxAge - Cache max-age in seconds
     */
    cached<T extends Record<string, unknown>>(data: T, maxAge: number): Response {
        return this.success(data, { cache: 'public', maxAge });
    },

    /**
     * Create a no-cache success response
     */
    noCache<T extends Record<string, unknown>>(data: T): Response {
        return this.success(data, { cache: 'no-cache' });
    },
};

/**
 * Build headers object with CORS and cache control
 */
function buildHeaders(options: ResponseOptions): Record<string, string> {
    const headers: Record<string, string> = { ...CORS_HEADERS };

    // Add custom headers
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    // Add cache control
    if (options.cache === 'no-cache') {
        headers['Cache-Control'] = 'no-cache';
    } else if (options.cache && options.maxAge) {
        headers['Cache-Control'] = `${options.cache}, max-age=${options.maxAge}`;
    } else if (options.maxAge) {
        headers['Cache-Control'] = `public, max-age=${options.maxAge}`;
    }

    return headers;
}

/**
 * CORS preflight response handler
 */
export function corsPreflightResponse(): Response {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/**
 * Generate a unique request ID
 * @param prefix - Prefix for the ID (e.g., 'api', 'compile', 'batch')
 */
export function generateRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate a unique workflow ID
 * @param prefix - Prefix for the ID (e.g., 'wf-compile', 'wf-batch')
 */
export function generateWorkflowId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
