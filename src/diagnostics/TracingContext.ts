/**
 * TracingContext implementation for managing diagnostic context through the compilation pipeline.
 */

import { DiagnosticsCollector, NoOpDiagnosticsCollector } from './DiagnosticsCollector.ts';
import type { TracingContext, TracingContextOptions } from './types.ts';

/**
 * Type for method decorator functions
 */
type MethodDecorator = (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
) => PropertyDescriptor;

/**
 * Generates a correlation ID using crypto.randomUUID if available,
 * otherwise falls back to timestamp + random string
 */
function generateCorrelationId(): string {
    // Use crypto.randomUUID if available (modern browsers, Deno, Node 16+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `trace-${crypto.randomUUID()}`;
    }
    // Fallback for environments without crypto.randomUUID
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Creates a new tracing context
 */
export function createTracingContext(options?: TracingContextOptions): TracingContext {
    const correlationId = options?.correlationId || generateCorrelationId();
    const diagnostics = options?.diagnostics || new DiagnosticsCollector(correlationId);

    return {
        correlationId,
        diagnostics,
        startTime: performance.now(),
        parent: options?.parent,
        metadata: options?.metadata || {},
    };
}

/**
 * Creates a child tracing context that inherits from a parent
 */
export function createChildContext(
    parent: TracingContext,
    metadata?: Record<string, unknown>,
): TracingContext {
    return createTracingContext({
        correlationId: parent.correlationId,
        parent,
        metadata: { ...parent.metadata, ...metadata },
        diagnostics: parent.diagnostics,
    });
}

/**
 * Creates a no-op tracing context (for when diagnostics are disabled)
 */
export function createNoOpContext(): TracingContext {
    return {
        correlationId: 'noop',
        diagnostics: NoOpDiagnosticsCollector.getInstance(),
        startTime: 0,
        metadata: {},
    };
}

/**
 * Decorator for tracing synchronous function execution
 */
export function traced(operationName?: string): MethodDecorator {
    return function (
        _target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
        const originalMethod = descriptor.value;
        const opName = operationName || propertyKey;

        descriptor.value = function (
            this: { tracingContext?: TracingContext },
            ...args: unknown[]
        ) {
            const context = this.tracingContext;
            if (!context) {
                return originalMethod.apply(this, args);
            }

            const eventId = context.diagnostics.operationStart(opName, {
                args: args.length,
            });

            try {
                const result = originalMethod.apply(this, args);
                context.diagnostics.operationComplete(eventId, {
                    result: typeof result,
                });
                return result;
            } catch (error) {
                context.diagnostics.operationError(eventId, error as Error);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Decorator for tracing asynchronous function execution
 */
export function tracedAsync(operationName?: string): MethodDecorator {
    return function (
        _target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
        const originalMethod = descriptor.value;
        const opName = operationName || propertyKey;

        descriptor.value = async function (
            this: { tracingContext?: TracingContext },
            ...args: unknown[]
        ) {
            const context = this.tracingContext;
            if (!context) {
                return await originalMethod.apply(this, args);
            }

            const eventId = context.diagnostics.operationStart(opName, {
                args: args.length,
            });

            try {
                const result = await originalMethod.apply(this, args);
                context.diagnostics.operationComplete(eventId, {
                    result: typeof result,
                });
                return result;
            } catch (error) {
                context.diagnostics.operationError(eventId, error as Error);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Wrapper function for tracing synchronous operations
 */
export function traceSync<T>(
    context: TracingContext,
    operationName: string,
    fn: () => T,
    input?: Record<string, unknown>,
): T {
    const eventId = context.diagnostics.operationStart(operationName, input);

    try {
        const result = fn();
        context.diagnostics.operationComplete(eventId, {
            result: typeof result,
        });
        return result;
    } catch (error) {
        context.diagnostics.operationError(eventId, error as Error);
        throw error;
    }
}

/**
 * Wrapper function for tracing asynchronous operations
 */
export async function traceAsync<T>(
    context: TracingContext,
    operationName: string,
    fn: () => Promise<T>,
    input?: Record<string, unknown>,
): Promise<T> {
    const eventId = context.diagnostics.operationStart(operationName, input);

    try {
        const result = await fn();
        context.diagnostics.operationComplete(eventId, {
            result: typeof result,
        });
        return result;
    } catch (error) {
        context.diagnostics.operationError(eventId, error as Error);
        throw error;
    }
}

/**
 * Helper to extract context from options or create a no-op context
 */
export function getOrCreateContext(options?: { tracingContext?: TracingContext }): TracingContext {
    return options?.tracingContext || createNoOpContext();
}
