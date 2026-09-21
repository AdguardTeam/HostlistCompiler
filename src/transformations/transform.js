const removeComments = require('./remove-comments');
const removeModifiers = require('./remove-modifiers');
const { validate } = require('./validate');
const { validateAllowIp } = require('./validate-allow-ip');
const { validateAllowPublicSuffix } = require('./validate-allow-public-suffix');
const { validateAllowIpAndPublicSuffix } = require('./validate-allow-ip-and-public-suffix');
const exclude = require('./exclude');
const include = require('./include');
const deduplicate = require('./deduplicate');
const compress = require('./compress');
const invertAllow = require('./invertallow');
const removeEmptyLines = require('./remove-empty-lines');
const trimLines = require('./trim-lines');
const insertFinalNewLine = require('./insert-final-newline');
const convertToAscii = require('./covert-to-ascii');
const { TRANSFORMATIONS } = require('./enum');
const { checkIncompatibleValidationTransformations } = require('../validation-conflicts');

/**
 * The default transformation pipeline for the quick conversion mode (the CLI
 * `-i` option): converts /etc/hosts rules to AdGuard-syntax rules.
 */
const DEFAULT_TRANSFORMATIONS = Object.freeze([
    TRANSFORMATIONS.RemoveComments,
    TRANSFORMATIONS.Deduplicate,
    TRANSFORMATIONS.Compress,
    TRANSFORMATIONS.Validate,
    TRANSFORMATIONS.TrimLines,
    TRANSFORMATIONS.InsertFinalNewLine,
]);

/**
 * The transformations in their fixed execution order, paired with their implementations.
 *
 * When adding a transformation: add it to the `TRANSFORMATIONS` enum in
 * `enum.js`, then register it here (order matters — it is the execution order
 * and MUST match the order list in README.md). A test in `transform.test.js`
 * asserts this list covers every entry of the enum and pins its order, so a
 * forgotten branch or an accidental reorder fails the suite instead of being
 * silently skipped.
 */
const TRANSFORMATIONS_IN_ORDER = [
    [TRANSFORMATIONS.ConvertToAscii, convertToAscii],
    [TRANSFORMATIONS.TrimLines, trimLines],
    [TRANSFORMATIONS.RemoveComments, removeComments],
    [TRANSFORMATIONS.Compress, compress],
    [TRANSFORMATIONS.RemoveModifiers, removeModifiers],
    [TRANSFORMATIONS.InvertAllow, invertAllow],
    [TRANSFORMATIONS.Validate, validate],
    [TRANSFORMATIONS.ValidateAllowIp, validateAllowIp],
    [TRANSFORMATIONS.ValidateAllowPublicSuffix, validateAllowPublicSuffix],
    [TRANSFORMATIONS.ValidateAllowIpAndPublicSuffix, validateAllowIpAndPublicSuffix],
    [TRANSFORMATIONS.Deduplicate, deduplicate],
    [TRANSFORMATIONS.RemoveEmptyLines, removeEmptyLines],
    [TRANSFORMATIONS.InsertFinalNewLine, insertFinalNewLine],
];

/**
 * Applies the specified transformations to the list of rules in the proper order.
 *
 * @param {Array<string>} rules - rules to transform
 * @param {*} configuration - transformation configuration.
 * @param {Array<string>} transformations - a list of transformations to apply to the rules.
 * @returns {Promise<Array<string>>} rules after applying all transformations.
 */
async function transform(rules, configuration, transformations) {
    // If none specified -- apply all transformations
    if (!transformations) {
        // eslint-disable-next-line no-param-reassign
        transformations = [];
    }

    checkIncompatibleValidationTransformations(transformations);

    let transformed = rules;

    transformed = await exclude(
        transformed,
        configuration.exclusions,
        configuration.exclusions_sources,
    );
    transformed = await include(
        transformed,
        configuration.inclusions,
        configuration.inclusions_sources,
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const [name, apply] of TRANSFORMATIONS_IN_ORDER) {
        if (transformations.indexOf(name) !== -1) {
            transformed = apply(transformed);
        }
    }
    return transformed;
}

module.exports = {
    transform,
    DEFAULT_TRANSFORMATIONS,
    TRANSFORMATIONS_IN_ORDER,
};
