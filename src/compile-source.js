const _ = require('lodash');
const consola = require('consola');
const { download } = require('./download');
const ruleUtils = require('./rule');
const { transform } = require('./transformations/transform');
const { stripKnownUrlCredentials } = require('./utils');
const { checkIncompatibleValidationTransformations } = require('./validation-conflicts');

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
 * Checks whether a downloaded source contains no rules.
 *
 * A source is empty when it has no entries, or when every entry is blank,
 * a comment line, or an Adblock Plus format header.
 *
 * @param {Array<string>} rules - downloaded source rules.
 * @returns {boolean} true if the source contains no rules.
 */
function isEmptySource(rules) {
    if (_.isEmpty(rules)) {
        return true;
    }

    return rules.every((rule) => {
        const trimmed = _.trim(rule);
        return _.isEmpty(trimmed)
            || ruleUtils.isComment(trimmed)
            || ruleUtils.isAdblockPlusHeader(trimmed);
    });
}

/**
 * Logs a warning that a source contains no rules.
 *
 * @param {ListSource} source - source configuration.
 */
function warnEmptySource(source) {
    consola.warn(`Source ${stripKnownUrlCredentials(source.source)} is empty and is skipped`);
}

/**
 * Compiles an individual source according to it's configuration.
 *
 * @param {ListSource} source - source configuration.
 * @returns {Promise<Array<string>>} array with the source rules
 */
async function compileSource(source) {
    consola.info(`Start compiling ${stripKnownUrlCredentials(source.source)}`);
    let rules = await download(source.source);
    consola.info(`Original length is ${rules.length}`);

    if (isEmptySource(rules)) {
        // The configuration schema rejects incompatible validations for the
        // public `compile()` API. Keep the runtime check here as well so a
        // direct `compileSource()` call does not bypass it on the early return.
        checkIncompatibleValidationTransformations(source.transformations || []);
        warnEmptySource(source);
        return [];
    }

    rules = await transform(rules, source, source.transformations);

    consola.info(`Length after applying transformations is ${rules.length}`);

    if (isEmptySource(rules)) {
        warnEmptySource(source);
        return [];
    }

    return rules;
}

module.exports = compileSource;
