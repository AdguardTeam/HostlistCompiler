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
