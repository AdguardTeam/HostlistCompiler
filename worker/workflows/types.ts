/**
 * Type definitions for Cloudflare Workflows implementation.
 *
 * This module defines the parameter types and return types for all
 * workflow implementations in the adblock-compiler.
 */

import type { IConfiguration } from '../../src/index.ts';

/**
 * Parameters for a single compilation workflow
 */
export interface CompilationParams {
    /** Unique identifier for tracking this compilation */
    requestId: string;
    /** The filter list configuration to compile */
    configuration: IConfiguration;
    /** Optional pre-fetched content to bypass network requests */
    preFetchedContent?: Record<string, string>;
    /** Whether to include benchmark metrics */
    benchmark?: boolean;
    /** Priority level for this compilation */
    priority?: 'standard' | 'high';
    /** Timestamp when the job was queued */
    queuedAt: number;
}

/**
 * Parameters for batch compilation workflow
 */
export interface BatchCompilationParams {
    /** Unique identifier for the batch */
    batchId: string;
    /** Individual compilation requests */
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
    /** Priority level for this batch */
    priority?: 'standard' | 'high';
    /** Timestamp when the batch was queued */
    queuedAt: number;
}

/**
 * Parameters for cache warming workflow
 */
export interface CacheWarmingParams {
    /** Unique identifier for this cache warming run */
    runId: string;
    /** Configurations to warm the cache for */
    configurations: IConfiguration[];
    /** Whether this is a scheduled run or manual trigger */
    scheduled: boolean;
}

/**
 * Parameters for health monitoring workflow
 */
export interface HealthMonitoringParams {
    /** Unique identifier for this monitoring run */
    runId: string;
    /** Sources to check health for */
    sources: Array<{
        name: string;
        url: string;
        expectedMinRules?: number;
    }>;
    /** Whether to send alerts on failures */
    alertOnFailure: boolean;
}

/**
 * Result of a single source fetch during compilation
 */
export interface SourceFetchResult {
    name: string;
    url: string;
    success: boolean;
    ruleCount?: number;
    error?: string;
    durationMs: number;
    cached: boolean;
    etag?: string;
}

/**
 * Result of applying transformations
 */
export interface TransformationResult {
    transformationName: string;
    inputRuleCount: number;
    outputRuleCount: number;
    durationMs: number;
}

/**
 * Final compilation result from a workflow
 */
export interface WorkflowCompilationResult {
    success: boolean;
    requestId: string;
    configName: string;
    rules?: string[];
    ruleCount?: number;
    cacheKey?: string;
    compiledAt: string;
    totalDurationMs: number;
    steps: {
        validation?: { durationMs: number; success: boolean };
        sourceFetch?: { durationMs: number; sources: SourceFetchResult[] };
        transformation?: { durationMs: number; transformations: TransformationResult[] };
        headerGeneration?: { durationMs: number };
        caching?: { durationMs: number; compressed: boolean; sizeBytes: number };
    };
    error?: string;
}

/**
 * Result of a batch compilation workflow
 */
export interface BatchWorkflowResult {
    batchId: string;
    totalRequests: number;
    successful: number;
    failed: number;
    results: WorkflowCompilationResult[];
    totalDurationMs: number;
}

/**
 * Result of cache warming workflow
 */
export interface CacheWarmingResult {
    runId: string;
    scheduled: boolean;
    warmedConfigurations: number;
    failedConfigurations: number;
    details: Array<{
        configName: string;
        success: boolean;
        cacheKey?: string;
        error?: string;
    }>;
    totalDurationMs: number;
}

/**
 * Health check result for a single source
 */
export interface SourceHealthResult {
    name: string;
    url: string;
    healthy: boolean;
    statusCode?: number;
    responseTimeMs?: number;
    ruleCount?: number;
    error?: string;
    lastChecked: string;
}

/**
 * Result of health monitoring workflow
 */
export interface HealthMonitoringResult {
    runId: string;
    sourcesChecked: number;
    healthySources: number;
    unhealthySources: number;
    results: SourceHealthResult[];
    alertsSent: boolean;
    totalDurationMs: number;
}

/**
 * Workflow instance status (mirrors Cloudflare Workflows status)
 */
export type WorkflowStatus =
    | 'queued'
    | 'running'
    | 'paused'
    | 'complete'
    | 'errored'
    | 'terminated'
    | 'unknown';

/**
 * Workflow instance info returned by status endpoints
 */
export interface WorkflowInstanceInfo {
    id: string;
    workflowName: string;
    status: WorkflowStatus;
    createdAt: string;
    params?: unknown;
    output?: unknown;
    error?: string;
}

/**
 * Workflow event types for real-time progress tracking
 */
export type WorkflowEventType =
    | 'workflow:started'
    | 'workflow:step:started'
    | 'workflow:step:completed'
    | 'workflow:step:failed'
    | 'workflow:progress'
    | 'workflow:completed'
    | 'workflow:failed'
    | 'source:fetch:started'
    | 'source:fetch:completed'
    | 'source:fetch:failed'
    | 'transformation:started'
    | 'transformation:completed'
    | 'cache:stored'
    | 'health:check:started'
    | 'health:check:completed';

/**
 * Workflow event payload for real-time updates
 */
export interface WorkflowProgressEvent {
    /** Event type */
    type: WorkflowEventType;
    /** Workflow instance ID */
    workflowId: string;
    /** Workflow type (compilation, batch, cache-warming, health) */
    workflowType: string;
    /** Timestamp when event occurred */
    timestamp: string;
    /** Current step name (if applicable) */
    step?: string;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Human-readable message */
    message?: string;
    /** Additional event data */
    data?: Record<string, unknown>;
}

/**
 * Stored events for a workflow instance
 */
export interface WorkflowEventLog {
    workflowId: string;
    workflowType: string;
    startedAt: string;
    completedAt?: string;
    events: WorkflowProgressEvent[];
}
