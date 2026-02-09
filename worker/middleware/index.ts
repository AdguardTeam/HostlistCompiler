/**
 * Middleware functions for the Cloudflare Worker.
 * Provides rate limiting, authentication, and verification.
 */

import { WORKER_DEFAULTS } from '../../src/config/defaults.ts';
import { ErrorUtils } from '../../src/utils/index.ts';
import type {
    AdminAuthResult,
    Env,
    RateLimitData,
    TurnstileResult,
    TurnstileVerifyResponse,
} from '../types.ts';

// ============================================================================
// Configuration Constants
// ============================================================================

const RATE_LIMIT_WINDOW = WORKER_DEFAULTS.RATE_LIMIT_WINDOW_SECONDS;
const RATE_LIMIT_MAX_REQUESTS = WORKER_DEFAULTS.RATE_LIMIT_MAX_REQUESTS;

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check rate limit for an IP address.
 * Returns true if the request is allowed, false if rate limited.
 *
 * @param env - Environment bindings
 * @param ip - Client IP address
 * @returns Promise resolving to whether the request is allowed
 */
export async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    // Get current count
    const data = await env.RATE_LIMIT.get(key, 'json') as RateLimitData | null;

    if (!data || now > data.resetAt) {
        // First request or window expired, start new window
        await env.RATE_LIMIT.put(
            key,
            JSON.stringify({ count: 1, resetAt: now + (RATE_LIMIT_WINDOW * 1000) }),
            { expirationTtl: RATE_LIMIT_WINDOW + 10 },
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
        { expirationTtl: RATE_LIMIT_WINDOW + 10 },
    );

    return true;
}

/**
 * Get rate limit configuration
 */
export function getRateLimitConfig() {
    return {
        window: RATE_LIMIT_WINDOW,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
    };
}

// ============================================================================
// Turnstile Verification
// ============================================================================

/**
 * Verify Cloudflare Turnstile token.
 *
 * @param env - Environment bindings
 * @param token - Turnstile token from client
 * @param ip - Client IP address
 * @returns Verification result
 */
export async function verifyTurnstileToken(
    env: Env,
    token: string,
    ip: string,
): Promise<TurnstileResult> {
    // If Turnstile is not configured, skip verification
    if (!env.TURNSTILE_SECRET_KEY) {
        return { success: true };
    }

    if (!token) {
        return { success: false, error: 'Missing Turnstile token' };
    }

    try {
        const formData = new FormData();
        formData.append('secret', env.TURNSTILE_SECRET_KEY);
        formData.append('response', token);
        formData.append('remoteip', ip);

        const response = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                body: formData,
            },
        );

        const result = await response.json() as TurnstileVerifyResponse;

        if (result.success) {
            return { success: true };
        }

        const errorCodes = result['error-codes'] || [];
        return {
            success: false,
            error: `Turnstile verification failed: ${errorCodes.join(', ') || 'unknown error'}`,
        };
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Turnstile verification error:', error);
        return {
            success: false,
            error: 'Turnstile verification service unavailable',
        };
    }
}

/**
 * Check if Turnstile is enabled
 */
export function isTurnstileEnabled(env: Env): boolean {
    return !!env.TURNSTILE_SECRET_KEY;
}

// ============================================================================
// Admin Authentication
// ============================================================================

/**
 * Verify admin authentication from request headers.
 *
 * @param request - Incoming request
 * @param env - Environment bindings
 * @returns Authorization result
 */
export function verifyAdminAuth(request: Request, env: Env): AdminAuthResult {
    const adminKey = request.headers.get('X-Admin-Key');

    // If no ADMIN_KEY is configured, admin features are disabled
    if (!env.ADMIN_KEY) {
        return { authorized: false, error: 'Admin features not configured' };
    }

    // Verify the provided key matches
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return { authorized: false, error: 'Unauthorized' };
    }

    return { authorized: true };
}

/**
 * Check if admin features are available
 */
export function isAdminEnabled(env: Env): boolean {
    return !!env.ADMIN_KEY;
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Parse JSON body from request with error handling
 */
export async function parseJsonBody<T>(request: Request): Promise<{ data?: T; error?: string }> {
    try {
        const data = await request.json() as T;
        return { data };
    } catch (error) {
        return { error: `Invalid JSON: ${ErrorUtils.getMessage(error)}` };
    }
}

/**
 * Clone request and parse body (for middleware that needs to read body)
 */
export async function cloneAndParseBody<T>(request: Request): Promise<{ data?: T; error?: string }> {
    const cloned = request.clone();
    // Type assertion needed due to Cloudflare Workers types
    return parseJsonBody<T>(cloned as Request);
}
