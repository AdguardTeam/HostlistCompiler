const _ = require('lodash');
const { FiltersDownloader } = require('@adguard/filters-downloader');
const utils = require('./utils');
const ruleUtils = require('./rule');

/**
 * Download all specified files, split them into string arrays,
 * and return a final array with all the lines from all files.
 *
 * @param {Array<String>} sources - array of URLs.
 * @returns {Promise<Array<String>>} array with all non-empty and non-comment lines.
 */
async function downloadAll(sources) {
    let list = [];
    if (_.isEmpty(sources)) {
        return list;
    }

    await Promise.all(sources.map(async (source) => {
        const rulesStr = await FiltersDownloader.download(source, {}, { allowEmptyResponse: true });
        const rules = rulesStr
            .filter((el) => el.trim().length > 0 && !ruleUtils.isComment(el));
        list = list.concat(rules);
    }));

    return list;
}

/**
 * Creates a list of exclusions or inclusions wildcards
 *
 * @param {Array<String>} rules - array of rules to apply
 * @param {Array<String>} sources - array of rules sources
 * (can be local or remote files)
 * @returns {Promise<Array<utils.Wildcard>>} a list of wildcards to apply
 */
async function prepareWildcards(rules, sources) {
    let list = [];
    if (!_.isEmpty(rules)) {
        list = list.concat(rules);
    }
    const loadedList = await downloadAll(sources);
    list = list.concat(loadedList);
    list = _.compact(_.uniq(list));

    return list.map((str) => new utils.Wildcard(str));
}

module.exports = {
    prepareWildcards,
};
