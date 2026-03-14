/**
 * Handler for POST /api/notify
 *
 * Accepts a structured notification event and forwards it to one or more
 * configured webhook targets:
 *   - Generic HTTP endpoint  → env.WEBHOOK_URL
 *   - Sentry                 → env.SENTRY_DSN  (uses Sentry's store API)
 *   - Datadog                → env.DATADOG_API_KEY (uses Events v1 API)
 *
 * Returns a delivery report for each configured target.
 * Returns 503 when no targets are configured.
 * Returns 502 when all configured targets fail.
 */

import { type WebhookNotifyRequest, WebhookNotifyRequestSchema } from '../schemas.ts';
import { JsonResponse } from '../utils/response.ts';
import type { Env } from '../types.ts';

interface DeliveryResult {
    target: string;
    success: boolean;
    statusCode?: number;
    error?: string;
}

// ============================================================================
// Delivery helpers
// ============================================================================

async function deliverGeneric(url: string, payload: WebhookNotifyRequest): Promise<DeliveryResult> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return { target: 'generic', success: res.ok, statusCode: res.status };
    } catch (err) {
        return { target: 'generic', success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

async function deliverSentry(dsn: string, payload: WebhookNotifyRequest): Promise<DeliveryResult> {
    try {
        // Extract project/key from DSN: https://key@sentry.io/project
        const dsnUrl = new URL(dsn);
        const publicKey = dsnUrl.username;
        const host = dsnUrl.host;
        const projectId = dsnUrl.pathname.replace(/^\//, '');

        const storeUrl = `https://${host}/api/${projectId}/store/`;

        const level = payload.level === 'warn' ? 'warning' : (payload.level ?? 'info');
        const sentryPayload = {
            message: payload.message,
            level,
            logger: payload.source ?? 'adblock-compiler',
            extra: payload.metadata ?? {},
            tags: { event: payload.event },
            timestamp: payload.timestamp ?? new Date().toISOString(),
        };

        const res = await fetch(storeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
            },
            body: JSON.stringify(sentryPayload),
        });
        return { target: 'sentry', success: res.ok, statusCode: res.status };
    } catch (err) {
        return { target: 'sentry', success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

async function deliverDatadog(apiKey: string, payload: WebhookNotifyRequest): Promise<DeliveryResult> {
    try {
        const ddPayload = {
            title: payload.event,
            text: payload.message,
            alert_type: payload.level === 'error' ? 'error' : payload.level === 'warn' ? 'warning' : 'info',
            source_type_name: payload.source ?? 'adblock-compiler',
            tags: Object.entries(payload.metadata ?? {}).map(([k, v]) => `${k}:${String(v)}`),
            date_happened: payload.timestamp ? Math.floor(new Date(payload.timestamp).getTime() / 1000) : undefined,
        };

        const res = await fetch('https://api.datadoghq.com/api/v1/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': apiKey,
            },
            body: JSON.stringify(ddPayload),
        });
        return { target: 'datadog', success: res.ok, statusCode: res.status };
    } catch (err) {
        return { target: 'datadog', success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

// ============================================================================
// Route handler
// ============================================================================

export async function handleNotify(request: Request, env: Env): Promise<Response> {
    const startTime = Date.now();

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    const parsed = WebhookNotifyRequestSchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(parsed.error.issues.map((i) => i.message).join('; '), 422);
    }

    const payload = parsed.data;

    const deliveries: DeliveryResult[] = [];
    const tasks: Promise<DeliveryResult>[] = [];

    if (env.WEBHOOK_URL) {
        tasks.push(deliverGeneric(env.WEBHOOK_URL, payload));
    }

    if (env.SENTRY_DSN) {
        tasks.push(deliverSentry(env.SENTRY_DSN, payload));
    }

    if (env.DATADOG_API_KEY) {
        tasks.push(deliverDatadog(env.DATADOG_API_KEY, payload));
    }

    if (tasks.length === 0) {
        return JsonResponse.serviceUnavailable(
            'No webhook targets configured (set WEBHOOK_URL, SENTRY_DSN, or DATADOG_API_KEY)',
        );
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
        if (r.status === 'fulfilled') {
            deliveries.push(r.value);
        } else {
            deliveries.push({ target: 'unknown', success: false, error: String(r.reason) });
        }
    }

    const overallSuccess = deliveries.some((d) => d.success);
    const duration = `${Date.now() - startTime}ms`;

    const status = overallSuccess ? 200 : 502;
    return Response.json(
        { success: overallSuccess, event: payload.event, deliveries, duration },
        { status },
    );
}
