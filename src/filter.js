const _ = require('lodash');
const { FiltersDownloader } = require('@adguard/filters-downloader');
const utils = require('./utils');
const { download, resolveFilePath } = require('./utils');
const ruleUtils = require('./rule');

/**
 * Downloads all specified files, processes their content, and returns an array of all valid lines.
 *
 * @param {Array<String>} sources - Array of URLs or file paths to download.
 * @returns {Promise<Array<String>>} - A promise that resolves to an array of non-empty, non-comment lines.
 */
async function downloadAll(sources) {
    let list = [];
    if (_.isEmpty(sources)) {
        return list;
    }

    await Promise.all(sources.map(async (source) => {
        // download the content of the source
        let rulesStr = await download(source);
        const sourceFilePath = resolveFilePath(source);

        // resolve includes within the downloaded content
        rulesStr = await FiltersDownloader.resolveIncludes(rulesStr, sourceFilePath);

        // Filter out empty lines and comments
        const rules = rulesStr.filter((line) => line.trim().length > 0 && !ruleUtils.isComment(line));
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
