const consola = require('consola');

/**
 * This is a very simple transformation that removes empty lines.
 *
 * @param {Array<string>} lines - lines to transform
 * @returns {Array<string>} filtered lines
 */
function removeEmptyLines(lines) {
    const filtered = lines.filter((line) => line.trim().length);
    consola.info(`Removed ${lines.length - filtered.length} empty lines`);
    return filtered;
}

module.exports = removeEmptyLines;
