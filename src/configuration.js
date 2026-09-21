const Ajv = require('ajv');
const betterAjvErrors = require('better-ajv-errors');
const { SOURCE_TYPES } = require('./source-types');
const { DEFAULT_TRANSFORMATIONS } = require('./transformations/transform');

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const schema = require('./schemas/configuration.schema');

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
            errorsText: valid ? null : betterAjvErrors(schema, configuration, validate.errors),
        };
    },
};
