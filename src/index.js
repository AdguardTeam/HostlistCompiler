const _ = require('lodash');
const consola = require('consola');
const config = require('./configuration');
const compileSource = require('./compile-source');
const { transform } = require('./transformations/transform');
const { checkCrossLevelValidationConflicts } = require('./validation-conflicts');
const {
    stripUrlValueCredentials,
    stripKnownUrlCredentials,
    sanitizeConfigurationForLog,
} = require('./utils');
const packageJson = require('../package.json');

// Version is not stored in the repo: CI stamps it into package.json at build
// time (see publish-release.yml). Fall back to 0.0.0 in development.
const packageVersion = packageJson.version || '0.0.0';

/**
 * Prepares list header
 *
 * @param {*} configuration - compilation configuration.
 * See the repo README for the details on it.
 * @returns {Array<string>} header lines
 */
function prepareHeader(configuration) {
    const lines = [
        '!',
        `! Title: ${stripUrlValueCredentials(configuration.name)}`,
    ];

    if (!_.isEmpty(configuration.description)) {
        lines.push(`! Description: ${stripUrlValueCredentials(configuration.description)}`);
    }
    if (!_.isEmpty(configuration.version)) {
        lines.push(`! Version: ${stripUrlValueCredentials(configuration.version)}`);
    }
    if (!_.isEmpty(configuration.homepage)) {
        lines.push(`! Homepage: ${stripKnownUrlCredentials(configuration.homepage)}`);
    }
    if (!_.isEmpty(configuration.license)) {
        lines.push(`! License: ${stripUrlValueCredentials(configuration.license)}`);
    }

    lines.push(`! Last modified: ${(new Date()).toISOString()}`);
    lines.push('!');

    // Compiler info
    lines.push(`! Compiled by ${packageJson.name} v${packageVersion}`);
    lines.push('!');
    return lines;
}

/**
 * @typedef {import('./compile-source').ListSource} ListSource
 */

/**
 * Prepares source header lines
 *
 * @param {ListSource} source - source metadata
 * @returns {Array<String>} source header lines
 */
function prepareSourceHeader(source) {
    const lines = [
        '!',
    ];

    if (!_.isEmpty(source.name)) {
        lines.push(`! Source name: ${stripUrlValueCredentials(source.name)}`);
    }
    lines.push(`! Source: ${stripKnownUrlCredentials(source.source)}`);
    lines.push('!');
    return lines;
}

/**
 * Compiles a filter list using the specified configuration.
 *
 * @param {*} configuration - compilation configuration.
 * See the repo README for the details on it.
 * @returns {Promise<Array<string>>} the array of rules.
 */
async function compile(configuration) {
    consola.info('Starting the compiler');
    const ret = config.validateConfiguration(configuration);
    if (!ret.valid) {
        consola.info(ret.errorsText);
        throw new Error('Failed to validate configuration');
    }

    checkCrossLevelValidationConflicts(configuration);

    const configurationDump = JSON.stringify(sanitizeConfigurationForLog(configuration), 0, 4);
    consola.info(`Configuration: ${configurationDump}`);

    // These will be the final rules and the headers of the sources that
    // produced them. Source headers stay out of the rule stream so the
    // whole-list filters and transformations cannot remove them.
    let finalList = [];
    let sourceHeaders = [];

    // Now go through sources
    // eslint-disable-next-line no-restricted-syntax
    for (const source of configuration.sources) {
        // eslint-disable-next-line no-await-in-loop
        const sourceRules = await compileSource(source);

        if (sourceRules.length > 0) {
            sourceHeaders = sourceHeaders.concat(prepareSourceHeader(source));
            finalList = finalList.concat(sourceRules);
        }
    }

    // Now let's apply the final transformations to the list
    // Use empty list by default for transformations here
    const transformations = configuration.transformations || [];
    finalList = await transform(finalList, configuration, transformations);

    // Now prepend the list header and the source headers and we're good to go
    const header = prepareHeader(configuration);
    const fullList = header.concat(sourceHeaders, finalList);
    consola.info(`Final length of the list is ${fullList.length}`);
    return fullList;
}

module.exports = compile;
