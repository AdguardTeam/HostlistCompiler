const Ajv = require('ajv');
const betterAjvErrors = require('better-ajv-errors');
const { DEFAULT_TRANSFORMATIONS } = require('./transformations/transform');

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const schema = require('./schemas/configuration.schema.json');

/**
 * Default name for the lists compiled in the quick conversion mode.
 */
const DEFAULT_LIST_NAME = 'Blocklist';

/**
 * Default source type for the quick conversion mode: /etc/hosts files.
 */
const DEFAULT_SOURCE_TYPE = 'hosts';

/**
 * Creates a configuration object for the quick conversion mode (the CLI `-i`
 * option): compiles the specified sources with the default transformation
 * pipeline.
 *
 * @param {Array<string>} inputs - list of the source paths or URLs.
 * @param {Object} [options] - optional overrides.
 * @param {string} [options.type] - type of the input sources (`adblock` or
 * `hosts`), defaults to `hosts`.
 * @returns {Object} configuration object.
 */
function createConfiguration(inputs, options = {}) {
    const type = options.type || DEFAULT_SOURCE_TYPE;

    return {
        name: DEFAULT_LIST_NAME,
        sources: inputs.map((input) => ({
            source: input,
            type,
        })),
        transformations: DEFAULT_TRANSFORMATIONS,
    };
}

module.exports = {
    /**
     * Creates a configuration object for the quick conversion mode (the CLI `-i`
     * option): compiles the specified sources with the default transformation
     * pipeline.
     *
     * @param {Array<string>} inputs - list of the source paths or URLs.
     * @param {Object} [options] - optional overrides.
     * @param {string} [options.type] - type of the input sources (`adblock` or
     * `hosts`), defaults to `hosts`.
     * @returns {Object} configuration object.
     */
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
