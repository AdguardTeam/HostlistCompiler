const Ajv = require('ajv');
const betterAjvErrors = require('better-ajv-errors');

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const schema = require('./schemas/configuration.schema.json');

module.exports = {
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
