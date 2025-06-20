const consola = require('consola');
const filterUtils = require('../filter');

/**
 * Scans the specified array of rules and removes all that do not match the specified inclusions.
 *
 * @param {Array<String>} rules - array of rules to filter
 * @param {Array<String>} inclusions - array of inclusions to apply
 * @param {Array<String>} inclusionsSources - array of inclusions' sources
 * (can be a local or remote file)
 * @returns {Promise<Array<String>>} filtered array of rules
 */
async function include(rules, inclusions, inclusionsSources) {
    if ((!inclusions || inclusions.length === 0) && (!inclusionsSources || inclusionsSources.length === 0)) {
        // Nothing to filter here
        return rules;
    }

    const wildcards = await filterUtils.prepareWildcards(inclusions, inclusionsSources);
    if (wildcards.length === 0) {
        return rules;
    }
    consola.info(`Filtering the list of rules using ${wildcards.length} inclusion rules`);

    const filtered = rules.filter((rule) => {
        const included = wildcards.some((w) => w.test(rule));
        if (!included) {
            consola.debug(`${rule} does not match inclusions list`);
        }

        return included;
    });

    consola.info(`Included ${rules.length} rules`);
    return filtered;
}

module.exports = include;
