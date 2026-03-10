/**
 * Handler for `POST /api/browser/monitor`.
 *
 * Performs parallel health checks on a list of filter-list source URLs using
 * Cloudflare Browser Rendering.  For each URL the handler:
 *
 * 1. Opens a headless browser tab and navigates to the URL.
 * 2. Verifies that the page returned non-empty text content.
 * 3. Optionally captures a full-page PNG screenshot and stores it in R2.
 * 4. Returns a summary of all results synchronously.
 * 5. Writes a lightweight JSON summary to KV (via `ctx.waitUntil`) so that the
 *    most recent check is available without re-querying the endpoint.
 *
 * **Required binding:** `BROWSER` (Cloudflare Browser Rendering)
 * **Optional bindings:** `FILTER_STORAGE` (R2 bucket for screenshots),
 *                        `CACHE` (KV namespace for summary persistence)
 *
 * **Rate limit / auth:** protected by `requireAuth` in the router.
 */

import { z } from 'zod';
import type { Env, SourceMonitorRequest, SourceMonitorResponse, SourceMonitorResult } from '../types.ts';
import { JsonResponse } from '../utils/index.ts';
import { fetchWithBrowser, takeSourceScreenshot } from './browser.ts';

// ============================================================================
// Request schema
// ============================================================================

/**
 * Zod schema for the `/api/browser/monitor` request body.
 */
export const SourceMonitorRequestSchema = z.object({
    urls: z.array(z.string().url('each url must be a valid absolute URL')).min(1, 'urls must contain at least one URL').max(10, 'urls must contain at most 10 URLs'),
    captureScreenshots: z.boolean().optional().describe('Capture a full-page PNG screenshot per URL'),
    screenshotPrefix: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/, 'screenshotPrefix must contain only alphanumeric characters, hyphens, or underscores')
        .max(50)
        .optional()
        .describe('R2 key prefix for screenshots — alphanumeric, hyphens, and underscores only (defaults to ISO date)'),
    timeout: z.number().int().min(1_000).max(60_000).optional().describe('Per-URL navigation timeout in ms (1 000–60 000)'),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().describe(
        "Page-load strategy applied to every URL: 'networkidle' (default), 'load', or 'domcontentloaded'",
    ),
});

// ============================================================================
// Internal helpers
// ============================================================================

const ISO_DATE_RE = /T.*$/;

function todayPrefix(): string {
    return new Date().toISOString().replace(ISO_DATE_RE, '');
}

async function checkUrl(
    env: Env,
    url: string,
    captureScreenshots: boolean,
    screenshotPrefix: string,
    timeout: number,
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle',
): Promise<SourceMonitorResult> {
    const checkedAt = new Date().toISOString();

    try {
        const content = await fetchWithBrowser(env.BROWSER!, url, { timeout, waitUntil });
        const reachable = content.trim().length > 0;

        let screenshotKey: string | undefined;

        if (captureScreenshots && env.FILTER_STORAGE) {
            try {
                const base64 = await takeSourceScreenshot(env.BROWSER!, url, { timeout, waitUntil });
                // base64 → binary → store in R2
                const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                const slug = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
                screenshotKey = `${screenshotPrefix}/${slug}.png`;
                await env.FILTER_STORAGE.put(screenshotKey, binary.buffer, {
                    httpMetadata: { contentType: 'image/png' },
                });
            } catch {
                // Screenshot failure is non-fatal; the health result is still returned.
            }
        }

        return { url, reachable, checkedAt, screenshotKey };
    } catch (error) {
        return {
            url,
            reachable: false,
            error: error instanceof Error ? error.message : String(error),
            checkedAt,
        };
    }
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Performs parallel browser-based health checks on a list of source URLs.
 *
 * Status codes:
 * - `200` — checks completed (individual URLs may still be `reachable: false`)
 * - `400` — invalid request body
 * - `503` — `BROWSER` binding not configured
 */
export async function handleSourceMonitor(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.BROWSER) {
        return JsonResponse.serviceUnavailable('Browser Rendering binding (BROWSER) is not configured');
    }

    let body: SourceMonitorRequest;

    try {
        const raw = await request.json();
        const parsed = SourceMonitorRequestSchema.safeParse(raw);
        if (!parsed.success) {
            return JsonResponse.badRequest(parsed.error.issues.map((i) => i.message).join('; '));
        }
        body = parsed.data;
    } catch {
        return JsonResponse.badRequest('Request body must be valid JSON');
    }

    const {
        urls,
        captureScreenshots = false,
        screenshotPrefix = todayPrefix(),
        timeout = 30_000,
        waitUntil = 'networkidle',
    } = body;

    // Run all URL checks in parallel.
    const results: SourceMonitorResult[] = await Promise.all(
        urls.map((url) => checkUrl(env, url, captureScreenshots, screenshotPrefix, timeout, waitUntil)),
    );

    const reachableCount = results.filter((r) => r.reachable).length;
    const summary: SourceMonitorResponse = {
        success: true,
        results,
        total: results.length,
        reachable: reachableCount,
        unreachable: results.length - reachableCount,
    };

    // Persist the summary to KV asynchronously so it survives beyond the
    // HTTP response without blocking the caller.
    if (env.COMPILATION_CACHE) {
        ctx.waitUntil(
            env.COMPILATION_CACHE.put('browser:monitor:latest', JSON.stringify(summary), {
                expirationTtl: 86_400, // 24 hours
            }).catch(() => undefined),
        );
    }

    return JsonResponse.success(summary);
}
