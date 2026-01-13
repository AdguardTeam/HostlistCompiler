// deno-lint-ignore-file no-console
/**
 * DiagnosticsCollector implementation for aggregating and emitting diagnostic events.
 */

import {
    AnyDiagnosticEvent,
    CacheEvent,
    DiagnosticEvent,
    IDiagnosticsCollector,
    NetworkEvent,
    OperationCompleteEvent,
    OperationErrorEvent,
    OperationStartEvent,
    PerformanceMetricEvent,
    TraceCategory,
    TraceSeverity,
} from './types.ts';
import { BaseError, PathUtils } from '../utils/index.ts';

/**
 * Generates a unique event ID using crypto.randomUUID if available,
 * otherwise falls back to timestamp + random string
 */
function generateEventId(): string {
    // Use crypto.randomUUID if available (modern browsers, Deno, Node 16+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Default implementation of IDiagnosticsCollector that stores events in memory
 * and can optionally emit them to console for debugging.
 */
export class DiagnosticsCollector implements IDiagnosticsCollector {
    private events: AnyDiagnosticEvent[] = [];
    private operationStartTimes = new Map<string, number>();
    private operationNames = new Map<string, string>();
    private readonly correlationId: string;
    private readonly emitToConsole: boolean;

    constructor(correlationId?: string, emitToConsole: boolean = false) {
        this.correlationId = correlationId || generateEventId();
        this.emitToConsole = emitToConsole;
    }

    /**
     * Records the start of an operation
     */
    public operationStart(operation: string, input?: Record<string, unknown>): string {
        const eventId = generateEventId();
        const startTime = performance.now();

        this.operationStartTimes.set(eventId, startTime);
        this.operationNames.set(eventId, operation);

        const event: OperationStartEvent = {
            eventId,
            timestamp: new Date().toISOString(),
            category: TraceCategory.Compilation,
            severity: TraceSeverity.Debug,
            message: `Operation started: ${operation}`,
            correlationId: this.correlationId,
            operation,
            input,
        };

        this.emit(event);
        return eventId;
    }

    /**
     * Records successful completion of an operation
     */
    public operationComplete(eventId: string, output?: Record<string, unknown>): void {
        const startTime = this.operationStartTimes.get(eventId);
        const operation = this.operationNames.get(eventId);

        if (!operation) {
            // Internal diagnostic warning - using console.warn for system-level issues
            // This is intentional to catch bugs in how the diagnostics system is used
            console.warn(
                `[DiagnosticsCollector] Operation complete called for unknown event: ${eventId}`,
            );
            return;
        }

        const durationMs = startTime ? performance.now() - startTime : 0;

        const event: OperationCompleteEvent = {
            eventId: generateEventId(),
            timestamp: new Date().toISOString(),
            category: TraceCategory.Compilation,
            severity: TraceSeverity.Info,
            message: `Operation completed: ${operation} (${durationMs.toFixed(2)}ms)`,
            correlationId: this.correlationId,
            operation,
            durationMs,
            output,
        };

        this.emit(event);

        // Cleanup
        this.operationStartTimes.delete(eventId);
        this.operationNames.delete(eventId);
    }

    /**
     * Records an error during an operation.
     * Extracts additional metadata from BaseError subclasses.
     */
    public operationError(eventId: string, error: Error): void {
        const startTime = this.operationStartTimes.get(eventId);
        const operation = this.operationNames.get(eventId);

        if (!operation) {
            // Internal diagnostic warning - using console.warn for system-level issues
            // This is intentional to catch bugs in how the diagnostics system is used
            console.warn(
                `[DiagnosticsCollector] Operation error called for unknown event: ${eventId}`,
            );
            return;
        }

        const durationMs = startTime ? performance.now() - startTime : undefined;

        // Extract additional error metadata if it's a BaseError
        const errorMetadata: Record<string, unknown> = {};
        if (error instanceof BaseError) {
            errorMetadata.errorCode = error.code;
            errorMetadata.errorTimestamp = error.timestamp;
            if (error.cause) {
                errorMetadata.causeMessage = error.cause.message;
            }
        }

        const event: OperationErrorEvent = {
            eventId: generateEventId(),
            timestamp: new Date().toISOString(),
            category: TraceCategory.Error,
            severity: TraceSeverity.Error,
            message: `Operation failed: ${operation} - ${error.message}`,
            correlationId: this.correlationId,
            operation,
            errorType: error.name,
            errorMessage: error.message,
            stack: error.stack,
            durationMs,
            ...errorMetadata,
        };

        this.emit(event);

        // Cleanup
        this.operationStartTimes.delete(eventId);
        this.operationNames.delete(eventId);
    }

    /**
     * Records a performance metric
     */
    public recordMetric(
        metric: string,
        value: number,
        unit: string,
        dimensions?: Record<string, string>,
    ): void {
        const event: PerformanceMetricEvent = {
            eventId: generateEventId(),
            timestamp: new Date().toISOString(),
            category: TraceCategory.Performance,
            severity: TraceSeverity.Debug,
            message: `Metric: ${metric} = ${value} ${unit}`,
            correlationId: this.correlationId,
            metric,
            value,
            unit,
            dimensions,
        };

        this.emit(event);
    }

    /**
     * Records a cache event
     */
    public recordCacheEvent(
        operation: 'hit' | 'miss' | 'write' | 'evict',
        key: string,
        size?: number,
    ): void {
        const event: CacheEvent = {
            eventId: generateEventId(),
            timestamp: new Date().toISOString(),
            category: TraceCategory.Cache,
            severity: TraceSeverity.Debug,
            message: `Cache ${operation}: ${key}${size ? ` (${size} bytes)` : ''}`,
            correlationId: this.correlationId,
            operation,
            key,
            size,
        };

        this.emit(event);
    }

    /**
     * Records a network event
     */
    public recordNetworkEvent(
        method: string,
        url: string,
        statusCode?: number,
        durationMs?: number,
        responseSize?: number,
    ): void {
        const sanitizedUrl = PathUtils.sanitizeUrl(url);

        const event: NetworkEvent = {
            eventId: generateEventId(),
            timestamp: new Date().toISOString(),
            category: TraceCategory.Network,
            severity: statusCode && statusCode >= 400 ? TraceSeverity.Warn : TraceSeverity.Debug,
            message: `${method} ${sanitizedUrl}${statusCode ? ` - ${statusCode}` : ''}${durationMs ? ` (${durationMs.toFixed(2)}ms)` : ''}`,
            correlationId: this.correlationId,
            method,
            url: sanitizedUrl,
            statusCode,
            durationMs,
            responseSize,
        };

        this.emit(event);
    }

    /**
     * Emits a custom diagnostic event
     */
    public emit(event: DiagnosticEvent): void {
        this.events.push(event);

        if (this.emitToConsole) {
            const level = event.severity;
            const message = `[${event.category}] ${event.message}`;

            switch (level) {
                case TraceSeverity.Error:
                    console.error(message, event);
                    break;
                case TraceSeverity.Warn:
                    console.warn(message, event);
                    break;
                case TraceSeverity.Info:
                    console.info(message, event);
                    break;
                default:
                    console.debug(message, event);
            }
        }
    }

    /**
     * Gets all collected events
     */
    public getEvents(): AnyDiagnosticEvent[] {
        return [...this.events];
    }

    /**
     * Clears all collected events
     */
    public clear(): void {
        this.events = [];
        this.operationStartTimes.clear();
        this.operationNames.clear();
    }

    /**
     * Gets the correlation ID for this collector
     */
    public getCorrelationId(): string {
        return this.correlationId;
    }
}

/**
 * No-op implementation of IDiagnosticsCollector for when diagnostics are disabled
 */
export class NoOpDiagnosticsCollector implements IDiagnosticsCollector {
    private static instance: NoOpDiagnosticsCollector;

    private constructor() {}

    public static getInstance(): NoOpDiagnosticsCollector {
        if (!NoOpDiagnosticsCollector.instance) {
            NoOpDiagnosticsCollector.instance = new NoOpDiagnosticsCollector();
        }
        return NoOpDiagnosticsCollector.instance;
    }

    public operationStart(_operation: string, _input?: Record<string, unknown>): string {
        return 'noop';
    }

    public operationComplete(_eventId: string, _output?: Record<string, unknown>): void {
        // No-op
    }

    public operationError(_eventId: string, _error: Error): void {
        // No-op
    }

    public recordMetric(
        _metric: string,
        _value: number,
        _unit: string,
        _dimensions?: Record<string, string>,
    ): void {
        // No-op
    }

    public recordCacheEvent(
        _operation: 'hit' | 'miss' | 'write' | 'evict',
        _key: string,
        _size?: number,
    ): void {
        // No-op
    }

    public recordNetworkEvent(
        _method: string,
        _url: string,
        _statusCode?: number,
        _durationMs?: number,
        _responseSize?: number,
    ): void {
        // No-op
    }

    public emit(_event: DiagnosticEvent): void {
        // No-op
    }

    public getEvents(): AnyDiagnosticEvent[] {
        return [];
    }

    public clear(): void {
        // No-op
    }
}
