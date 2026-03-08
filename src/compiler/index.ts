/**
 * @module compiler
 * Core compiler module for the AdBlock Compiler.
 *
 * Exports the primary compilation classes and helpers:
 * - {@link FilterCompiler} – orchestrates the full compilation pipeline (download,
 *   transform, format) for one or more filter-list sources.
 * - {@link SourceCompiler} – lower-level compiler that operates on already-fetched
 *   rule strings rather than remote URLs.
 * - {@link compile} – convenience function wrapping `FilterCompiler` for single-call
 *   usage.
 */
export { SourceCompiler } from './SourceCompiler.ts';
export { compile, FilterCompiler } from './FilterCompiler.ts';
export type { CompilationResult, FilterCompilerOptions } from './FilterCompiler.ts';
