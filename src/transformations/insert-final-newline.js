const consola = require('consola');

/**
 * This is a very simple transformation that inserts a final newline.
 *
 * @param {Array<string>} lines - lines to transform
 * @returns {Array<string>} filtered lines
 */
function insertFinalNewLine(lines) {
    if (lines.length === 0 || (lines.length > 0 && lines[lines.length - 1].trim() !== '')) {
        lines.push('');
        consola.info('Final newline inserted');
    }
    return lines;
}

module.exports = insertFinalNewLine;
