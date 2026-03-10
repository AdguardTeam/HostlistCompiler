/**
 * TypeScript types generated from OpenAPI specification
 * These types match the schemas defined in openapi.yaml
 */

// API Information (GET /api)
export interface ApiInfo {
    name: string;
    version: string;
    endpoints: Record<string, string>;
    example?: Record<string, unknown>;
}

// Metrics Response (GET /metrics)
export interface MetricsResponse {
    window: string;
    timestamp: string;
    endpoints: Record<
        string,
        {
            count: number;
            success: number;
            failed: number;
            avgDuration: number;
            errors?: Record<string, number>;
        }
    >;
}

// Compile Response (POST /compile)
export interface CompileResponse {
    success: boolean;
    rules?: string[];
    ruleCount?: number;
    metrics?: CompilationMetrics;
    compiledAt?: string;
    previousVersion?: PreviousVersion;
    cached?: boolean;
    deduplicated?: boolean;
    error?: string;
}

export interface CompilationMetrics {
    totalDurationMs?: number;
    sourceCount?: number;
    ruleCount?: number;
    transformationMetrics?: Array<{
        name: string;
        inputCount: number;
        outputCount: number;
        durationMs: number;
    }>;
}

export interface PreviousVersion {
    rules?: string[];
    ruleCount?: number;
    compiledAt?: string;
}

// Batch Compile Response (POST /compile/batch)
export interface BatchCompileResponse {
    success: boolean;
    results?: Array<CompileResponse & { id: string }>;
}

// Queue Response (POST /compile/async)
export interface QueueResponse {
    success: boolean;
    message?: string;
    requestId?: string;
    priority?: 'standard' | 'high';
}

// Queue Stats (GET /queue/stats)
export interface QueueStats {
    pending: number;
    completed: number;
    failed: number;
    cancelled?: number;
    totalProcessingTime?: number;
    averageProcessingTime?: number;
    processingRate?: number;
    queueLag?: number;
    lastUpdate?: string;
    history?: JobHistoryEntry[];
    depthHistory?: Array<{
        timestamp: string;
        pending: number;
    }>;
}

export interface JobHistoryEntry {
    requestId: string;
    configName: string;
    status: 'completed' | 'failed' | 'cancelled';
    duration: number;
    timestamp: string;
    error?: string;
    ruleCount?: number;
}

// Queue Job Status (GET /queue/results/{requestId})
export interface QueueJobStatus {
    success: boolean;
    status?: 'completed' | 'failed' | 'not_found' | 'no_cache' | 'cache_miss';
    jobInfo?: {
        configName?: string;
        duration?: number;
        timestamp?: string;
        error?: string;
    };
}

// ============================================================================
// Rule Validation (POST /validate-rule)
// ============================================================================

export interface ValidateRuleRequest {
    rule: string;
    testUrl?: string;
    strict?: boolean;
}

export interface ValidateRuleResponse {
    success: boolean;
    valid: boolean;
    rule: string;
    parsed?: Record<string, unknown>;
    error?: string;
    testUrl?: string;
    matchResult?: boolean;
    duration: string;
}

// ============================================================================
// Rule Management (POST/GET/PUT/DELETE /rules)
// ============================================================================

export interface RuleSetCreateRequest {
    name: string;
    description?: string;
    rules: string[];
    tags?: string[];
}

export interface RuleSetUpdateRequest {
    name?: string;
    description?: string;
    rules?: string[];
    tags?: string[];
}

export interface RuleSet {
    id: string;
    name: string;
    description?: string;
    rules: string[];
    ruleCount: number;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface RuleSetListResponse {
    success: boolean;
    items: RuleSet[];
    total: number;
}

export interface RuleSetResponse {
    success: boolean;
    data?: RuleSet;
    error?: string;
}

// ============================================================================
// Webhook / Notifications (POST /notify)
// ============================================================================

export type NotifyLevel = 'info' | 'warn' | 'error' | 'debug';

export interface WebhookNotifyRequest {
    event: string;
    level?: NotifyLevel;
    message: string;
    metadata?: Record<string, unknown>;
    source?: string;
    timestamp?: string;
}

export interface WebhookDelivery {
    target: string;
    success: boolean;
    statusCode?: number;
    error?: string;
}

export interface WebhookNotifyResponse {
    success: boolean;
    event: string;
    deliveries: WebhookDelivery[];
    duration: string;
}
