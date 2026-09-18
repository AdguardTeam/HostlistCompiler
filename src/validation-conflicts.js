/**
 * Validation-conflict rules for transformation lists.
 *
 * This module is the single source of truth for the validation-conflict rules:
 * the runtime checks (used by `transform.js` and `index.js`) and the
 * JSON-schema conflict rules (used by `schemas/configuration.schema.js`) are
 * all derived from `VALIDATION_TRANSFORMATIONS`, which is defined next to the
 * `TRANSFORMATIONS` enum in `transformations/enum.js`, so they cannot drift
 * apart.
 */

const { VALIDATION_TRANSFORMATIONS } = require('./transformations/enum');

/**
 * Returns the validation transformations selected in the given list.
 *
 * @param {Array<string>} transformations - a transformations list.
 * @returns {Array<string>} the selected validation transformations.
 */
function getSelectedValidationTransformations(transformations) {
    return VALIDATION_TRANSFORMATIONS
        .filter((transformation) => transformations.indexOf(transformation) !== -1);
}

/**
 * Throws when multiple validation transformations are selected together.
 * Combining them causes silent data loss: each validator runs on the already-filtered
 * output of the previous one, so allow-modes (AllowIp, AllowPublicSuffix) become ineffective.
 *
 * @param {Array<string>} transformations - configured transformations.
 */
function checkIncompatibleValidationTransformations(transformations) {
    const selectedValidations = getSelectedValidationTransformations(transformations);

    if (selectedValidations.length > 1) {
        throw new Error(`Validation transformations cannot be combined: ${selectedValidations.join(', ')}.`);
    }
}

/**
 * Checks for conflicting validation transformations across source-level and top-level.
 * Throws if a validation transformation is used at both levels, as this causes silent data loss.
 *
 * @param {*} configuration - compilation configuration.
 */
function checkCrossLevelValidationConflicts(configuration) {
    const topLevelTransformations = configuration.transformations || [];
    const topLevelValidations = getSelectedValidationTransformations(topLevelTransformations);

    if (topLevelValidations.length === 0) {
        return;
    }

    // Check each source for conflicting validations
    // eslint-disable-next-line no-restricted-syntax
    for (const source of configuration.sources) {
        const sourceTransformations = source.transformations || [];
        const sourceValidations = getSelectedValidationTransformations(sourceTransformations);

        if (sourceValidations.length > 0) {
            throw new Error(
                'Validation transformations cannot be used at both source and top level. '
                + `Source "${source.source}" uses [${sourceValidations.join(', ')}], `
                + `but top level uses [${topLevelValidations.join(', ')}]. `
                + 'This causes the source-level validation to be overridden by the top-level one, '
                + 'making the source-level validation ineffective.',
            );
        }
    }
}

/**
 * Builds JSON-schema fragments that reject a transformations list containing
 * more than one validation transformation. The fragments are generated from
 * `VALIDATION_TRANSFORMATIONS` so the schema and the runtime checks always
 * stay in sync.
 *
 * @returns {Array<*>} an array of `not`/`allOf`/`contains` schema fragments.
 */
function buildSchemaConflictRules() {
    return VALIDATION_TRANSFORMATIONS.flatMap((first, index) => (
        VALIDATION_TRANSFORMATIONS.slice(index + 1).map((second) => ({
            not: {
                allOf: [
                    {
                        contains: {
                            const: first,
                        },
                    },
                    {
                        contains: {
                            const: second,
                        },
                    },
                ],
            },
        }))
    ));
}

module.exports = {
    checkIncompatibleValidationTransformations,
    checkCrossLevelValidationConflicts,
    buildSchemaConflictRules,
};
