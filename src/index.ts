// Main entry point for the hostlist compiler library

// Types
export * from './types';

// Utils
export { RuleUtils, StringUtils, Wildcard } from './utils';

// Configuration
export { ConfigurationValidator } from './configuration';

// Transformations
export {
    Transformation,
    SyncTransformation,
    AsyncTransformation,
    RemoveCommentsTransformation,
    TrimLinesTransformation,
    RemoveEmptyLinesTransformation,
    InsertFinalNewLineTransformation,
    ConvertToAsciiTransformation,
    InvertAllowTransformation,
    RemoveModifiersTransformation,
    DeduplicateTransformation,
    ValidateTransformation,
    ValidateAllowIpTransformation,
    CompressTransformation,
    ExcludeTransformation,
    IncludeTransformation,
    TransformationRegistry,
    TransformationPipeline,
} from './transformations';

// Services
export { FilterService } from './services';

// Compiler
export { SourceCompiler, FilterCompiler, compile } from './compiler';

// Default export for backward compatibility
import { compile as compileFunc } from './compiler';
export default compileFunc;
