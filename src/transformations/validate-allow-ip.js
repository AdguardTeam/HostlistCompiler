const { Validator } = require('./validate');
const { normalizeIpRules } = require('./ip-normalize');

/**
 * Validates a list of rules and allows IP validation.
 *
 * This function first normalizes incomplete IP rules to the safe format ||ip^,
 * then creates an instance of the `Validator` class, enabling IP address validation,
 * and returns a filtered list of valid rules.
 *
 * IP normalization:
 * - 4-octet IPs without proper separators are normalized to ||ip^
 * - 3-octet subnet patterns (192.168.1., 192.168.1.*) are allowed with || prefix
 * - 3-octet patterns without trailing dot/wildcard are rejected (ambiguous)
 * - 3-octet patterns with ^ are rejected (don't work in AdGuard Home)
 * - 1-2 octet patterns are rejected (too wide, use regex instead)
 *
 * @param {Array<string>} rules - The array of rules to validate.
 * @returns {Array<string>} - The filtered array of valid rules, allowing IP addresses.
 */
function validateAllowIp(rules) {
    // First, normalize IP rules (convert incomplete patterns to ||ip^)
    const normalizedRules = normalizeIpRules(rules);

    // Then validate with IP addresses allowed
    // tld is not allowed by default here
    const validator = new Validator(true, false);
    return validator.validate(normalizedRules);
}

module.exports = {
    validateAllowIp,
};
