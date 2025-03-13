const consola = require('consola');
const { FiltersDownloader } = require('@adguard/filters-downloader');
const { transform } = require('./transformations/transform');

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
    let rules = await FiltersDownloader.download(source.source, {}, { allowEmptyResponse: true });
    consola.info(`Original length is ${rules.length}`);

    rules = await transform(rules, source, source.transformations);

    consola.info(`Length after applying transformations is ${rules.length}`);
    return rules;
}

module.exports = compileSource;
