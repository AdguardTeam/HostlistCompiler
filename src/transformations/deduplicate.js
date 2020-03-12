const _ = require('lodash');
const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * Deduplicates the rules array.
 *
 * There are two important notes about this transformation:
 * 1. It keeps the original rules order.
 * 2. It ignores comments. However, if the comments precede the rule
 * that is being removed, the comments will be also removed.
 *
 * @param {Array<String>} rules - rules to remove duplicates from
 * @returns {Array<String>} "deduplicated" array of rules
 */
function deduplicate(rules) {
    if (_.isEmpty(rules)) {
        consola.info('Empty rules array, nothing to deduplicate');
        return rules;
    }

    // Clone the original array before modifying it
    const filtered = [...rules];
    let prevRuleRemoved = false;
    const rulesIndex = {};

    for (let iFiltered = filtered.length - 1; iFiltered >= 0; iFiltered -= 1) {
        const ruleText = filtered[iFiltered];

        const dup = (ruleText in rulesIndex);
        if (!dup) {
            rulesIndex[ruleText] = true;
        }

        if (dup && !ruleUtils.isComment(ruleText) && !_.isEmpty(ruleText)) {
            prevRuleRemoved = true;
            consola.debug(`Removing duplicate: ${ruleText}`);
            filtered.splice(iFiltered, 1);
        } else if (prevRuleRemoved && (ruleUtils.isComment(ruleText) || _.isEmpty(ruleText))) {
            // Remove preceding comments and empty lines
            consola.debug(`Removing a comment preceding duplicate: ${ruleText}`);
            filtered.splice(iFiltered, 1);
        } else {
            // Stop removing comments
            prevRuleRemoved = false;
        }
    }

    consola.info(`Deduplication removed ${rules.length - filtered.length} rules`);
    return filtered;
}

module.exports = deduplicate;
