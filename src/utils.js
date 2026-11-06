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
 * Modes for the authority parser.
 *
 * `VALUE` treats the text before the first `@` as userinfo only when it looks
 * like userinfo, so it does not mangle prose that contains an email address.
 * It also accepts userinfo when the URL has a path, query, or fragment, or when
 * the value is a whole URL. The path or value shape shows that the text is a
 * URL, not prose, so a quote or a space in the username does not hide the
 * password.
 *
 * `STRICT` treats everything before the last `@` as userinfo, exactly as the
 * downloader does. Use it only for values that must be a URL.
 */
const URL_AUTHORITY_MODE = {
    VALUE: 'value',
    STRICT: 'strict',
};

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
 * Checks whether the text before the first `@` in an authority contains a
 * port. A port looks like a password, so a URL followed by prose such as
 * `https://example.org:8080 by admin@example.com` must stay unchanged.
 *
 * @param {String} value - the authority text before the first `@`.
 * @returns {Boolean} true if the text contains a port followed by a terminator.
 */
function looksLikePort(value) {
    return /:\d+(?=[\s"'<>])/.test(value);
}

/**
 * Checks whether the text before the first `@` in an authority looks like
 * userinfo rather than prose that follows a URL. Prose can contain whitespace
 * and an email-like `@`, so a colon that starts a password is the signal.
 *
 * `user:p s s` is userinfo, and `https://example.org is maintained by
 * user@example.com` is prose. A colon that is followed by whitespace starts a
 * label in prose, not a password. A colon followed by digits and then a
 * terminator is a port, not a password.
 *
 * @param {String} value - the authority text before the first `@`.
 * @returns {Boolean} true if the text looks like userinfo.
 */
function looksLikeUserinfo(value) {
    const firstTerminator = value.search(URL_AUTHORITY_TERMINATOR_REGEX);

    if (firstTerminator === -1) {
        return true;
    }

    const colonIndex = value.indexOf(':');

    if (colonIndex === -1 || colonIndex > firstTerminator) {
        return false;
    }

    if (looksLikePort(value)) {
        return false;
    }

    return !/\s/.test(value[colonIndex + 1]);
}

/**
 * Checks whether a value without a path, query, or fragment is a URL with
 * userinfo rather than prose. The host must follow the first `@` without a
 * terminator, and the text before the `@` must contain a password colon with a
 * non-whitespace value after it. A password can start with a space when the
 * username has no space.
 *
 * This covers `https://o'brien:secret@example.org`,
 * `https://John Smith:secret@example.org`, and
 * `https://user: secret@example.org`. A password that starts with a space is
 * userinfo only when the username has no space, so prose such as
 * `https://example.org team: contact@example.com` stays unchanged.
 *
 * @param {String} text - the string being scanned.
 * @param {Number} start - index right after the URL prefix.
 * @param {Number} firstUserinfoEnd - index of the first `@`.
 * @param {Number} authorityEnd - index where the authority ends.
 * @returns {Boolean} true if the value looks like a URL with userinfo.
 */
function looksLikeValueUserinfo(text, start, firstUserinfoEnd, authorityEnd) {
    if (authorityEnd !== text.length) {
        return false;
    }

    // Prose after the URL starts a whitespace terminator after the first `@`.
    // A quote or an angle bracket after the host is a delimiter, for example
    // in `"https://host"` or `<https://host>`.
    let terminator = firstUserinfoEnd + 1;
    while (terminator < authorityEnd && !endsUrlAuthorityBeforeUserinfo(text[terminator])) {
        terminator += 1;
    }

    const terminatorIsDelimiter = terminator < authorityEnd && /["'<>]/.test(text[terminator]);

    if (terminator !== authorityEnd && !terminatorIsDelimiter) {
        return false;
    }

    const beforeFirstUserinfoEnd = text.slice(start, firstUserinfoEnd);
    const colonIndex = beforeFirstUserinfoEnd.indexOf(':');

    if (colonIndex === -1) {
        return false;
    }

    const rawAfterColon = beforeFirstUserinfoEnd.slice(colonIndex + 1);
    const afterColon = rawAfterColon.trimStart();

    if (afterColon.length === 0 || /\s/.test(afterColon)) {
        return false;
    }

    // A password that starts with a space is userinfo only when the username
    // has no space. Otherwise the value can be prose such as
    // `https://example.org team: contact@example.com`.
    if (rawAfterColon !== afterColon && /\s/.test(beforeFirstUserinfoEnd.slice(0, colonIndex))) {
        return false;
    }

    return true;
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
            // A single-letter scheme is a Windows drive letter in a local
            // path such as `C:/user@corp/list.txt`, not a URL. No registered
            // URL scheme is a single letter.
            const isWindowsDriveLetter = scheme.length === 1;

            // A scheme without slashes is only a URL for HTTP(S): the URL
            // parser normalizes `https:user:pass@host` to a URL with
            // authority. For other schemes, a colon is not enough to tell a
            // URL from text such as `note:value`. Backslashes are accepted
            // only for HTTP(S), so a Windows path such as `C:\dir` is not
            // treated as a URL.
            if (!isWindowsDriveLetter
                && ((slashCount > 0 && (isHttp || !hasBackslash)) || (slashCount === 0 && isHttp))) {
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
 * @param {String} [mode] - one of `URL_AUTHORITY_MODE`. Defaults to `VALUE`.
 * @returns {{ value: String, rawEnd: Number, urlEnd: Number }} the sanitized
 * authority, the index where it ends, and the index where the URL ends.
 */
function readUrlAuthority(text, start, mode = URL_AUTHORITY_MODE.VALUE) {
    let authorityEnd = start;

    while (authorityEnd < text.length && !endsUrlAuthority(text[authorityEnd])) {
        authorityEnd += 1;
    }

    let userinfoEnd = -1;

    if (mode === URL_AUTHORITY_MODE.STRICT) {
        // The downloader takes everything before the last `@` as userinfo.
        // Use this only for values that must be a URL, because prose after a
        // URL can also contain an `@`.
        userinfoEnd = text.lastIndexOf('@', authorityEnd - 1);

        if (userinfoEnd < start) {
            userinfoEnd = -1;
        }
    } else {
        // The first `@` shows where userinfo could end. `looksLikeUserinfo()`
        // rejects prose that follows a URL and contains an email address.
        let firstUserinfoEnd = -1;
        for (let i = start; i < authorityEnd; i += 1) {
            if (text[i] === '@') {
                firstUserinfoEnd = i;
                break;
            }
        }

        if (firstUserinfoEnd !== -1) {
            const beforeFirstUserinfoEnd = text.slice(start, firstUserinfoEnd);
            // A path, query, or fragment shows that the value is a URL, not
            // prose. In that case a quote or a space in the username does not
            // hide the password, unless the text contains a port and then
            // prose.
            const hasUrlTail = authorityEnd < text.length;
            const isValueUserinfo = mode === URL_AUTHORITY_MODE.VALUE
                && (hasUrlTail
                    ? !looksLikePort(beforeFirstUserinfoEnd)
                    : looksLikeValueUserinfo(text, start, firstUserinfoEnd, authorityEnd));
            const isUserinfo = looksLikeUserinfo(beforeFirstUserinfoEnd) || isValueUserinfo;

            if (isUserinfo) {
                // Userinfo can contain quote and whitespace characters, but
                // the host cannot. The separator is the last `@` before the
                // first terminator after the first `@`. This also keeps a
                // later email in prose such as `https://host and a@b` intact.
                let terminator = firstUserinfoEnd + 1;
                while (terminator < authorityEnd && !endsUrlAuthorityBeforeUserinfo(text[terminator])) {
                    terminator += 1;
                }
                userinfoEnd = text.lastIndexOf('@', terminator - 1);
            }
        }
    }

    const authorityStart = userinfoEnd === -1 ? start : userinfoEnd + 1;
    let rawEnd = authorityStart;

    while (rawEnd < authorityEnd && !endsUrlAuthorityBeforeUserinfo(text[rawEnd])) {
        rawEnd += 1;
    }

    const value = text.slice(authorityStart, rawEnd);

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
 * Removes the userinfo component from every URL in a string, using the given
 * authority parser mode.
 *
 * The function does string surgery on the authority component, so the rest of
 * the URL stays byte-identical. It does not parse and re-serialize the URL
 * with `URL`, because that normalizes the URL. It recognizes an optional
 * scheme followed by any number of slashes or backslashes, a scheme with no
 * slashes for HTTP(S), and scheme-relative URLs that start with two or more
 * slashes.
 *
 * @param {String} url - string that may contain URLs with credentials.
 * @param {String} mode - one of `URL_AUTHORITY_MODE`.
 * @returns {String} the string without the userinfo components, or the input
 * unchanged when it has no URL with userinfo.
 */
function stripUrlCredentialsWithMode(url, mode) {
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

        const authority = readUrlAuthority(url, prefixEnd, mode);
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
 * Removes the userinfo component (the `user:password@` part) from every URL in
 * a string. Use this for free text and for values of an unknown shape: the
 * function keeps prose that contains an email address unchanged.
 *
 * @param {String} url - string that may contain URLs with credentials.
 * @returns {String} the string without the userinfo components, or the input
 * unchanged when it has no URL with userinfo.
 */
function stripUrlCredentials(url) {
    return stripUrlCredentialsWithMode(url, URL_AUTHORITY_MODE.VALUE);
}

/**
 * Removes the userinfo component from every URL in a value that must be a URL,
 * such as `source` or `homepage`.
 *
 * Unlike `stripUrlCredentials()`, this function has no prose guard. It treats
 * everything before the last `@` in the authority as userinfo, exactly as the
 * downloader does. Use it for known URL values, where a quote or a space in
 * the username must not hide the password.
 *
 * @param {String} url - URL value.
 * @returns {String} the URL without the userinfo component, or the input
 * unchanged when it has no userinfo.
 */
function stripKnownUrlCredentials(url) {
    return stripUrlCredentialsWithMode(url, URL_AUTHORITY_MODE.STRICT);
}

/**
 * Removes the userinfo component from a string value whose shape is not known
 * in advance.
 *
 * The function first tries to parse the whole value as a URL. When the URL has
 * a path, query, or fragment, a quote or a space in the username does not hide
 * the password. A port followed by prose, such as
 * `https://example.org:8080 by admin@example.com`, stays unchanged.
 *
 * Leading whitespace is kept, so a value such as
 * ` https://user:password@example.org/` is sanitized without changing its
 * prefix. When the value does not start with a URL, or when the text before
 * the first `@` looks like prose, the function falls back to the scanner. The
 * scanner also covers any text after the first URL, so prefixed values such as
 * `See https://user:password@example.org/` are sanitized too.
 *
 * Use `stripKnownUrlCredentials()` for values that must be a URL, because that
 * function has no prose guard and strips exactly what the downloader treats as
 * userinfo.
 *
 * @param {String} url - string to sanitize.
 * @returns {String} the string without the userinfo component, or the input
 * unchanged when it has no userinfo.
 */
function stripUrlValueCredentials(url) {
    if (!_.isString(url)) {
        return url;
    }

    const valueStart = url.search(/\S/);
    if (valueStart === -1) {
        return url;
    }

    const start = readUrlStartAt(url, valueStart);
    if (start === null || start.prefixEnd === null) {
        return stripUrlCredentials(url);
    }

    const { prefixEnd } = start;
    const authority = readUrlAuthority(url, prefixEnd, URL_AUTHORITY_MODE.VALUE);

    const sanitized = url.slice(0, prefixEnd)
        + authority.value
        + url.slice(authority.rawEnd, authority.urlEnd)
        + url.slice(authority.urlEnd);

    // The value can have more text after the first URL. The scanner covers
    // later URLs and does not rescan a consumed path, query, or fragment.
    return stripUrlCredentials(sanitized);
}

/**
 * Replaces known raw values in a string and then removes URL credentials.
 *
 * The replacement runs first because a password can contain a literal `@`
 * followed by whitespace. The scanner uses the first `@` with a prose guard, so
 * it can leave the rest of such a password in the text. A caller that knows the
 * exact source URL can sanitize it with the strict parser before the scanner
 * runs.
 *
 * @param {String} value - the string to sanitize.
 * @param {Array<Array<String>>} replacements - pairs of a raw value and its
 * sanitized replacement.
 * @returns {String} the sanitized string.
 */
function sanitizeErrorString(value, replacements) {
    let result = value;

    replacements.forEach(([raw, sanitized]) => {
        if (_.isString(raw) && raw !== sanitized) {
            result = result.split(raw).join(sanitized);
        }
    });

    return stripUrlCredentials(result);
}

/**
 * Removes URL credentials from an error and its `cause` and `errors` chains.
 * The error is modified in place, so its type and stack location are
 * preserved.
 *
 * @param {*} error - the error to sanitize.
 * @param {Array<Array<String>>} [replacements] - pairs of a raw value and its
 * sanitized replacement, applied before the generic scan.
 * @param {WeakSet<Object>} [seen] - objects that have already been visited.
 * @returns {*} the sanitized error.
 */
function stripErrorCredentials(error, replacements = [], seen = new WeakSet()) {
    if (!_.isObject(error) || seen.has(error)) {
        return error;
    }
    seen.add(error);

    if (_.isString(error.message)) {
        Object.assign(error, { message: sanitizeErrorString(error.message, replacements) });
    }
    if (_.isString(error.stack)) {
        Object.assign(error, { stack: sanitizeErrorString(error.stack, replacements) });
    }
    if (_.isString(error.path)) {
        Object.assign(error, { path: sanitizeErrorString(error.path, replacements) });
    }

    if (Array.isArray(error.errors)) {
        Object.assign(error, {
            errors: error.errors.map((cause) => (
                _.isString(cause)
                    ? sanitizeErrorString(cause, replacements)
                    : stripErrorCredentials(cause, replacements, seen)
            )),
        });
    }

    if (_.isString(error.cause)) {
        Object.assign(error, { cause: sanitizeErrorString(error.cause, replacements) });
    } else {
        stripErrorCredentials(error.cause, replacements, seen);
    }

    return error;
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
 * Configuration fields that must contain a URL.
 */
const URL_VALUE_FIELDS = new Set([
    'homepage',
    'source',
]);

/**
 * Configuration fields that must contain a URL or a list of URLs.
 */
const URL_LIST_FIELDS = new Set([
    'sources',
    'exclusions_sources',
    'inclusions_sources',
]);

/**
 * Sanitizes a known URL field value or a list of URL field values with the
 * strict parser. Other values are left for the recursive walk.
 *
 * @param {*} value - field value.
 * @returns {*} sanitized field value.
 */
function sanitizeKnownUrlField(value) {
    if (_.isString(value)) {
        return stripKnownUrlCredentials(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => (
            _.isString(item) ? stripKnownUrlCredentials(item) : item
        ));
    }

    return value;
}

/**
 * Sanitizes known URL fields in place with the strict parser. The generic copy
 * uses a prose guard, so a quote or a space in the username of a `source` or
 * `homepage` value would survive it. The downloader treats such a value as
 * userinfo, so the strict parser runs on these fields.
 *
 * @param {*} value - configuration value to walk.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 */
function sanitizeKnownUrlFields(value, seen) {
    if (!_.isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
        if (URL_VALUE_FIELDS.has(key) || URL_LIST_FIELDS.has(key)) {
            Object.assign(value, { [key]: sanitizeKnownUrlField(child) });
        }

        sanitizeKnownUrlFields(value[key], seen);
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
    // Every string goes through the generic parser first: it keeps whitespace
    // and quotes in userinfo for URL values and falls back to the scanner for
    // prefixed values and values with more text after the URL.
    const sanitized = _.cloneDeepWith(configuration, (value) => (
        _.isString(value) ? stripUrlValueCredentials(value) : undefined
    ));

    // Known URL fields use the strict parser: the downloader treats a quote or
    // a space in the username as part of the userinfo.
    sanitizeKnownUrlFields(sanitized, new WeakSet());
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
    stripKnownUrlCredentials,
    stripConfigurationCredentials,
    stripErrorCredentials,
};
