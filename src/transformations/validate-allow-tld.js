const { Validator } = require('./validate');

/**
 * Validates a list of rules and allows TLD/public suffix matching.
 *
 * This function creates an instance of the `Validator` class, enabling TLD
 * public suffix matching, and returns filtered list of valid rules.
 *
 * @param {Array<string>} rules - The array of rules to validate.
 * @returns {Array<string>} - The filtered array of valid rules.
 */
function validateAllowTLD(rules) {
    // ip is not allowed by default, but public suffix matching is allowed.
    const validator = new Validator(false, true);
    return validator.validate(rules);
}

module.exports = {
    validateAllowTLD,
};
