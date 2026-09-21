/**
 * All available transformations.
 *
 * This module is the single source of truth for transformation names: the
 * configuration schema derives its accepted names from `TRANSFORMATIONS`, and
 * the validation-conflict rules (`validation-conflicts.js`) derive their list
 * from `VALIDATION_TRANSFORMATIONS` below, so they cannot drift apart.
 *
 * Declaration order is significant: the schema's `items.enum` is
 * `Object.values(TRANSFORMATIONS)`, and that order is what the
 * unknown-transformation error renders as the allowed-values list. Keep it
 * matching the pre-AG-58267 schema order (RemoveComments, RemoveModifiers,
 * Compress, ...) — a test pins it.
 */
const TRANSFORMATIONS = Object.freeze({
    RemoveComments: 'RemoveComments',
    RemoveModifiers: 'RemoveModifiers',
    Compress: 'Compress',
    Validate: 'Validate',
    ValidateAllowIp: 'ValidateAllowIp',
    ValidateAllowPublicSuffix: 'ValidateAllowPublicSuffix',
    ValidateAllowIpAndPublicSuffix: 'ValidateAllowIpAndPublicSuffix',
    Deduplicate: 'Deduplicate',
    InvertAllow: 'InvertAllow',
    RemoveEmptyLines: 'RemoveEmptyLines',
    TrimLines: 'TrimLines',
    InsertFinalNewLine: 'InsertFinalNewLine',
    ConvertToAscii: 'ConvertToAscii',
});

/**
 * The validation transformations — the subset of `TRANSFORMATIONS` that cannot
 * be combined with each other.
 *
 * Defined right below the enum so that adding a validation transformation is a
 * single-file change: the runtime conflict checks and the generated schema
 * conflict rules (`validation-conflicts.js`) are derived from this list.
 */
const VALIDATION_TRANSFORMATIONS = Object.freeze([
    TRANSFORMATIONS.Validate,
    TRANSFORMATIONS.ValidateAllowIp,
    TRANSFORMATIONS.ValidateAllowPublicSuffix,
    TRANSFORMATIONS.ValidateAllowIpAndPublicSuffix,
]);

module.exports = {
    TRANSFORMATIONS,
    VALIDATION_TRANSFORMATIONS,
};
