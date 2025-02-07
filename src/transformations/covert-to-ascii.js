const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * Converts non-ASCII characters in the given rules to their ASCII punycode equivalents
 *
 * @param {Array<string>} rules - An array of rules to be converted.
 * @returns {Array<string>} - The array of rules with non-ASCII characters converted to punycode.
 */
function convertToAscii(rules) {
    return rules.map((rule) => {
        // 1. Check if rule is comment or empty
        if (ruleUtils.isComment(rule) || rule.length === 0) {
            return rule;
        }

        // 2. Check if rule contains non ascii characters
        if (!ruleUtils.containsNonAsciiCharacters(rule)) {
            return rule;
        }

        // 3. Replace the rule with its punycode version
        const punycodeRule = ruleUtils.convertNonAsciiToPunycode(rule);
        consola.debug(`Converting non-ASCII line ${rule} to punycode ${punycodeRule}`);

        return punycodeRule;
    });
}

module.exports = convertToAscii;
