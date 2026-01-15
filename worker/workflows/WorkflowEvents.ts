/**
 * WorkflowEvents - Event emitter for workflow progress tracking.
 *
 * This module provides a centralized way to emit and store workflow events
 * for real-time progress tracking. Events are stored in KV and can be
 * retrieved via polling or SSE endpoints.
 *
 * Usage:
 * ```typescript
 * const events = new WorkflowEvents(env.METRICS, 'wf-123', 'compilation');
 * await events.emit('workflow:started', { configName: 'EasyList' });
 * await events.emitProgress(25, 'Fetching sources...');
 * await events.emitStepStarted('compile-sources');
 * await events.emitStepCompleted('compile-sources', { ruleCount: 1000 });
 * ```
 */

import type { WorkflowEventLog, WorkflowEventType, WorkflowProgressEvent } from './types.ts';

/**
 * Default event TTL in seconds (1 hour)
 * This can be overridden via constructor for longer-running workflows or historical analysis.
 */
const DEFAULT_EVENT_TTL = 3600;

/**
 * Maximum events to retain per workflow
 */
const MAX_EVENTS = 100;

/**
 * WorkflowEvents handles event emission and storage for workflow progress tracking.
 */
export class WorkflowEvents {
    private readonly kv: KVNamespace;
    private readonly workflowId: string;
    private readonly workflowType: string;
    private readonly eventKey: string;
    private readonly eventTtl: number;

    /**
     * @param kv - KV namespace for event storage
     * @param workflowId - Unique workflow identifier
     * @param workflowType - Type of workflow (e.g., 'compilation', 'health-monitoring')
     * @param eventTtl - Optional TTL for events in seconds (default: 3600 = 1 hour)
     */
    constructor(kv: KVNamespace, workflowId: string, workflowType: string, eventTtl?: number) {
        this.kv = kv;
        this.workflowId = workflowId;
        this.workflowType = workflowType;
        this.eventKey = `workflow:events:${workflowId}`;
        this.eventTtl = eventTtl ?? DEFAULT_EVENT_TTL;
    }

    /**
     * Emit a workflow event and store it in KV
     *
     * NOTE: This method has a potential race condition due to read-modify-write operations
     * not being atomic. If multiple events are emitted concurrently, some events may be lost
     * as the second put() will overwrite the first. This is an acceptable trade-off for
     * progress tracking where eventual consistency is sufficient and complete event history
     * is not critical. For critical events, consider using a queue-based approach or accepting
     * potential event loss.
     */
    async emit(
        type: WorkflowEventType,
        data?: Record<string, unknown>,
        options?: { step?: string; progress?: number; message?: string },
    ): Promise<void> {
        const event: WorkflowProgressEvent = {
            type,
            workflowId: this.workflowId,
            workflowType: this.workflowType,
            timestamp: new Date().toISOString(),
            step: options?.step,
            progress: options?.progress,
            message: options?.message,
            data,
        };

        // Load existing event log or create new one
        let eventLog = await this.kv.get<WorkflowEventLog>(this.eventKey, 'json');

        if (!eventLog) {
            eventLog = {
                workflowId: this.workflowId,
                workflowType: this.workflowType,
                startedAt: new Date().toISOString(),
                events: [],
            };
        }

        // Add event
        eventLog.events.push(event);

        // Trim to max events
        if (eventLog.events.length > MAX_EVENTS) {
            eventLog.events = eventLog.events.slice(-MAX_EVENTS);
        }

        // Update completion timestamp if applicable
        if (type === 'workflow:completed' || type === 'workflow:failed') {
            eventLog.completedAt = new Date().toISOString();
        }

        // Store with TTL
        await this.kv.put(this.eventKey, JSON.stringify(eventLog), {
            expirationTtl: this.eventTtl,
        });

        // Also log for visibility
        console.log(`[WORKFLOW:EVENT] ${this.workflowType}/${this.workflowId} - ${type}`, options?.message || '');
    }

    /**
     * Emit a progress update event
     */
    async emitProgress(progress: number, message: string, data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:progress', data, { progress, message });
    }

    /**
     * Emit workflow started event
     */
    async emitWorkflowStarted(data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:started', data, {
            progress: 0,
            message: `Workflow ${this.workflowType} started`,
        });
    }

    /**
     * Emit workflow completed event
     */
    async emitWorkflowCompleted(data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:completed', data, {
            progress: 100,
            message: `Workflow ${this.workflowType} completed successfully`,
        });
    }

    /**
     * Emit workflow failed event
     */
    async emitWorkflowFailed(error: string, data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:failed', { ...data, error }, {
            message: `Workflow ${this.workflowType} failed: ${error}`,
        });
    }

    /**
     * Emit step started event
     */
    async emitStepStarted(stepName: string, data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:step:started', data, {
            step: stepName,
            message: `Starting step: ${stepName}`,
        });
    }

    /**
     * Emit step completed event
     */
    async emitStepCompleted(stepName: string, data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:step:completed', data, {
            step: stepName,
            message: `Completed step: ${stepName}`,
        });
    }

    /**
     * Emit step failed event
     */
    async emitStepFailed(stepName: string, error: string, data?: Record<string, unknown>): Promise<void> {
        await this.emit('workflow:step:failed', { ...data, error }, {
            step: stepName,
            message: `Step ${stepName} failed: ${error}`,
        });
    }

    /**
     * Emit source fetch started event
     */
    async emitSourceFetchStarted(sourceName: string, url: string): Promise<void> {
        await this.emit('source:fetch:started', { sourceName, url }, {
            message: `Fetching source: ${sourceName}`,
        });
    }

    /**
     * Emit source fetch completed event
     */
    async emitSourceFetchCompleted(sourceName: string, ruleCount: number, durationMs: number): Promise<void> {
        await this.emit('source:fetch:completed', { sourceName, ruleCount, durationMs }, {
            message: `Source ${sourceName}: ${ruleCount} rules in ${durationMs}ms`,
        });
    }

    /**
     * Emit source fetch failed event
     */
    async emitSourceFetchFailed(sourceName: string, error: string): Promise<void> {
        await this.emit('source:fetch:failed', { sourceName, error }, {
            message: `Failed to fetch source ${sourceName}: ${error}`,
        });
    }

    /**
     * Emit transformation started event
     */
    async emitTransformationStarted(transformationName: string, inputRuleCount: number): Promise<void> {
        await this.emit('transformation:started', { transformationName, inputRuleCount }, {
            message: `Applying transformation: ${transformationName}`,
        });
    }

    /**
     * Emit transformation completed event
     */
    async emitTransformationCompleted(
        transformationName: string,
        inputRuleCount: number,
        outputRuleCount: number,
        durationMs: number,
    ): Promise<void> {
        await this.emit('transformation:completed', {
            transformationName,
            inputRuleCount,
            outputRuleCount,
            durationMs,
        }, {
            message: `Transformation ${transformationName}: ${inputRuleCount} → ${outputRuleCount} rules`,
        });
    }

    /**
     * Emit cache stored event
     */
    async emitCacheStored(cacheKey: string, sizeBytes: number): Promise<void> {
        await this.emit('cache:stored', { cacheKey, sizeBytes }, {
            message: `Cached result: ${cacheKey} (${sizeBytes} bytes)`,
        });
    }

    /**
     * Emit health check started event
     */
    async emitHealthCheckStarted(sourceName: string, url: string): Promise<void> {
        await this.emit('health:check:started', { sourceName, url }, {
            message: `Checking health: ${sourceName}`,
        });
    }

    /**
     * Emit health check completed event
     */
    async emitHealthCheckCompleted(
        sourceName: string,
        healthy: boolean,
        responseTimeMs?: number,
        ruleCount?: number,
    ): Promise<void> {
        await this.emit('health:check:completed', {
            sourceName,
            healthy,
            responseTimeMs,
            ruleCount,
        }, {
            message: `Health check ${sourceName}: ${healthy ? 'healthy' : 'unhealthy'}`,
        });
    }

    /**
     * Get all events for this workflow
     */
    async getEvents(): Promise<WorkflowEventLog | null> {
        return this.kv.get<WorkflowEventLog>(this.eventKey, 'json');
    }

    /**
     * Get events since a specific timestamp (for polling)
     */
    async getEventsSince(since: string): Promise<WorkflowProgressEvent[]> {
        const eventLog = await this.getEvents();
        if (!eventLog) return [];

        const sinceDate = new Date(since);
        return eventLog.events.filter((e) => new Date(e.timestamp) > sinceDate);
    }
}

/**
 * Get events for a workflow by ID (static helper)
 */
export async function getWorkflowEvents(
    kv: KVNamespace,
    workflowId: string,
): Promise<WorkflowEventLog | null> {
    return kv.get<WorkflowEventLog>(`workflow:events:${workflowId}`, 'json');
}

/**
 * Get events since a timestamp for a workflow (static helper)
 */
export async function getWorkflowEventsSince(
    kv: KVNamespace,
    workflowId: string,
    since: string,
): Promise<WorkflowProgressEvent[]> {
    const eventLog = await getWorkflowEvents(kv, workflowId);
    if (!eventLog) return [];

    const sinceDate = new Date(since);
    return eventLog.events.filter((e) => new Date(e.timestamp) > sinceDate);
}
