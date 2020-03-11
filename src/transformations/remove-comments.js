const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * This is a very simple transformation that discards
 * all rules starting with `!` or `#`.
 *
 * @param {Array<string>} rules - rules to transform
 * @returns {Array<string>} filtered rules
 */
function removeComments(rules) {
    const filtered = rules.filter((rule) => !ruleUtils.isComment(rule));
    consola.info(`Removed ${rules.length - filtered.length} comments`);
    return filtered;
}

module.exports = removeComments;
