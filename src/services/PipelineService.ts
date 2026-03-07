/**
 * Pipeline Service for Cloudflare Pipelines integration.
 *
 * Routes structured metrics and audit events to a Cloudflare Pipeline
 * for scalable ingestion, batching, and downstream storage (R2, etc.).
 *
 * @see https://developers.cloudflare.com/pipelines/
 */

import type { IBasicLogger } from '../types/index.ts';
import { silentLogger } from '../utils/logger.ts';
import type { PipelineBinding } from '../../worker/types.ts';

/**
 * Event types that can be sent to the pipeline.
 */
export type PipelineEventType =
    | 'compilation_request'
    | 'compilation_success'
    | 'compilation_error'
    | 'cache_hit'
    | 'cache_miss'
    | 'rate_limit_exceeded'
    | 'workflow_started'
    | 'workflow_completed'
    | 'workflow_failed'
    | 'batch_compilation'
    | 'api_request'
    | 'source_fetch'
    | 'source_fetch_error';

/**
 * Structured event payload sent to the pipeline.
 */
export interface PipelineEvent {
    /** ISO timestamp of when the event occurred */
    timestamp: string;
    /** Event category */
    type: PipelineEventType;
    /** Request ID for correlation across events */
    requestId?: string;
    /** Duration in milliseconds (for timed operations) */
    durationMs?: number;
    /** Whether the operation succeeded */
    success?: boolean;
    /** Error message if the operation failed */
    error?: string;
    /** Number of rules in the result */
    ruleCount?: number;
    /** Number of sources compiled */
    sourceCount?: number;
    /** Endpoint path that was called */
    endpoint?: string;
    /** HTTP method */
    method?: string;
    /** HTTP status code */
    status?: number;
    /** Cache key (hashed, not the full config) */
    cacheKey?: string;
    /** Workflow ID for workflow events */
    workflowId?: string;
    /** Additional metadata */
    meta?: Record<string, string | number | boolean>;
}

/**
 * PipelineService provides a type-safe interface for forwarding events
 * to a Cloudflare Pipeline for scalable ingestion.
 *
 * Falls back to a no-op if the pipeline binding is not configured.
 *
 * @example
 * ```typescript
 * const pipeline = new PipelineService(env.METRICS_PIPELINE, logger);
 * await pipeline.send({ type: 'compilation_success', durationMs: 120, ruleCount: 5000 });
 * ```
 */
export class PipelineService {
    private readonly pipeline: PipelineBinding | undefined;
    private readonly logger: IBasicLogger;

    constructor(pipeline?: PipelineBinding, logger?: IBasicLogger) {
        this.pipeline = pipeline;
        this.logger = logger ?? silentLogger;
    }

    /**
     * Send a single event to the pipeline.
     * No-op if no pipeline binding is configured.
     */
    public async send(event: Omit<PipelineEvent, 'timestamp'>): Promise<void> {
        if (!this.pipeline) {
            return;
        }

        const payload: PipelineEvent = {
            ...event,
            timestamp: new Date().toISOString(),
        };

        try {
            await this.pipeline.send([{ body: JSON.stringify(payload) }]);
        } catch (error) {
            this.logger.warn(`PipelineService: failed to send event (${event.type}): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send multiple events in a single pipeline call (more efficient).
     * No-op if no pipeline binding is configured.
     */
    public async sendBatch(events: Array<Omit<PipelineEvent, 'timestamp'>>): Promise<void> {
        if (!this.pipeline || events.length === 0) {
            return;
        }

        const now = new Date().toISOString();
        const messages = events.map((event) => ({
            body: JSON.stringify({ ...event, timestamp: now } satisfies PipelineEvent),
        }));

        try {
            await this.pipeline.send(messages);
        } catch (error) {
            this.logger.warn(`PipelineService: failed to send batch of ${events.length} events: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Returns true if a pipeline binding is configured and events will be forwarded.
     */
    public get isEnabled(): boolean {
        return this.pipeline !== undefined;
    }
}
