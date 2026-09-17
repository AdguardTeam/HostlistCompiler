/**
 * All available transformations.
 *
 * This module is the single source of truth for transformation names: the
 * transformation pipeline (`transform.js`), the validation-conflict rules
 * (`validation-conflicts.js`) and the configuration schema all derive their
 * names from the `TRANSFORMATIONS` enum, so they cannot drift apart.
 */
const TRANSFORMATIONS = Object.freeze({
    RemoveComments: 'RemoveComments',
    Compress: 'Compress',
    RemoveModifiers: 'RemoveModifiers',
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

module.exports = {
    TRANSFORMATIONS,
};
