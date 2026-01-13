/**
 * Example integrations for the Cloudflare Tail Worker
 *
 * This file demonstrates how to extend the tail worker to integrate
 * with popular logging, monitoring, and alerting services.
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Structured event type for external integrations
 */
export interface StructuredTailEvent {
    timestamp: string;
    scriptName?: string;
    outcome: string;
    url?: string;
    method?: string;
    logs: Array<{
        timestamp: string;
        level: string;
        message: unknown;
    }>;
    exceptions: Array<{
        timestamp: string;
        name: string;
        message: string;
    }>;
}

/**
 * Example: Slack Integration
 * Send formatted messages to Slack when errors occur
 */
export async function sendToSlack(event: StructuredTailEvent, webhookUrl: string): Promise<void> {
    const slackMessage = {
        text: `⚠️ Error in ${event.scriptName || 'Worker'}`,
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${event.outcome === 'exception' ? '🔴' : '⚠️'} Worker Error Alert`,
                },
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Worker:*\n${event.scriptName || 'Unknown'}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Outcome:*\n${event.outcome}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*URL:*\n${event.url || 'N/A'}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Method:*\n${event.method || 'N/A'}`,
                    },
                ],
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Timestamp:*\n${event.timestamp}`,
                },
            },
        ],
    };

    // Add exceptions if present
    if (event.exceptions && event.exceptions.length > 0) {
        slackMessage.blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Exceptions:*\n${
                    event.exceptions
                        .map((exc: any) => `• ${exc.name}: ${exc.message}`)
                        .join('\n')
                }`,
            },
        });
    }

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
    });
}

/**
 * Example: Discord Integration
 * Send formatted embeds to Discord webhooks
 */
export async function sendToDiscord(event: StructuredTailEvent, webhookUrl: string): Promise<void> {
    const discordEmbed = {
        embeds: [
            {
                title: '⚠️ Worker Error Alert',
                color: event.outcome === 'exception' ? 0xff0000 : 0xffa500, // Red or orange
                fields: [
                    {
                        name: 'Worker',
                        value: event.scriptName || 'Unknown',
                        inline: true,
                    },
                    {
                        name: 'Outcome',
                        value: event.outcome,
                        inline: true,
                    },
                    {
                        name: 'URL',
                        value: event.url || 'N/A',
                        inline: false,
                    },
                    {
                        name: 'Method',
                        value: event.method || 'N/A',
                        inline: true,
                    },
                    {
                        name: 'Timestamp',
                        value: event.timestamp,
                        inline: true,
                    },
                ],
                timestamp: event.timestamp,
            },
        ],
    };

    // Add exceptions field if present
    if (event.exceptions && event.exceptions.length > 0) {
        discordEmbed.embeds[0].fields.push({
            name: 'Exceptions',
            value: event.exceptions
                .map((exc: any) => `**${exc.name}**: ${exc.message}`)
                .join('\n')
                .substring(0, 1024), // Discord field value limit
            inline: false,
        });
    }

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordEmbed),
    });
}

/**
 * Example: Datadog Integration
 * Send logs to Datadog using their HTTP API
 */
export async function sendToDatadog(
    event: StructuredTailEvent,
    apiKey: string,
    service: string = 'adblock-compiler',
): Promise<void> {
    const datadogLogs = event.logs.map((log: any) => ({
        ddsource: 'cloudflare-workers',
        ddtags: `env:production,service:${service},outcome:${event.outcome}`,
        hostname: 'cloudflare-workers',
        message: Array.isArray(log.message) ? log.message.join(' ') : log.message,
        service,
        timestamp: new Date(log.timestamp).getTime(),
        status: log.level,
    }));

    await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': apiKey,
        },
        body: JSON.stringify(datadogLogs),
    });
}

/**
 * Example: Sentry Integration
 * Send exceptions to Sentry for error tracking
 */
export async function sendToSentry(event: StructuredTailEvent, dsn: string): Promise<void> {
    if (!event.exceptions || event.exceptions.length === 0) {
        return;
    }

    const sentryUrl = new URL(dsn);
    const projectId = sentryUrl.pathname.substring(1);
    const publicKey = sentryUrl.username;
    const endpoint = `https://${sentryUrl.host}/api/${projectId}/store/`;

    for (const exception of event.exceptions) {
        const sentryEvent = {
            event_id: crypto.randomUUID().replace(/-/g, ''),
            timestamp: new Date(exception.timestamp).getTime() / 1000,
            platform: 'javascript',
            level: 'error',
            exception: {
                values: [
                    {
                        type: exception.name,
                        value: exception.message,
                    },
                ],
            },
            tags: {
                worker: event.scriptName,
                outcome: event.outcome,
            },
            request: event.url
                ? {
                    url: event.url,
                    method: event.method,
                }
                : undefined,
        };

        await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
            },
            body: JSON.stringify(sentryEvent),
        });
    }
}

/**
 * Example: Custom HTTP Endpoint
 * Send to any custom endpoint with flexible formatting
 */
export async function sendToCustomEndpoint(
    event: StructuredTailEvent,
    endpoint: string,
    headers: Record<string, string> = {},
): Promise<void> {
    await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(event),
    });
}

/**
 * Example: Batched KV Storage
 * Store multiple events together for efficiency
 */
export class BatchedKVLogger {
    private batch: StructuredTailEvent[] = [];
    private batchSize: number;
    private kv: KVNamespace;

    constructor(kv: KVNamespace, batchSize: number = 10) {
        this.kv = kv;
        this.batchSize = batchSize;
    }

    async add(event: StructuredTailEvent): Promise<void> {
        this.batch.push(event);

        if (this.batch.length >= this.batchSize) {
            await this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.batch.length === 0) {
            return;
        }

        const timestamp = Date.now();
        const key = `batch:${timestamp}`;

        await this.kv.put(key, JSON.stringify(this.batch), {
            expirationTtl: 86400, // 24 hours
        });

        this.batch = [];
    }
}

/**
 * Example: Sampling
 * Only process a percentage of events to reduce costs
 */
export function shouldSample(sampleRate: number = 0.1): boolean {
    return Math.random() < sampleRate;
}

/**
 * Example: Advanced Filtering
 * Only process events matching specific criteria
 */
export function shouldProcessEvent(event: StructuredTailEvent): boolean {
    // Skip successful requests
    if (event.outcome === 'ok' && event.exceptions.length === 0) {
        return false;
    }

    // Skip specific URLs (e.g., health checks)
    if (event.url?.includes('/health') || event.url?.includes('/ping')) {
        return false;
    }

    // Only process POST requests
    if (event.method !== 'POST') {
        return false;
    }

    return true;
}

/**
 * Example: Rate Limiting for Webhooks
 * Prevent webhook spam by limiting notifications
 */
export class WebhookRateLimiter {
    private lastSent: Map<string, number> = new Map();
    private cooldownMs: number;

    constructor(cooldownSeconds: number = 60) {
        this.cooldownMs = cooldownSeconds * 1000;
    }

    canSend(key: string): boolean {
        const now = Date.now();
        const lastSent = this.lastSent.get(key);

        if (!lastSent || now - lastSent > this.cooldownMs) {
            this.lastSent.set(key, now);
            return true;
        }

        return false;
    }
}

/**
 * Complete example: Enhanced tail worker with multiple integrations
 */
export default {
    async tail(events: any[], env: any, ctx: ExecutionContext) {
        const rateLimiter = new WebhookRateLimiter(60); // 1 minute cooldown

        for (const event of events) {
            // Apply sampling (process 10% of events)
            if (!shouldSample(0.1)) {
                continue;
            }

            // Apply filtering
            if (!shouldProcessEvent(event)) {
                continue;
            }

            const structuredEvent = {
                timestamp: new Date(event.eventTimestamp).toISOString(),
                scriptName: event.scriptName || 'adblock-compiler',
                outcome: event.outcome,
                url: event.event?.request?.url,
                method: event.event?.request?.method,
                logs: event.logs,
                exceptions: event.exceptions,
            };

            // Send to Slack (with rate limiting)
            if (env.SLACK_WEBHOOK_URL && rateLimiter.canSend('slack')) {
                ctx.waitUntil(sendToSlack(structuredEvent, env.SLACK_WEBHOOK_URL));
            }

            // Send to Discord
            if (env.DISCORD_WEBHOOK_URL && rateLimiter.canSend('discord')) {
                ctx.waitUntil(sendToDiscord(structuredEvent, env.DISCORD_WEBHOOK_URL));
            }

            // Send to Datadog
            if (env.DATADOG_API_KEY) {
                ctx.waitUntil(sendToDatadog(structuredEvent, env.DATADOG_API_KEY));
            }

            // Send to Sentry
            if (env.SENTRY_DSN) {
                ctx.waitUntil(sendToSentry(structuredEvent, env.SENTRY_DSN));
            }

            // Store in KV
            if (env.TAIL_LOGS) {
                const logKey = `log:${event.eventTimestamp}`;
                ctx.waitUntil(
                    env.TAIL_LOGS.put(logKey, JSON.stringify(structuredEvent), {
                        expirationTtl: 86400,
                    }),
                );
            }
        }
    },
};
