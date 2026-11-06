const _ = require('lodash');

// Prefix for canonical IP/domain patterns
const IP_PREFIX = '||';

/**
 * Regex that matches strings that look like adblock rule modifiers
 * Used to distinguish a real `$modifier` suffix from a `$` that is
 * part of a regex anchor.
 */
const MODIFIER_REGEX = /^[a-zA-Z0-9,=~_.-]+$/;

/**
 * Regex to match a valid IPv4 octet (0-255).
 */
const OCTET_REGEX = /^\d{1,3}$/;

/**
 * Regex to find URL-like parts in a string. It matches an optional scheme
 * followed by one or more slashes, or a scheme-relative URL with two or more
 * slashes. The capture group holds the authority component, which stops at
 * the path, query, fragment, or whitespace.
 */
const URL_AUTHORITY_REGEX = /(?:[a-z][a-z0-9+.-]*:\/+|\/{2,})([^/\\?#\s<>"']*)/gi;

/**
 * Checks if a string is a valid IPv4 octet (0-255).
 *
 * @param {string} s - The string to check.
 * @returns {boolean} True if valid octet.
 */
function isValidOctet(s) {
    if (!OCTET_REGEX.test(s)) {
        return false;
    }
    const num = Number(s);
    return num >= 0 && num <= 255;
}

/**
 * Parses an IP-like adblock pattern and extracts its structural components.
 * Expects a pattern already stripped of @@ prefix and $modifier suffix
 * (as returned by parseRuleTokens in rule.js).
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {{ prefix: string, octets: string[],
 *             hasTrailingDot: boolean, hasTrailingWildcard: boolean,
 *             hasCaret: boolean, hasCaretPipe: boolean }|null}
 *   Parsed components, or null if the pattern is not a valid IP pattern.
 */
function parseIpPattern(pattern) {
    let remaining = pattern;
    let prefix = '';

    // Extract prefix
    if (remaining.startsWith(IP_PREFIX)) {
        prefix = IP_PREFIX;
        remaining = remaining.slice(2);
    } else if (remaining.startsWith('|')) {
        prefix = '|';
        remaining = remaining.slice(1);
    }

    // Check for ^| or ^ suffix
    let hasCaret = false;
    let hasCaretPipe = false;
    if (remaining.endsWith('^|')) {
        hasCaretPipe = true;
        hasCaret = true;
        remaining = remaining.slice(0, -2);
    } else if (remaining.endsWith('^')) {
        hasCaret = true;
        remaining = remaining.slice(0, -1);
    }

    // Check for trailing wildcard (.*)
    let hasTrailingWildcard = false;
    if (remaining.endsWith('.*')) {
        hasTrailingWildcard = true;
        remaining = remaining.slice(0, -2);
    }

    // Check for trailing dot
    let hasTrailingDot = false;
    if (remaining.endsWith('.')) {
        hasTrailingDot = true;
        remaining = remaining.slice(0, -1);
    }

    // Split into octets
    const parts = remaining.split('.');
    if (parts.length === 0 || parts.length > 4) {
        return null;
    }

    // All parts must be valid octets
    if (!parts.every(isValidOctet)) {
        return null;
    }

    return {
        prefix,
        octets: parts,
        hasTrailingDot,
        hasTrailingWildcard,
        hasCaret,
        hasCaretPipe,
    };
}

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
 * Removes the userinfo component (the `user:password@` part) from every URL in
 * a string.
 *
 * The function does string surgery on the authority component, so the rest of
 * the URL stays byte-identical. It does not parse and re-serialize the URL
 * with `URL`, because that normalizes the URL. It recognizes an optional
 * scheme followed by one or more slashes and scheme-relative URLs that start
 * with two or more slashes.
 *
 * @param {String} url - string that may contain URLs with credentials.
 * @returns {String} the string without the userinfo components, or the input
 * unchanged when it has no URL with userinfo.
 */
function stripUrlCredentials(url) {
    if (!_.isString(url)) {
        return url;
    }

    return url.replace(URL_AUTHORITY_REGEX, (match, authority) => {
        const userinfoEnd = authority.lastIndexOf('@');

        if (userinfoEnd === -1) {
            return match;
        }

        const prefix = match.slice(0, match.length - authority.length);
        return prefix + authority.slice(userinfoEnd + 1);
    });
}

/**
 * Returns a deep copy of a configuration with credentials removed from every
 * string, including strings in malformed configurations and class instances.
 * The original configuration is not modified.
 *
 * @param {*} configuration - compilation configuration.
 * @returns {*} sanitized copy of the configuration.
 */
function stripConfigurationCredentials(configuration) {
    return _.cloneDeepWith(configuration, (value) => (
        _.isString(value) ? stripUrlCredentials(value) : undefined
    ));
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

/**
 * Classifies an IP-like adblock pattern into categories used by validators and normalizers.
 * Returns null when the pattern cannot be parsed as an IP-like pattern.
 *
 * @param {string} pattern - The adblock pattern to classify.
 * @returns {{ prefix: string, octets: string[],
 *             hasTrailingDot: boolean, hasTrailingWildcard: boolean,
 *             hasCaret: boolean, hasCaretPipe: boolean,
 *             octetCount: number, isFullIp: boolean,
 *             isSubnetWildcard: boolean, isAmbiguous3Octet: boolean,
 *             isTooWide: boolean }|null}
 */
function classifyIpPattern(pattern) {
    const parsed = parseIpPattern(pattern);
    if (!parsed) {
        return null;
    }

    return {
        ...parsed,
        octetCount: parsed.octets.length,
        isFullIp: parsed.octets.length === 4
            && !parsed.hasTrailingDot
            && !parsed.hasTrailingWildcard,
        isSubnetWildcard: parsed.octets.length < 4
            && (parsed.hasTrailingDot || parsed.hasTrailingWildcard),
        isAmbiguous3Octet: parsed.octets.length === 3
            && !parsed.hasTrailingDot
            && !parsed.hasTrailingWildcard
            && !parsed.hasCaret,
        isTooWide: parsed.octets.length <= 2,
    };
}

module.exports = {
    MODIFIER_REGEX,
    parseIpPattern,
    classifyIpPattern,
    Wildcard,
    splitByDelimiterWithEscapeCharacter,
    substringBetween,
    stripUrlCredentials,
    stripConfigurationCredentials,
};
