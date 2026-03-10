/**
 * Handler for `GET /api/browser/monitor/latest`.
 *
 * Returns the most recent source-monitor summary that was persisted to KV by
 * {@link handleSourceMonitor}.  The summary is written asynchronously after
 * every successful `POST /api/browser/monitor` call and expires after 24 hours.
 *
 * **Required binding:** `COMPILATION_CACHE` (KV namespace)
 * **Rate limit / auth:** protected by `requireAuth` in the router.
 */

import type { Env, SourceMonitorResponse } from '../types.ts';
import { JsonResponse } from '../utils/index.ts';

const KV_KEY = 'browser:monitor:latest';

/**
 * Retrieves the latest source-monitor summary from KV.
 *
 * Status codes:
 * - `200` — a cached summary was found and is returned
 * - `404` — no summary has been stored yet (run `POST /api/browser/monitor` first)
 * - `503` — `COMPILATION_CACHE` KV binding not configured
 */
export async function handleMonitorLatest(_request: Request, env: Env): Promise<Response> {
    if (!env.COMPILATION_CACHE) {
        return JsonResponse.serviceUnavailable('KV binding (COMPILATION_CACHE) is not configured');
    }

    const raw = await env.COMPILATION_CACHE.get(KV_KEY);

    if (raw === null) {
        return JsonResponse.error('No monitor summary found — run POST /api/browser/monitor first', 404);
    }

    try {
        const summary = JSON.parse(raw) as SourceMonitorResponse;
        return JsonResponse.success(summary);
    } catch {
        return JsonResponse.error('Stored monitor summary is malformed', 500);
    }
}
