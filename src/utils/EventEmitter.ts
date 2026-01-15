// deno-lint-ignore-file no-console
/**
 * Lightweight event emitter for compiler observability.
 * Provides a type-safe callback-based event system without external dependencies.
 * Uses modern TypeScript patterns for better type inference and IDE support.
 */

import type {
    ICompilationCompleteEvent,
    ICompilerEvents,
    IProgressEvent,
    ISourceCompleteEvent,
    ISourceErrorEvent,
    ISourceStartEvent,
    ITransformationCompleteEvent,
    ITransformationStartEvent,
} from '../types/index.ts';

/**
 * Type-safe event name to event data mapping
 */
type EventMap = {
    onSourceStart: ISourceStartEvent;
    onSourceComplete: ISourceCompleteEvent;
    onSourceError: ISourceErrorEvent;
    onTransformationStart: ITransformationStartEvent;
    onTransformationComplete: ITransformationCompleteEvent;
    onProgress: IProgressEvent;
    onCompilationComplete: ICompilationCompleteEvent;
};

/**
 * Event emitter that wraps ICompilerEvents callbacks.
 * Provides safe event emission with error handling and type safety.
 *
 * @remarks
 * All event emissions are wrapped in try-catch to prevent user code from
 * breaking the compilation process. Errors are logged to console.
 */
export class CompilerEventEmitter {
    private readonly events: Readonly<ICompilerEvents>;

    /**
     * Creates a new CompilerEventEmitter
     * @param events - Optional event handlers
     */
    constructor(events?: ICompilerEvents) {
        this.events = Object.freeze(events ?? {});
    }

    /**
     * Check if any event handlers are registered
     *
     * @returns true if at least one event handler is registered
     */
    public hasListeners(): boolean {
        return Object.values(this.events).some((handler) => handler !== undefined);
    }

    /**
     * Emit source start event
     */
    public emitSourceStart(event: ISourceStartEvent): void {
        this.safeEmit('onSourceStart', event);
    }

    /**
     * Emit source complete event
     */
    public emitSourceComplete(event: ISourceCompleteEvent): void {
        this.safeEmit('onSourceComplete', event);
    }

    /**
     * Emit source error event
     */
    public emitSourceError(event: ISourceErrorEvent): void {
        this.safeEmit('onSourceError', event);
    }

    /**
     * Emit transformation start event
     */
    public emitTransformationStart(event: ITransformationStartEvent): void {
        this.safeEmit('onTransformationStart', event);
    }

    /**
     * Emit transformation complete event
     */
    public emitTransformationComplete(event: ITransformationCompleteEvent): void {
        this.safeEmit('onTransformationComplete', event);
    }

    /**
     * Emit progress event
     */
    public emitProgress(event: IProgressEvent): void {
        this.safeEmit('onProgress', event);
    }

    /**
     * Emit compilation complete event
     */
    public emitCompilationComplete(event: ICompilationCompleteEvent): void {
        this.safeEmit('onCompilationComplete', event);
    }

    /**
     * Safely emit an event, catching any errors thrown by handlers.
     * This prevents user code from breaking the compilation process.
     *
     * @param eventName - Name of the event to emit
     * @param event - Event data to pass to the handler
     *
     * @remarks
     * Errors thrown by event handlers are caught and logged to console.
     * The compilation process continues even if a handler throws.
     */
    private safeEmit<K extends keyof EventMap>(
        eventName: K,
        event: EventMap[K],
    ): void {
        const handler = this.events[eventName];
        if (!handler) return;

        try {
            (handler as (event: EventMap[K]) => void)(event);
        } catch (error) {
            // Log but don't throw - event handlers shouldn't break compilation
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(
                `Error in event handler '${String(eventName)}': ${errorMessage}`,
                error,
            );
        }
    }
}

/**
 * No-op event emitter for when no events are registered.
 * Provides the same interface but does nothing, avoiding overhead.
 * Uses a more elegant approach with frozen empty object.
 */
export class NoOpEventEmitter extends CompilerEventEmitter {
    private static readonly INSTANCE = new NoOpEventEmitter();

    private constructor() {
        super(Object.freeze({}));
    }

    /**
     * Get the singleton instance of NoOpEventEmitter
     */
    public static getInstance(): NoOpEventEmitter {
        return NoOpEventEmitter.INSTANCE;
    }

    /**
     * Check if any event handlers are registered (always returns false for no-op)
     * @returns Always false
     */
    public override hasListeners(): boolean {
        return false;
    }

    // All emit methods are no-ops but we don't need to override them
    // since the base class checks for handler existence
}

/**
 * Factory function to create the appropriate emitter.
 * Returns a singleton NoOpEventEmitter if no handlers are provided for efficiency.
 *
 * @param events - Optional event handlers configuration
 * @returns CompilerEventEmitter instance (NoOp if no handlers)
 *
 * @example
 * ```ts
 * const emitter = createEventEmitter({
 *   onProgress: (progress) => console.log(progress),
 *   onCompilationComplete: (result) => console.log('Done!', result),
 * });
 * ```
 */
export function createEventEmitter(events?: ICompilerEvents): CompilerEventEmitter {
    if (!events || Object.keys(events).length === 0) {
        return NoOpEventEmitter.getInstance();
    }
    return new CompilerEventEmitter(events);
}
