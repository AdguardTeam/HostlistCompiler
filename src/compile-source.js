const consola = require('consola');
const { FiltersDownloader } = require('@adguard/filters-downloader');
const { transform } = require('./transformations/transform');
const { download, resolveFilePath } = require('./utils');

/**
 * A source configuration. See a better description in README.md
 * @typedef {Object} ListSource
 * @property {String} source - (mandatory) path or URL of the source.
 * @property {String} name - name of the source.
 * @property {String} type - type of the source (adblock or hosts).
 * @property {Array<String>} transformations - a list of transformations to apply.
 * @property {Array<String>} exclusions - a list of the rules (or wildcards) to exclude.
 * @property {Array<String>} exclusions_sources - a list of files with exclusions.
 */

/**
 * Compiles an individual source according to it's configuration.
 *
 * @param {ListSource} source - source configuration.
 * @returns {Promise<Array<string>>} array with the source rules
 */
async function compileSource(source) {
    consola.info(`Start compiling ${source.source}`);
    let rules = await download(source.source);

    // get the full path of the source directory for local files
    const sourceFilePath = resolveFilePath(source.source);

    consola.info(`Full path of the source directory is ${sourceFilePath || source.source}`);
    // resolve includes
    rules = await FiltersDownloader.resolveIncludes(rules, sourceFilePath);

    consola.info(`Original length is ${rules.length}`);
    // apply transformations
    rules = await transform(rules, source, source.transformations);

    consola.info(`Length after applying transformations is ${rules.length}`);
    return rules;
}

module.exports = compileSource;
