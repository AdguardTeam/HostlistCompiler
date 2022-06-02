const consola = require('consola');

/**
 * This is a very simple transformation that inserts a final new line.
 *
 * @param {Array<string>} lines - lines/rules to transform
 * @returns {Array<string>} filtered lines/rules
 */
function insertFinalNewLine(lines) {
    if (lines.length === 0 || (lines.length > 0 && lines[lines.length - 1].trim() !== '')) {
        lines.push('');
    }
    consola.info('Final new line inserted');
    return lines;
}

module.exports = insertFinalNewLine;
