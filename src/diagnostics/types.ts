/**
 * Tracing and diagnostics types for comprehensive observability.
 * These types enable structured event emission to the tail worker.
 */

/**
 * Trace severity levels
 */
export enum TraceSeverity {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
}

/**
 * Event categories for tracing
 */
export enum TraceCategory {
    Compilation = 'compilation',
    Download = 'download',
    Transformation = 'transformation',
    Cache = 'cache',
    Validation = 'validation',
    Network = 'network',
    Performance = 'performance',
    Error = 'error',
}

/**
 * Base interface for all diagnostic events
 */
export interface DiagnosticEvent {
    /** Unique event ID for correlation */
    eventId: string;
    /** Timestamp in ISO format */
    timestamp: string;
    /** Event category */
    category: TraceCategory;
    /** Severity level */
    severity: TraceSeverity;
    /** Human-readable message */
    message: string;
    /** Optional correlation ID for grouping related events */
    correlationId?: string;
    /** Optional metadata for additional context */
    metadata?: Record<string, unknown>;
}

/**
 * Event emitted when an operation starts
 */
export interface OperationStartEvent extends DiagnosticEvent {
    /** Operation name */
    operation: string;
    /** Input parameters (sanitized) */
    input?: Record<string, unknown>;
}

/**
 * Event emitted when an operation completes successfully
 */
export interface OperationCompleteEvent extends DiagnosticEvent {
    /** Operation name */
    operation: string;
    /** Duration in milliseconds */
    durationMs: number;
    /** Output summary */
    output?: Record<string, unknown>;
}

/**
 * Event emitted when an operation encounters an error
 */
export interface OperationErrorEvent extends DiagnosticEvent {
    /** Operation name */
    operation: string;
    /** Error name/type */
    errorType: string;
    /** Error message */
    errorMessage: string;
    /** Error stack trace (if available) */
    stack?: string;
    /** Duration before error in milliseconds */
    durationMs?: number;
}

/**
 * Event for performance metrics
 */
export interface PerformanceMetricEvent extends DiagnosticEvent {
    /** Metric name */
    metric: string;
    /** Metric value */
    value: number;
    /** Unit of measurement */
    unit: string;
    /** Optional dimensions for grouping */
    dimensions?: Record<string, string>;
}

/**
 * Event for cache operations
 */
export interface CacheEvent extends DiagnosticEvent {
    /** Cache operation type */
    operation: 'hit' | 'miss' | 'write' | 'evict';
    /** Cache key (hashed for privacy) */
    key: string;
    /** Optional size information */
    size?: number;
}

/**
 * Event for network operations
 */
export interface NetworkEvent extends DiagnosticEvent {
    /** HTTP method */
    method: string;
    /** URL (sanitized) */
    url: string;
    /** Status code */
    statusCode?: number;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Response size in bytes */
    responseSize?: number;
}

/**
 * Diagnostic collector interface for aggregating events
 */
export interface IDiagnosticsCollector {
    /** Record an operation start */
    operationStart(operation: string, input?: Record<string, unknown>): string;

    /** Record an operation completion */
    operationComplete(eventId: string, output?: Record<string, unknown>): void;

    /** Record an operation error */
    operationError(eventId: string, error: Error): void;

    /** Record a performance metric */
    recordMetric(
        metric: string,
        value: number,
        unit: string,
        dimensions?: Record<string, string>,
    ): void;

    /** Record a cache event */
    recordCacheEvent(
        operation: 'hit' | 'miss' | 'write' | 'evict',
        key: string,
        size?: number,
    ): void;

    /** Record a network event */
    recordNetworkEvent(
        method: string,
        url: string,
        statusCode?: number,
        durationMs?: number,
        responseSize?: number,
    ): void;

    /** Emit a custom diagnostic event */
    emit(event: DiagnosticEvent): void;

    /** Get all collected events */
    getEvents(): DiagnosticEvent[];

    /** Clear all collected events */
    clear(): void;
}

/**
 * Context for tracing operations through the compilation pipeline
 */
export interface TracingContext {
    /** Correlation ID for this compilation run */
    correlationId: string;

    /** Diagnostics collector */
    diagnostics: IDiagnosticsCollector;

    /** Start time of the context */
    startTime: number;

    /** Optional parent context for nested operations */
    parent?: TracingContext;

    /** Custom metadata for the context */
    metadata?: Record<string, unknown>;
}

/**
 * Options for creating a tracing context
 */
export interface TracingContextOptions {
    /** Optional correlation ID (auto-generated if not provided) */
    correlationId?: string;

    /** Optional parent context */
    parent?: TracingContext;

    /** Custom metadata */
    metadata?: Record<string, unknown>;

    /** Custom diagnostics collector */
    diagnostics?: IDiagnosticsCollector;
}
