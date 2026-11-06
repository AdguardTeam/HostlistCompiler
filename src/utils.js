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
 * Sticky regex to match a URL scheme at the current position.
 */
const URL_SCHEME_REGEX = /[a-z][a-z0-9+.-]*:/iy;

/**
 * Sticky regex to match the slashes or backslashes that follow a URL scheme.
 */
const URL_SLASHES_REGEX = /[/\\]+/y;

/**
 * Regex to match a character that ends the authority component of a URL.
 */
const URL_AUTHORITY_END_REGEX = /[/\\?#]/;

/**
 * Regex to match a character that ends the authority component when it is not
 * part of userinfo. A quote or whitespace inside userinfo is part of the URL,
 * so the scanner decides whether it ends the URL or not.
 */
const URL_AUTHORITY_TERMINATOR_REGEX = /[\s"'<>]/;

/**
 * Regex to match a character that ends the path, query, or fragment of a URL.
 * A single quote is a valid path character, so it is not a terminator here.
 */
const URL_PATH_TERMINATOR_REGEX = /[\s"<>]/;

/**
 * Configuration keys whose values are URLs. The whole value is a URL, so the
 * aggressive single-value parser applies even when userinfo contains
 * whitespace or quotes.
 */
const URL_CONFIGURATION_KEYS = new Set([
    'source',
    'url',
    'homepage',
    'exclusions_sources',
    'inclusion_sources',
    'inclusions_sources',
    'exclusion_sources',
]);

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
 * Checks whether a URL scheme can start after the given character. A scheme
 * cannot start in the middle of a word or another URL, but it can start after
 * a slash, for example in a path such as `/https://example.org`.
 *
 * @param {String|undefined} char - the character before the scheme.
 * @returns {Boolean} true if a scheme can start after the character.
 */
function isSchemeBoundary(char) {
    return char === undefined || !/[a-z0-9_+.-]/i.test(char);
}

/**
 * Checks whether a scheme-relative URL (`//host`) can start after the given
 * character. A double slash inside a path is not a new URL, so the previous
 * character must not be a path or scheme character.
 *
 * @param {String|undefined} char - the character before the double slash.
 * @returns {Boolean} true if a scheme-relative URL can start after it.
 */
function isProtocolRelativeBoundary(char) {
    return char === undefined || !/[a-z0-9_+.:/\\-]/i.test(char);
}

/**
 * Checks whether the character ends the authority component of a URL.
 *
 * @param {String} char - character to check.
 * @returns {Boolean} true if the character ends the authority.
 */
function endsUrlAuthority(char) {
    return URL_AUTHORITY_END_REGEX.test(char);
}

/**
 * Checks whether the character ends the authority component when it is not
 * part of userinfo.
 *
 * @param {String} char - character to check.
 * @returns {Boolean} true if the character ends the authority.
 */
function endsUrlAuthorityBeforeUserinfo(char) {
    return URL_AUTHORITY_TERMINATOR_REGEX.test(char);
}

/**
 * Checks whether the character ends the path, query, or fragment of a URL.
 *
 * @param {String} char - character to check.
 * @returns {Boolean} true if the character ends the path.
 */
function endsUrlPath(char) {
    return URL_PATH_TERMINATOR_REGEX.test(char);
}

/**
 * Checks whether the authority terminator at the given position belongs to
 * userinfo. The downloader accepts quotes and whitespace in userinfo, so a
 * terminator is part of the URL when an `@` follows before the next
 * terminator or authority delimiter.
 *
 * @param {String} text - the string being scanned.
 * @param {Number} index - index of the terminator.
 * @returns {Boolean} true if an `@` follows before the authority ends.
 */
function hasUserinfoSeparator(text, index) {
    for (let i = index + 1; i < text.length; i += 1) {
        const char = text[i];

        if (char === '@') {
            return true;
        }
        if (endsUrlAuthority(char) || endsUrlAuthorityBeforeUserinfo(char)) {
            return false;
        }
    }

    return false;
}

/**
 * Reads a URL start at the given position.
 *
 * @param {String} text - the string to scan.
 * @param {Number} index - position to check.
 * @returns {{ prefixEnd: Number|null, nextIndex: Number }|null} the index
 * after the URL prefix, the index to resume scanning from when the position
 * starts a scheme that is not a URL, or null when no URL starts here.
 */
function readUrlStartAt(text, index) {
    const previousChar = index > 0 ? text[index - 1] : undefined;

    if (isSchemeBoundary(previousChar)) {
        URL_SCHEME_REGEX.lastIndex = index;
        const schemeMatch = URL_SCHEME_REGEX.exec(text);

        if (schemeMatch) {
            const schemeEnd = index + schemeMatch[0].length;
            URL_SLASHES_REGEX.lastIndex = schemeEnd;
            const slashesMatch = URL_SLASHES_REGEX.exec(text);
            const slashes = slashesMatch ? slashesMatch[0] : '';
            const slashCount = slashes.length;
            const scheme = schemeMatch[0].slice(0, -1).toLowerCase();
            const isHttp = scheme === 'http' || scheme === 'https';
            const hasBackslash = slashes.includes('\\');

            // A scheme without slashes is only a URL for HTTP(S): the URL
            // parser normalizes `https:user:pass@host` to a URL with
            // authority. For other schemes, a colon is not enough to tell a
            // URL from text such as `note:value`. Backslashes are accepted
            // only for HTTP(S), so a Windows path such as `C:\dir` is not
            // treated as a URL.
            if ((slashCount > 0 && (isHttp || !hasBackslash)) || (slashCount === 0 && isHttp)) {
                return { prefixEnd: schemeEnd + slashCount, nextIndex: schemeEnd + slashCount };
            }

            return { prefixEnd: null, nextIndex: schemeEnd };
        }
    }

    if (text[index] === '/' && text[index + 1] === '/') {
        let end = index + 2;
        while (text[end] === '/') {
            end += 1;
        }

        if (isProtocolRelativeBoundary(previousChar)) {
            return { prefixEnd: end, nextIndex: end };
        }

        return { prefixEnd: null, nextIndex: end };
    }

    return null;
}

/**
 * Finds the next URL start in a string and returns the index right after its
 * scheme and slashes.
 *
 * @param {String} text - the string to scan.
 * @param {Number} from - index to start scanning from.
 * @returns {Number|null} the index after the URL prefix, or null if there is
 * no URL start.
 */
function findUrlStart(text, from) {
    let i = from;

    while (i < text.length) {
        const start = readUrlStartAt(text, i);

        if (start === null) {
            i += 1;
        } else if (start.prefixEnd === null) {
            i = start.nextIndex;
        } else {
            return start.prefixEnd;
        }
    }

    return null;
}

/**
 * Reads the authority component of a URL and splits it into the sanitized
 * value and the end of the URL.
 *
 * @param {String} text - the string being scanned.
 * @param {Number} start - index right after the URL prefix.
 * @returns {{ value: String, rawEnd: Number, urlEnd: Number }} the sanitized
 * authority, the index where it ends, and the index where the URL ends.
 */
function readUrlAuthority(text, start) {
    let index = start;
    let hasUserinfo = false;

    while (index < text.length) {
        const char = text[index];

        if (endsUrlAuthority(char)) {
            break;
        }

        if (char === '@') {
            hasUserinfo = true;
            index += 1;
        } else if (endsUrlAuthorityBeforeUserinfo(char)) {
            if (!hasUserinfo && hasUserinfoSeparator(text, index)) {
                index += 1;
            } else {
                break;
            }
        } else {
            index += 1;
        }
    }

    const rawEnd = index;
    const rawAuthority = text.slice(start, rawEnd);
    const userinfoEnd = rawAuthority.lastIndexOf('@');
    const value = userinfoEnd === -1
        ? rawAuthority
        : rawAuthority.slice(userinfoEnd + 1);

    let urlEnd = rawEnd;
    if (rawEnd < text.length && endsUrlAuthority(text[rawEnd])) {
        urlEnd += 1;
        while (urlEnd < text.length && !endsUrlPath(text[urlEnd])) {
            urlEnd += 1;
        }
    }

    return { value, rawEnd, urlEnd };
}

/**
 * Removes the userinfo component (the `user:password@` part) from every URL in
 * a string.
 *
 * The function does string surgery on the authority component, so the rest of
 * the URL stays byte-identical. It does not parse and re-serialize the URL
 * with `URL`, because that normalizes the URL. It recognizes an optional
 * scheme followed by any number of slashes or backslashes, a scheme with no
 * slashes for HTTP(S), and scheme-relative URLs that start with two or more
 * slashes.
 *
 * @param {String} url - string that may contain URLs with credentials.
 * @returns {String} the string without the userinfo components, or the input
 * unchanged when it has no URL with userinfo.
 */
function stripUrlCredentials(url) {
    if (!_.isString(url)) {
        return url;
    }

    let result = '';
    let copiedUntil = 0;
    let searchFrom = 0;

    while (searchFrom < url.length) {
        const prefixEnd = findUrlStart(url, searchFrom);

        if (prefixEnd === null) {
            break;
        }

        const authority = readUrlAuthority(url, prefixEnd);
        result += url.slice(copiedUntil, prefixEnd);
        result += authority.value;
        result += url.slice(authority.rawEnd, authority.urlEnd);
        copiedUntil = authority.urlEnd;
        searchFrom = authority.urlEnd;
    }

    result += url.slice(copiedUntil);
    return result;
}

/**
 * Removes the userinfo component from a single URL value.
 *
 * Unlike `stripUrlCredentials()`, this function treats the whole string as a
 * URL, so the authority ends only at `/`, `\`, `?`, or `#`, exactly as in the
 * downloader. It accepts whitespace and quotes inside userinfo, so use it for
 * known URL values such as `source` and `homepage`, not for arbitrary text.
 *
 * @param {String} url - URL value.
 * @returns {String} the URL without the userinfo component, or the input
 * unchanged when it has no userinfo.
 */
function stripUrlValueCredentials(url) {
    if (!_.isString(url)) {
        return url;
    }

    const start = readUrlStartAt(url, 0);
    if (start === null || start.prefixEnd === null) {
        return url;
    }

    const { prefixEnd } = start;
    let authorityEnd = prefixEnd;

    while (authorityEnd < url.length && !endsUrlAuthority(url[authorityEnd])) {
        authorityEnd += 1;
    }

    const authority = url.slice(prefixEnd, authorityEnd);
    const userinfoEnd = authority.lastIndexOf('@');

    if (userinfoEnd === -1) {
        return url;
    }

    return url.slice(0, prefixEnd)
        + authority.slice(userinfoEnd + 1)
        + url.slice(authorityEnd);
}

/**
 * Removes URL credentials from an error and its `cause` and `errors` chains.
 * The error is modified in place, so its type and stack location are
 * preserved.
 *
 * @param {*} error - the error to sanitize.
 * @param {WeakSet<Object>} [seen] - objects that have already been visited.
 * @returns {*} the sanitized error.
 */
function stripErrorCredentials(error, seen = new WeakSet()) {
    if (!_.isObject(error) || seen.has(error)) {
        return error;
    }
    seen.add(error);

    if (_.isString(error.message)) {
        Object.assign(error, { message: stripUrlCredentials(error.message) });
    }
    if (_.isString(error.stack)) {
        Object.assign(error, { stack: stripUrlCredentials(error.stack) });
    }
    if (_.isString(error.path)) {
        Object.assign(error, { path: stripUrlCredentials(error.path) });
    }

    if (Array.isArray(error.errors)) {
        Object.assign(error, {
            errors: error.errors.map((cause) => (
                _.isString(cause)
                    ? stripUrlCredentials(cause)
                    : stripErrorCredentials(cause, seen)
            )),
        });
    }

    if (_.isString(error.cause)) {
        Object.assign(error, { cause: stripUrlCredentials(error.cause) });
    } else {
        stripErrorCredentials(error.cause, seen);
    }

    return error;
}

/**
 * Sanitizes a known URL value, including arrays of URLs.
 *
 * @param {*} value - URL value or an array of URL values.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 * @returns {*} sanitized value.
 */
function sanitizeKnownUrlValue(value, seen) {
    if (_.isString(value)) {
        return stripUrlValueCredentials(value);
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            return value;
        }
        seen.add(value);

        return value.map((item) => sanitizeKnownUrlValue(item, seen));
    }

    return value;
}

/**
 * Sanitizes the values of known URL configuration keys in place.
 *
 * @param {*} value - configuration value to walk.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 */
function sanitizeKnownUrlValues(value, seen) {
    if (!_.isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
        let sanitizedChild = child;

        if (URL_CONFIGURATION_KEYS.has(key)) {
            sanitizedChild = sanitizeKnownUrlValue(child, seen);
            Object.assign(value, { [key]: sanitizedChild });
        }

        sanitizeKnownUrlValues(sanitizedChild, seen);
    });
}

/**
 * Sanitizes URL-like object keys in place, because `cloneDeepWith` visits
 * values only.
 *
 * @param {*} value - configuration value to walk.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 */
function sanitizeConfigurationKeys(value, seen) {
    if (!_.isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
        const sanitizedKey = stripUrlValueCredentials(key);

        if (sanitizedKey !== key) {
            Reflect.deleteProperty(value, key);
            Object.defineProperty(value, sanitizedKey, {
                value: child,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }

        sanitizeConfigurationKeys(child, seen);
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
    const sanitized = _.cloneDeepWith(configuration, (value) => (
        _.isString(value) ? stripUrlCredentials(value) : undefined
    ));

    sanitizeKnownUrlValues(sanitized, new WeakSet());
    sanitizeConfigurationKeys(sanitized, new WeakSet());

    return sanitized;
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
    stripUrlValueCredentials,
    stripConfigurationCredentials,
    stripErrorCredentials,
};
