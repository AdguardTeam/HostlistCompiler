/**
 * Middleware functions for the Cloudflare Worker.
 * Provides rate limiting, authentication, and verification.
 */

import { WORKER_DEFAULTS } from '../../src/config/defaults.ts';
import { ErrorUtils } from '../../src/utils/index.ts';
import type { AdminAuthResult, Env, RateLimitData, TurnstileResult, TurnstileVerifyResponse } from '../types.ts';

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
 * Constant-time string comparison to prevent timing attacks.
 * Uses HMAC-based comparison via Web Crypto API.
 */
async function timingSafeCompare(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode('timing-safe-compare-key');
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const aMac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(a)));
    const bMac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(b)));
    if (aMac.length !== bMac.length) return false;
    let result = 0;
    for (let i = 0; i < aMac.length; i++) {
        result |= aMac[i] ^ bMac[i];
    }
    return result === 0;
}

/**
 * Verify admin authentication from request headers.
 *
 * @param request - Incoming request
 * @param env - Environment bindings
 * @returns Authorization result
 */
export async function verifyAdminAuth(request: Request, env: Env): Promise<AdminAuthResult> {
    const adminKey = request.headers.get('X-Admin-Key');

    // If no ADMIN_KEY is configured, admin features are disabled
    if (!env.ADMIN_KEY) {
        return { authorized: false, error: 'Admin features not configured' };
    }

    if (!adminKey) {
        return { authorized: false, error: 'Unauthorized' };
    }

    // Use constant-time comparison to prevent timing attacks
    const matches = await timingSafeCompare(adminKey, env.ADMIN_KEY);
    if (!matches) {
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

// ============================================================================
// Request Body Size Validation
// ============================================================================

/**
 * Get the configured maximum request body size in bytes
 */
export function getMaxRequestBodySize(env: Env): number {
    const maxMB = env.MAX_REQUEST_BODY_MB ? parseFloat(env.MAX_REQUEST_BODY_MB) : undefined;
    return maxMB ? maxMB * 1024 * 1024 : WORKER_DEFAULTS.MAX_REQUEST_BODY_BYTES;
}

/**
 * Validate request body size to prevent DoS attacks.
 *
 * @param request - Incoming request
 * @param env - Environment bindings
 * @returns Validation result with error message if size limit exceeded
 */
export async function validateRequestSize(
    request: Request,
    env: Env,
): Promise<{ valid: boolean; error?: string; maxBytes?: number }> {
    // Use centralized function to get max size
    const maxBytes = getMaxRequestBodySize(env);

    // First check: Content-Length header (fast path)
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
        const bodySize = parseInt(contentLength, 10);
        if (!isNaN(bodySize) && bodySize > maxBytes) {
            return {
                valid: false,
                error: `Request body size (${bodySize} bytes) exceeds maximum allowed size (${maxBytes} bytes)`,
                maxBytes,
            };
        }
    }

    // Second check: Validate actual body size during read
    // This catches requests without Content-Length header
    try {
        const cloned = request.clone();
        const arrayBuffer = await cloned.arrayBuffer();
        const actualSize = arrayBuffer.byteLength;

        if (actualSize > maxBytes) {
            return {
                valid: false,
                error: `Request body size (${actualSize} bytes) exceeds maximum allowed size (${maxBytes} bytes)`,
                maxBytes,
            };
        }

        return { valid: true, maxBytes };
    } catch (error) {
        return {
            valid: false,
            error: `Failed to validate request body size: ${ErrorUtils.getMessage(error)}`,
            maxBytes,
        };
    }
}
