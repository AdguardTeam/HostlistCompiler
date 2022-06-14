const consola = require('consola');
const _ = require('lodash');

/**
 * This is a very simple transformation that removes leading and trailing spaces/tabs.
 *
 * @param {Array<string>} lines - lines/rules to transform
 * @returns {Array<string>} filtered lines/rules
 */
function trimLines(lines) {
    const transformed = lines.map((line) => _.trim(line, ' \t'));
    consola.info('Lines trimmed.');
    return transformed;
}

module.exports = trimLines;
