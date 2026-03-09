/**
 * @module transformations
 * Built-in rule transformation pipeline for the AdBlock Compiler.
 *
 * A *transformation* takes an ordered list of rule strings and returns a
 * (potentially modified) ordered list of rule strings.  Transformations are
 * composable via {@link TransformationPipeline} and discoverable by name via
 * {@link TransformationRegistry}.
 *
 * **Built-in transformations:**
 * | Export | Description |
 * |--------|-------------|
 * | {@link RemoveCommentsTransformation} | Strips comment lines (`!`, `#`, …) |
 * | {@link TrimLinesTransformation} | Removes leading/trailing whitespace per line |
 * | {@link RemoveEmptyLinesTransformation} | Removes blank lines |
 * | {@link InsertFinalNewLineTransformation} | Ensures a trailing newline |
 * | {@link ConvertToAsciiTransformation} | Punycode-encodes non-ASCII domain labels |
 * | {@link InvertAllowTransformation} | Flips blocking rules to allow rules |
 * | {@link RemoveModifiersTransformation} | Strips unsupported rule modifiers |
 * | {@link DeduplicateTransformation} | Removes duplicate rules (order-preserving) |
 * | {@link ValidateTransformation} | Validates DNS-level rules; removes raw IPs |
 * | {@link ValidateAllowIpTransformation} | Like `Validate` but keeps IP rules |
 * | {@link CompressTransformation} | Converts hosts-format entries to adblock syntax |
 * | {@link ExcludeTransformation} | Removes rules matching a user-supplied exclusion list |
 * | {@link IncludeTransformation} | Keeps only rules matching a user-supplied inclusion list |
 */
// Base classes
export { AsyncTransformation, SyncTransformation, Transformation } from './base/Transformation.ts';

// Transformation classes
export { RemoveCommentsTransformation } from './RemoveCommentsTransformation.ts';
export { TrimLinesTransformation } from './TrimLinesTransformation.ts';
export { RemoveEmptyLinesTransformation } from './RemoveEmptyLinesTransformation.ts';
export { InsertFinalNewLineTransformation } from './InsertFinalNewLineTransformation.ts';
export { ConvertToAsciiTransformation } from './ConvertToAsciiTransformation.ts';
export { InvertAllowTransformation } from './InvertAllowTransformation.ts';
export { RemoveModifiersTransformation } from './RemoveModifiersTransformation.ts';
export { DeduplicateTransformation } from './DeduplicateTransformation.ts';
export { ValidateAllowIpTransformation, ValidateTransformation } from './ValidateTransformation.ts';
export { CompressTransformation } from './CompressTransformation.ts';
export { ExcludeTransformation } from './ExcludeTransformation.ts';
export { IncludeTransformation } from './IncludeTransformation.ts';

// Registry and Pipeline
export { TransformationPipeline, TransformationRegistry } from './TransformationRegistry.ts';

// Hooks
export { createEventBridgeHook, createLoggingHook, createMetricsHook, NoOpHookManager, TransformationHookManager } from './TransformationHooks.ts';
export type { AfterTransformHook, BeforeTransformHook, TransformationHookConfig, TransformationHookContext, TransformErrorHook } from './TransformationHooks.ts';
