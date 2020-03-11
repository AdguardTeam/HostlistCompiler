const _ = require('lodash');
const consola = require('consola');
const utils = require('../utils');
const ruleUtils = require('../rule');

/**
 * Loads exclusions from the specified sources
 *
 * @param {Array<string>} exclusionsSources - exclusions sources
 * @returns {Array<string>} array with all the exclusions
 */
async function loadExclusions(exclusionsSources) {
    let exclusions = [];
    if (_.isEmpty(exclusionsSources)) {
        return exclusions;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const s of exclusionsSources) {
        // eslint-disable-next-line no-await-in-loop
        const rulesStr = await utils.download(s);
        const rules = rulesStr
            .split(/\r?\n/)
            .filter((el) => el.trim().length > 0 && !ruleUtils.isComment(el));
        exclusions = exclusions.concat(rules);
    }

    consola.info(`Loaded ${exclusions.length} exclusions from external sources`);
    return exclusions;
}

/**
 * Creates a list of exclusions wildcards
 *
 * @param {Array<string>} exclusions - array of exclusions to apply
 * @param {Array<string>} exclusionsSources - array of exclusion sources
 * (can be local or remote files)
 * @returns {Array<utils.Wildcard} a list of wildcards to apply
 */
async function prepareExclusionWildcards(exclusions, exclusionsSources) {
    let exclusionsArr = [];
    if (!_.isEmpty(exclusions)) {
        exclusionsArr = exclusionsArr.concat(exclusions);
    }
    const loadedExclusions = await loadExclusions(exclusionsSources);
    exclusionsArr = exclusionsArr.concat(loadedExclusions);
    exclusionsArr = _.compact(_.uniq(exclusionsArr));

    return exclusionsArr.map((str) => new utils.Wildcard(str));
}

/**
 * Scans the specified array of rules and removes all that match the specified exclusions.
 *
 * @param {Array<string>} rules - array of rules to filter
 * @param {Array<string>} exclusions - array of exclusions to apply
 * @param {Array<string>} exclusionsSources - array of exclusion sources
 * (can be a local or remote file)
 * @returns {Array<string>} filtered array of rules
 */
async function exclude(rules, exclusions, exclusionsSources) {
    if (_.isEmpty(exclusions) && _.isEmpty(exclusionsSources)) {
        // Nothing to filter here
        return rules;
    }

    const wildcards = await prepareExclusionWildcards(exclusions, exclusionsSources);
    if (_.isEmpty(wildcards)) {
        return rules;
    }

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

    consola.info(`Excluded ${rules.length - filtered.length} rules`);
    return filtered;
}

module.exports = exclude;
