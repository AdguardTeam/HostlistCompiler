/**
 * Shared type definitions for the Cloudflare Worker.
 * Provides type safety and eliminates 'any' types throughout the worker.
 */

/// <reference types="@cloudflare/workers-types" />

import type { IConfiguration } from '../src/types/index.ts';

// ============================================================================
// Database Types
// ============================================================================

/**
 * D1 Database type from Cloudflare Workers Types
 */
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta?: D1ResultMeta;
}

export interface D1ResultMeta {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
}

export interface D1ExecResult {
    count: number;
    duration: number;
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * Workflow status values
 */
export type WorkflowStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'terminated';

/**
 * Workflow binding type - matches Cloudflare Workers Workflow type
 */
export interface Workflow<Params = unknown> {
    create(options?: { id?: string; params?: Params }): Promise<WorkflowInstance>;
    get(id: string): Promise<WorkflowInstance>;
}

export interface WorkflowInstance {
    id: string;
    pause(): Promise<void>;
    resume(): Promise<void>;
    terminate(): Promise<void>;
    restart(): Promise<void>;
    status(): Promise<WorkflowStatusResult>;
}

export interface WorkflowStatusResult {
    status: WorkflowStatus;
    output?: unknown;
    error?: string;
}

// ============================================================================
// Environment Bindings
// ============================================================================

/**
 * Priority levels for queue messages
 */
export type Priority = 'standard' | 'high';

/**
 * Environment bindings for the worker.
 */
export interface Env {
    COMPILER_VERSION: string;
    // KV namespaces
    COMPILATION_CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    METRICS: KVNamespace;
    // Static assets
    ASSETS?: Fetcher;
    // Queue bindings (optional - queues must be created in Cloudflare dashboard first)
    ADBLOCK_COMPILER_QUEUE?: Queue<QueueMessage>;
    ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY?: Queue<QueueMessage>;
    // Turnstile configuration
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    // D1 Database binding (optional - for SQLite admin features)
    DB?: D1Database;
    // Admin authentication key
    ADMIN_KEY?: string;
    // Workflow bindings (optional - for durable execution)
    COMPILATION_WORKFLOW?: Workflow<CompilationParams>;
    BATCH_COMPILATION_WORKFLOW?: Workflow<BatchCompilationParams>;
    CACHE_WARMING_WORKFLOW?: Workflow<CacheWarmingParams>;
    HEALTH_MONITORING_WORKFLOW?: Workflow<HealthMonitoringParams>;
    // Analytics Engine binding (optional - for metrics tracking)
    ANALYTICS_ENGINE?: AnalyticsEngineDataset;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Compile request body structure.
 */
export interface CompileRequest {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
    turnstileToken?: string;
}

/**
 * Batch compile request structure.
 */
export interface BatchRequest {
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
    priority?: Priority;
}

/**
 * AST parse request body.
 */
export interface ASTParseRequest {
    rules?: string[];
    text?: string;
}

/**
 * Admin SQL query request.
 */
export interface AdminQueryRequest {
    sql: string;
}

// ============================================================================
// Queue Message Types
// ============================================================================

/**
 * Queue message types for different operations
 */
export type QueueMessageType = 'compile' | 'batch-compile' | 'cache-warm';

/**
 * Base queue message structure
 */
export interface QueueMessage {
    type: QueueMessageType;
    requestId?: string;
    timestamp: number;
    priority?: Priority;
}

/**
 * Queue message for single compilation
 */
export interface CompileQueueMessage extends QueueMessage {
    type: 'compile';
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
}

/**
 * Queue message for batch compilation
 */
export interface BatchCompileQueueMessage extends QueueMessage {
    type: 'batch-compile';
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
}

/**
 * Queue message for cache warming
 */
export interface CacheWarmQueueMessage extends QueueMessage {
    type: 'cache-warm';
    configurations: IConfiguration[];
}

// ============================================================================
// Workflow Parameter Types
// ============================================================================

export interface CompilationParams {
    requestId: string;
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
    queuedAt: number;
}

export interface BatchCompilationParams {
    batchId: string;
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
    priority?: Priority;
    queuedAt: number;
}

export interface CacheWarmingParams {
    runId: string;
    configurations: IConfiguration[];
    scheduled: boolean;
}

export interface HealthMonitoringParams {
    runId: string;
    sources: Array<{
        name: string;
        url: string;
        expectedMinRules?: number;
    }>;
    alertOnFailure: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Result of a compilation with metrics
 */
export interface CompilationResult {
    success: boolean;
    rules?: string[];
    ruleCount?: number;
    metrics?: CompilationMetrics;
    error?: string;
    compiledAt?: string;
    previousVersion?: PreviousVersion;
    cached?: boolean;
    deduplicated?: boolean;
}

export interface CompilationMetrics {
    totalDuration?: number;
    sourceCount?: number;
    transformationCount?: number;
    inputRuleCount?: number;
    outputRuleCount?: number;
    phases?: Record<string, number>;
}

export interface PreviousVersion {
    rules: string[];
    ruleCount: number;
    compiledAt: string;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Rate limit data structure
 */
export interface RateLimitData {
    count: number;
    resetAt: number;
}

/**
 * Endpoint metrics structure
 */
export interface EndpointMetrics {
    count: number;
    success: number;
    failed: number;
    totalDuration: number;
    errors: Record<string, number>;
}

/**
 * Aggregated metrics response
 */
export interface AggregatedMetrics {
    window: string;
    timestamp: string;
    endpoints: Record<string, EndpointMetricsDisplay>;
}

export interface EndpointMetricsDisplay {
    count: number;
    success: number;
    failed: number;
    avgDuration: number;
    errors: Record<string, number>;
}

/**
 * Job history entry
 */
export interface JobHistoryEntry {
    requestId: string;
    configName: string;
    status: 'completed' | 'failed' | 'cancelled';
    duration: number;
    timestamp: string;
    error?: string;
    ruleCount?: number;
    cacheKey?: string;
}

/**
 * Queue depth history entry
 */
export interface DepthHistoryEntry {
    timestamp: string;
    pending: number;
}

/**
 * Queue statistics structure with history
 */
export interface QueueStats {
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    processingRate: number;
    queueLag: number;
    lastUpdate: string;
    history: JobHistoryEntry[];
    depthHistory: DepthHistoryEntry[];
}

/**
 * Job info for queue stat updates
 */
export interface JobInfo {
    requestId?: string;
    configName?: string;
    error?: string;
    ruleCount?: number;
    cacheKey?: string;
}

// ============================================================================
// Turnstile Types
// ============================================================================

/**
 * Turnstile verification response
 */
export interface TurnstileVerifyResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
    action?: string;
    cdata?: string;
}

/**
 * Turnstile verification result
 */
export interface TurnstileResult {
    success: boolean;
    error?: string;
}

// ============================================================================
// Admin Types
// ============================================================================

/**
 * Admin auth result
 */
export interface AdminAuthResult {
    authorized: boolean;
    error?: string;
}

/**
 * Storage stats response
 */
export interface StorageStats {
    storage_entries: number;
    filter_cache: number;
    compilation_metadata: number;
    expired_storage: number;
    expired_cache: number;
}

/**
 * Table info from sqlite_master
 */
export interface TableInfo {
    name: string;
    type: string;
}

// ============================================================================
// Workflow Event Types
// ============================================================================

export interface WorkflowEvent {
    type: string;
    workflowId: string;
    workflowType: string;
    timestamp: string;
    step?: string;
    progress?: number;
    message?: string;
    data?: Record<string, unknown>;
}

export interface WorkflowEventLog {
    workflowId: string;
    workflowType: string;
    startedAt: string;
    completedAt?: string;
    events: WorkflowEvent[];
}

export interface WorkflowMetrics {
    totalCompilations?: number;
    totalBatches?: number;
    totalRuns?: number;
    totalChecks?: number;
}
