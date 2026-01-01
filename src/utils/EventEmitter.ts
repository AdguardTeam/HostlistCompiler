/**
 * Lightweight event emitter for compiler observability.
 * Provides a simple callback-based event system without external dependencies.
 */

import {
    ICompilerEvents,
    ISourceStartEvent,
    ISourceCompleteEvent,
    ISourceErrorEvent,
    ITransformationStartEvent,
    ITransformationCompleteEvent,
    IProgressEvent,
    ICompilationCompleteEvent,
} from '../types/index.ts';

/**
 * Event emitter that wraps ICompilerEvents callbacks.
 * Provides safe event emission with error handling.
 */
export class CompilerEventEmitter {
    private readonly events: ICompilerEvents;

    constructor(events?: ICompilerEvents) {
        this.events = events || {};
    }

    /**
     * Check if any event handlers are registered
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
     */
    private safeEmit<K extends keyof ICompilerEvents>(
        eventName: K,
        event: Parameters<NonNullable<ICompilerEvents[K]>>[0],
    ): void {
        const handler = this.events[eventName];
        if (handler) {
            try {
                // deno-lint-ignore no-explicit-any
                (handler as (event: any) => void)(event);
            } catch (error) {
                // Log but don't throw - event handlers shouldn't break compilation
                console.error(`Error in event handler '${eventName}':`, error);
            }
        }
    }
}

/**
 * No-op event emitter for when no events are registered.
 * Provides the same interface but does nothing, avoiding overhead.
 */
export class NoOpEventEmitter extends CompilerEventEmitter {
    constructor() {
        super({});
    }

    public override hasListeners(): boolean {
        return false;
    }

    public override emitSourceStart(_event: ISourceStartEvent): void {
        // No-op
    }

    public override emitSourceComplete(_event: ISourceCompleteEvent): void {
        // No-op
    }

    public override emitSourceError(_event: ISourceErrorEvent): void {
        // No-op
    }

    public override emitTransformationStart(_event: ITransformationStartEvent): void {
        // No-op
    }

    public override emitTransformationComplete(_event: ITransformationCompleteEvent): void {
        // No-op
    }

    public override emitProgress(_event: IProgressEvent): void {
        // No-op
    }

    public override emitCompilationComplete(_event: ICompilationCompleteEvent): void {
        // No-op
    }
}

/**
 * Factory function to create the appropriate emitter.
 * Returns a NoOpEventEmitter if no handlers are provided.
 */
export function createEventEmitter(events?: ICompilerEvents): CompilerEventEmitter {
    if (!events || Object.keys(events).length === 0) {
        return new NoOpEventEmitter();
    }
    return new CompilerEventEmitter(events);
}
