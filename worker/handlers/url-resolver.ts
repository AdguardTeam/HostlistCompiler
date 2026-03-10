/**
 * Handler for `POST /api/browser/resolve-url`.
 *
 * Navigates to the submitted URL in a headless Chromium browser via the
 * Cloudflare Browser Rendering binding, waits for all JavaScript redirects to
 * settle, and returns the canonical final URL.
 *
 * This is useful for resolving link-shorteners or CDN redirect chains that are
 * opaque to a plain `fetch()` call.
 *
 * **Required binding:** `BROWSER` (Cloudflare Browser Rendering)
 *
 * **Rate limit / auth:** protected by `requireAuth` in the router.
 */

import { z } from 'zod';
import type { Env, UrlResolveRequest, UrlResolveResponse } from '../types.ts';
import { JsonResponse } from '../utils/index.ts';
import { resolveCanonicalUrl } from './browser.ts';

// ============================================================================
// Request schema
// ============================================================================

/**
 * Zod schema for the `/api/browser/resolve-url` request body.
 */
export const UrlResolveRequestSchema = z.object({
    url: z.string().url('url must be a valid absolute URL'),
    timeout: z.number().int().min(1_000).max(60_000).optional().describe('Navigation timeout in ms (1 000–60 000)'),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().describe("Page-load strategy: 'networkidle' (default), 'load', or 'domcontentloaded'"),
});

// ============================================================================
// Handler
// ============================================================================

/**
 * Resolves the canonical URL of a page that may redirect via JavaScript.
 *
 * Status codes:
 * - `200` — resolution succeeded
 * - `400` — invalid request body
 * - `503` — `BROWSER` binding not configured
 * - `502` — browser navigation failed
 */
export async function handleResolveUrl(request: Request, env: Env): Promise<Response> {
    if (!env.BROWSER) {
        return JsonResponse.serviceUnavailable('Browser Rendering binding (BROWSER) is not configured');
    }

    let body: UrlResolveRequest;

    try {
        const raw = await request.json();
        const parsed = UrlResolveRequestSchema.safeParse(raw);
        if (!parsed.success) {
            return JsonResponse.badRequest(parsed.error.issues.map((i) => i.message).join('; '));
        }
        body = parsed.data;
    } catch {
        return JsonResponse.badRequest('Request body must be valid JSON');
    }

    try {
        const resolvedUrl = await resolveCanonicalUrl(env.BROWSER, body.url, {
            timeout: body.timeout,
            waitUntil: body.waitUntil,
        });

        const responseBody: UrlResolveResponse = {
            success: true,
            resolvedUrl,
            originalUrl: body.url,
        };

        return JsonResponse.success(responseBody);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Browser navigation failed: ${message}`, 502);
    }
}
