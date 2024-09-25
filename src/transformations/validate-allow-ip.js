const { Validator } = require('./validate');

/**
 * Validates a list of rules and allows IP validation.
 *
 * This function creates an instance of the `Validator` class, enabling IP address validation,
 * and returns a filtered list of valid rules.
 *
 * @param {Array<string>} rules - The array of rules to validate.
 * @returns {Array<string>} - The filtered array of valid rules, allowing IP addresses.
 */
function validateAllowIp(rules) {
    // ip is not allowed by default
    const validator = new Validator(true);
    return validator.validate(rules);
}
module.exports = {
    validateAllowIp,
};
