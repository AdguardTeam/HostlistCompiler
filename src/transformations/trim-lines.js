const consola = require('consola');

/**
 * This is a very simple transformation that removes leading and trailing spaces/tabs.
 *
 * @param {Array<string>} lines - lines/rules to transform
 * @returns {Array<string>} filtered lines/rules
 */
function trimLines(lines) {
    const transformed = lines.map((line) => line.replace(/^[ \t]+|[ \t]+$/g, ''));
    consola.info('Lines trimmed.');
    return transformed;
}

module.exports = trimLines;
