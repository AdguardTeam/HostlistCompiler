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
export { createChildContext, createNoOpContext, createTracingContext, getOrCreateContext, traceAsync, traced, tracedAsync, traceSync } from './TracingContext.ts';
export { createOpenTelemetryExporter, OpenTelemetryExporter, type OpenTelemetryExporterOptions } from './OpenTelemetryExporter.ts';
export type { IDiagnosticsProvider, ISpan } from './IDiagnosticsProvider.ts';
export { ConsoleDiagnosticsProvider, NoOpDiagnosticsProvider } from './IDiagnosticsProvider.ts';
export { SentryDiagnosticsProvider } from './SentryDiagnosticsProvider.ts';
export type { SentryDiagnosticsProviderOptions } from './SentryDiagnosticsProvider.ts';
export { OpenTelemetryDiagnosticsProvider } from './OpenTelemetryDiagnosticsProvider.ts';
export type { OpenTelemetryDiagnosticsProviderOptions } from './OpenTelemetryDiagnosticsProvider.ts';
export { CompositeDiagnosticsProvider } from './CompositeDiagnosticsProvider.ts';
