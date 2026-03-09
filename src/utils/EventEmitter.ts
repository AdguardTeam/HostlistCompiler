/**
 * Lightweight event emitter for compiler observability.
 * Provides a type-safe callback-based event system without external dependencies.
 * Uses modern TypeScript patterns for better type inference and IDE support.
 *
 * ## Architecture note: emitter vs hooks
 *
 * This module implements the *compiler-level* event bus (`ICompilerEvents`).
 * Individual transformation lifecycle events (`beforeTransform`,
 * `afterTransform`, `onError`) are handled by `TransformationHookManager` in
 * `TransformationHooks.ts`.
 *
 * The two systems are connected by `createEventBridgeHook`: when
 * `ICompilerEvents` listeners for `onTransformationStart` /
 * `onTransformationComplete` are present, the compilers automatically register
 * the bridge hook so those callbacks continue to fire through the hook system.
 *
 * ## Safety
 *
 * All `emit*` methods delegate to `safeEmit()`, which wraps the user-supplied
 * handler in a try-catch. A throwing handler is logged but never allowed to
 * propagate into the compilation process.
 */

import type {
    IBasicLogger,
    ICompilationCompleteEvent,
    ICompilationStartEvent,
    ICompilerEvents,
    IProgressEvent,
    ISourceCompleteEvent,
    ISourceErrorEvent,
    ISourceStartEvent,
    ITransformationCompleteEvent,
    ITransformationStartEvent,
} from '../types/index.ts';
import { silentLogger } from './logger.ts';

/**
 * Type-safe event name to event data mapping
 */
type EventMap = {
    onCompilationStart: ICompilationStartEvent;
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
 * breaking the compilation process. Errors are logged to logger.
 */
export class CompilerEventEmitter {
    private readonly events: Readonly<ICompilerEvents>;
    private readonly logger: IBasicLogger;

    /**
     * Creates a new CompilerEventEmitter
     * @param events - Optional event handlers
     * @param logger - Optional logger instance for error handling
     */
    constructor(events?: ICompilerEvents, logger?: IBasicLogger) {
        this.events = Object.freeze(events ?? {});
        this.logger = logger ?? silentLogger;
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
     * Check if transformation-specific event handlers are registered.
     *
     * Used by `TransformationPipeline` to decide whether to auto-wire the
     * event-bridge hook. We check only `onTransformationStart` and
     * `onTransformationComplete` rather than the broad `hasListeners()` to
     * avoid registering hook overhead for unrelated listeners such as
     * `onProgress` or `onCompilationComplete`.
     *
     * @returns true if `onTransformationStart` or `onTransformationComplete` is set
     */
    public hasTransformationListeners(): boolean {
        return !!(this.events.onTransformationStart || this.events.onTransformationComplete);
    }

    /**
     * Emit compilation start event.
     *
     * Fires after configuration validation passes but before any source is
     * fetched. This is the earliest point at which `sourceCount` and
     * `transformationCount` are guaranteed to be correct.
     */
    public emitCompilationStart(event: ICompilationStartEvent): void {
        this.safeEmit('onCompilationStart', event);
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
     * Errors thrown by event handlers are caught and logged to logger.
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
            this.logger.error(
                `Error in event handler '${String(eventName)}': ${errorMessage}`,
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
        super(Object.freeze({}), silentLogger);
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
 * @param logger - Optional logger instance for error handling
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
export function createEventEmitter(events?: ICompilerEvents, logger?: IBasicLogger): CompilerEventEmitter {
    if (!events || Object.keys(events).length === 0) {
        return NoOpEventEmitter.getInstance();
    }
    return new CompilerEventEmitter(events, logger);
}
