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

/**
 * Enum with all available transformations
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

const VALIDATION_TRANSFORMATIONS = [
    TRANSFORMATIONS.Validate,
    TRANSFORMATIONS.ValidateAllowIp,
    TRANSFORMATIONS.ValidateAllowPublicSuffix,
    TRANSFORMATIONS.ValidateAllowIpAndPublicSuffix,
];

/**
 * Throws when multiple validation transformations are selected together.
 * Combining them causes silent data loss: each validator runs on the already-filtered
 * output of the previous one, so allow-modes (AllowIp, AllowPublicSuffix) become ineffective.
 *
 * @param {Array<string>} transformations - configured transformations.
 */
function checkIncompatibleValidationTransformations(transformations) {
    const selectedValidations = VALIDATION_TRANSFORMATIONS
        .filter((transformation) => transformations.indexOf(transformation) !== -1);

    if (selectedValidations.length > 1) {
        throw new Error(`Validation transformations cannot be combined: ${selectedValidations.join(', ')}.`);
    }
}

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

    // When updating the list of transformations, be sure to follow the same order in README.md
    if (transformations.indexOf(TRANSFORMATIONS.ConvertToAscii) !== -1) {
        transformed = convertToAscii(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.TrimLines) !== -1) {
        transformed = trimLines(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.RemoveComments) !== -1) {
        transformed = removeComments(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.Compress) !== -1) {
        transformed = compress(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.RemoveModifiers) !== -1) {
        transformed = removeModifiers(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.InvertAllow) !== -1) {
        transformed = invertAllow(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.Validate) !== -1) {
        transformed = validate(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.ValidateAllowIp) !== -1) {
        transformed = validateAllowIp(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.ValidateAllowPublicSuffix) !== -1) {
        transformed = validateAllowPublicSuffix(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.ValidateAllowIpAndPublicSuffix) !== -1) {
        transformed = validateAllowIpAndPublicSuffix(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.Deduplicate) !== -1) {
        transformed = deduplicate(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.RemoveEmptyLines) !== -1) {
        transformed = removeEmptyLines(transformed);
    }
    if (transformations.indexOf(TRANSFORMATIONS.InsertFinalNewLine) !== -1) {
        transformed = insertFinalNewLine(transformed);
    }
    return transformed;
}

module.exports = {
    transform,
    TRANSFORMATIONS,
};
