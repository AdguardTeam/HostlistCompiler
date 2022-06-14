const _ = require('lodash');
const consola = require('consola');
const filterUtils = require('../filter');

/**
 * Scans the specified array of rules and removes all that match the specified exclusions.
 *
 * @param {Array<String>} rules - array of rules to filter
 * @param {Array<String>} exclusions - array of exclusions to apply
 * @param {Array<String>} exclusionsSources - array of exclusion sources
 * (can be a local or remote file)
 * @returns {Promise<Array<String>>} filtered array of rules
 */
async function exclude(rules, exclusions, exclusionsSources) {
    if (_.isEmpty(exclusions) && _.isEmpty(exclusionsSources)) {
        // Nothing to filter here
        return rules;
    }

    const wildcards = await filterUtils.prepareWildcards(exclusions, exclusionsSources);
    if (_.isEmpty(wildcards)) {
        return rules;
    }
    consola.info(`Filtering the list of rules using ${wildcards.length} exclusion rules`);

    const filtered = rules.filter((rule) => {
        const excluded = wildcards.some((w) => {
            const found = w.test(rule);
            if (found) {
                consola.debug(`${rule} excluded by ${w.toString()}`);
            }
            return found;
        });
        return !excluded;
    });

    consola.info(`Excluded ${rules.length - filtered.length} rules. ${filtered.length} rules left.`);
    return filtered;
}

module.exports = exclude;
