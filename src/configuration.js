const Ajv = require('ajv');
// better-ajv-errors 1.x exposes its renderer as the CommonJS default export.
const { default: betterAjvErrors } = require('better-ajv-errors');
const { SOURCE_TYPES } = require('./source-types');
const { DEFAULT_TRANSFORMATIONS } = require('./transformations/transform');
const {
    sanitizeConfigurationForLog,
    stripKnownUrlCredentials,
} = require('./utils');

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const schema = require('./schemas/configuration.schema');

/**
 * Escapes one segment of a JSON pointer. `better-ajv-errors` builds the
 * pointer to an additional property as `${dataPath}/${additionalProperty}`
 * without escaping, so a key with `/` or `~` would not resolve.
 *
 * @param {String} value - the property name.
 * @returns {String} the escaped pointer segment.
 */
function escapeJsonPointerSegment(value) {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Prepares `validate.errors` for `better-ajv-errors` against the sanitized
 * configuration copy. An additional property is renamed in the sanitized copy
 * (credentials are removed from keys), so the error must point at the
 * sanitized name. The property name is also escaped as a JSON pointer segment,
 * because `better-ajv-errors` does not escape it when it resolves the code
 * frame. The returned replacements restore the readable property name in the
 * rendered text.
 *
 * @param {Array<Object>} errors - the AJV errors.
 * @returns {{ errors: Array<Object>, replacements: Array<Array<String>> }}
 * the errors to render and the pointer-to-name replacements.
 */
function prepareValidationErrors(errors) {
    const replacements = [];
    const preparedErrors = errors.map((error) => {
        const additionalProperty = error.params && error.params.additionalProperty;

        if (typeof additionalProperty !== 'string') {
            return error;
        }

        const sanitizedProperty = stripKnownUrlCredentials(additionalProperty);
        const pointerSegment = escapeJsonPointerSegment(sanitizedProperty);

        if (pointerSegment !== sanitizedProperty) {
            replacements.push([pointerSegment, sanitizedProperty]);
        }

        if (pointerSegment === additionalProperty) {
            return error;
        }

        return {
            ...error,
            params: {
                ...error.params,
                additionalProperty: pointerSegment,
            },
        };
    });

    // Replace a longer pointer first, so a pointer that is a prefix of another
    // does not corrupt the longer one.
    replacements.sort(([first], [second]) => second.length - first.length);

    return { errors: preparedErrors, replacements };
}

/**
 * Restores the readable property names in the rendered validation text after
 * `better-ajv-errors` used their escaped pointer segments.
 *
 * @param {String} errorsText - the rendered validation errors.
 * @param {Array<Array<String>>} replacements - pairs of a pointer segment and
 * the property name.
 * @returns {String} the text with readable property names.
 */
function restorePropertyNames(errorsText, replacements) {
    return replacements.reduce(
        (text, [pointerSegment, property]) => text.split(pointerSegment).join(property),
        errorsText,
    );
}

/**
 * Renders the AJV errors against a sanitized configuration copy.
 *
 * `better-ajv-errors` embeds the configuration in the message, and it renders
 * object keys and `toJSON` results, so the copy must be JSON-safe.
 *
 * @param {*} configuration - the configuration that failed validation.
 * @param {Array<Object>} errors - the AJV errors.
 * @returns {String} the rendered validation errors.
 */
function formatValidationErrors(configuration, errors) {
    const prepared = prepareValidationErrors(errors);
    const errorsText = betterAjvErrors(
        schema,
        sanitizeConfigurationForLog(configuration),
        prepared.errors,
    );

    return restorePropertyNames(errorsText, prepared.replacements);
}

/**
 * Creates a configuration object for the quick conversion mode (the CLI `-i`
 * option): compiles the specified sources with the default transformation
 * pipeline.
 *
 * @param {Array<string>} inputs - list of the source paths or URLs.
 * @param {string} [type] - type of the input sources (`adblock` or `hosts`),
 * defaults to `hosts`.
 * @returns {Object} configuration object.
 */
function createConfiguration(inputs, type = SOURCE_TYPES.HOSTS) {
    return {
        name: 'Blocklist',
        sources: inputs.map((input) => ({
            source: input,
            // An empty string (e.g. the CLI flag `-t ''`) must fall back to
            // the default type, like the old `argv['input-type'] || 'hosts'`.
            type: type || SOURCE_TYPES.HOSTS,
        })),
        transformations: [...DEFAULT_TRANSFORMATIONS],
    };
}

module.exports = {
    createConfiguration,
    /**
     * Validates the specified configuration object
     *
     * @param {*} configuration configuration object to validate
     * @returns {*} if ".valid" is false, check ".errorsText"
     */
    validateConfiguration(configuration) {
        const validate = ajv.compile(schema);
        const valid = validate(configuration);
        return {
            valid,
            // The validation itself runs against the original configuration,
            // but the rendered text is built from a sanitized copy.
            errorsText: valid ? null : formatValidationErrors(configuration, validate.errors),
        };
    },
};
