/**
 * Diagnostics and tracing module for comprehensive observability.
 * 
 * This module provides utilities for tracing operations through the compilation pipeline
 * and emitting diagnostic events that can be consumed by the tail worker.
 * 
 * @example Basic usage
 * ```ts
 * import { createTracingContext, traceAsync } from './diagnostics/index.ts';
 * 
 * const context = createTracingContext();
 * 
 * await traceAsync(context, 'myOperation', async () => {
 *   // Your code here
 * });
 * 
 * const events = context.diagnostics.getEvents();
 * console.log(events);
 * ```
 * 
 * @example With Worker Compiler
 * ```ts
 * import { WorkerCompiler } from './compiler/index.ts';
 * import { createTracingContext } from './diagnostics/index.ts';
 * 
 * const context = createTracingContext();
 * const compiler = new WorkerCompiler({ tracingContext: context });
 * 
 * const result = await compiler.compile(config);
 * const diagnostics = context.diagnostics.getEvents();
 * ```
 */

export * from './types.ts';
export { DiagnosticsCollector, NoOpDiagnosticsCollector } from './DiagnosticsCollector.ts';
export {
    createTracingContext,
    createChildContext,
    createNoOpContext,
    traced,
    tracedAsync,
    traceSync,
    traceAsync,
    getOrCreateContext,
} from './TracingContext.ts';
