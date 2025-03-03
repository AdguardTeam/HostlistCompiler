const _ = require('lodash');

/**
 * Extracts a substring between two tags.
 *
 * @param {String} str - original string
 * @param {String} startTag - start tag
 * @param {String} endTag - end tag
 * @returns {String|null} either a substring or null if it cannot be extracted
 */
function substringBetween(str, startTag, endTag) {
    if (!str) {
        return null;
    }

    const start = str.indexOf(startTag) + startTag.length;
    const end = str.indexOf(endTag, start);
    if (end > start && start !== -1) {
        return str.substring(start, end);
    }

    return null;
}

/**
 * Splits the string by the delimiter, ignoring escaped delimiters.
 *
 * @param {String} str - string to split
 * @param {String} delimiter - delimiter
 * @param {String} escapeCharacter - escape character
 * @param {Boolean} preserveAllTokens - if true, preserve empty parts
 * @return {Array<string>} array of string parts
 */
function splitByDelimiterWithEscapeCharacter(
    str,
    delimiter,
    escapeCharacter,
    preserveAllTokens,
) {
    const parts = [];

    if (!str) {
        return parts;
    }

    let sb = [];
    for (let i = 0; i < str.length; i += 1) {
        const c = str.charAt(i);
        if (c === delimiter) {
            if (i === 0) {
                // Ignore
            } else if (str.charAt(i - 1) === escapeCharacter) {
                sb.splice(sb.length - 1, 1);
                sb.push(c);
            } else if (preserveAllTokens || sb.length > 0) {
                const part = sb.join('');
                parts.push(part);
                sb = [];
            }
        } else {
            sb.push(c);
        }
    }

    if (preserveAllTokens || sb.length > 0) {
        parts.push(sb.join(''));
    }

    return parts;
}

/**
 * Wildcard is used by the exclusions transformation.
 */
class Wildcard {
    /**
     * Creates an instaance of a Wildcard.
     *
     * Depending on the constructor parameter its behavior may be different:
     * 1. By default, it just checks if "str" is included into the test string.
     * 2. If "str" contains any "*" character, it is used as a "wildcard"
     * 3. If "str" looks like "/regex/" , it is used as a full scale regular expression.
     *
     * @param {String} str plain string, wildcard string or regex string
     */
    constructor(str) {
        if (!str) {
            throw new TypeError('Wildcard cannot be empty');
        }

        /**
         * Regular expression representing this wildcard.
         * Can be null if the wildcard does not contain any special
         * characters.
         */
        this.regex = null;
        /**
         * Plain string. If it does not contain any special characters,
         * we will simply check if the test string contains it.
         */
        this.plainStr = str;

        if (str.startsWith('/') && str.endsWith('/') && str.length > 2) {
            const re = str.substring(1, str.length - 1);
            this.regex = new RegExp(re, 'mi');
        } else if (str.includes('*')) {
            // Creates a RegExp from the given string, converting asterisks to .* expressions,
            // and escaping all other characters.
            this.regex = new RegExp(`^${str.split(/\*+/).map(_.escapeRegExp).join('[\\s\\S]*')}$`, 'i');
        }
    }

    /**
     * Tests if the wildcard matches the specified string.
     *
     * @param {String} str string to test
     * @returns {Boolean} true if matches, otherwise - false
     */
    test(str) {
        if (typeof str !== 'string') {
            throw new TypeError('Invalid argument passed to Wildcard.test');
        }

        if (this.regex != null) {
            return this.regex.test(str);
        }

        return str.includes(this.plainStr);
    }

    /**
     * Wildcard string
     */
    toString() {
        return this.plainStr;
    }
}

module.exports = {
    Wildcard,
    splitByDelimiterWithEscapeCharacter,
    substringBetween,
};
