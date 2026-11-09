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
 * Regex to match a `token:digits` pair that can be a port in the authority
 * text before the first `@`. The lookahead accepts a terminator or punctuation
 * after the digits. A bracketed IPv6 literal is matched as one token.
 *
 * The lookbehind requires the token to start at a boundary. Without it, the
 * regex retries from every position inside a long token, for example a long
 * password, and the scan becomes quadratic.
 */
const URL_PORT_REGEX = /(?<![^\s"'<>/:])(?:\[[0-9a-f:.]+\]|[^\s"'<>/:]+):\d+(?=[\s"'<>,.;:!?()[\]{}])/gi;

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
 * Checks whether a token looks like a host: a dotted name, `localhost`, or an
 * IP literal. The port heuristic uses this to tell a port from a password.
 *
 * @param {String} value - token before a colon.
 * @returns {Boolean} true if the token looks like a host.
 */
function looksLikeHost(value) {
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1);
        return inner.includes(':') && /^[0-9a-f:.]+$/i.test(inner);
    }

    if (value.toLowerCase() === 'localhost') {
        return true;
    }

    const octets = value.split('.');
    if (octets.length === 4 && octets.every(isValidOctet)) {
        return true;
    }

    return /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(value);
}

/**
 * Checks whether the text before the first `@` in an authority contains a
 * port. A port looks like a password, so a URL followed by prose such as
 * `https://example.org:8080 by admin@example.com` must stay unchanged. The
 * port can be followed by a terminator or by punctuation, and the text before
 * the colon must look like a host. Otherwise a numeric password followed by
 * punctuation, such as `https://user:1234, secret@example.org`, would be
 * mistaken for a port.
 *
 * @param {String} value - the authority text before the first `@`.
 * @returns {Boolean} true if the text contains a port followed by a terminator
 * or punctuation.
 */
function looksLikePort(value) {
    const ports = value.match(URL_PORT_REGEX) || [];

    return ports.some((port) => looksLikeHost(port.slice(0, port.lastIndexOf(':'))));
}

/**
 * Finds the colon that can start a password in the authority text before the
 * first `@`. A colon inside a bracketed IPv6 literal is part of the host, not
 * a password.
 *
 * @param {String} value - the authority text before the first `@`.
 * @returns {Number} the index of the password colon, or -1.
 */
function indexOfPasswordColon(value) {
    let inBrackets = false;

    for (let i = 0; i < value.length; i += 1) {
        const char = value[i];

        if (char === '[') {
            inBrackets = true;
        } else if (char === ']') {
            inBrackets = false;
        } else if (char === ':' && !inBrackets) {
            return i;
        }
    }

    return -1;
}

/**
 * Checks whether the text before the first `@` in an authority looks like
 * userinfo rather than prose that follows a URL. Prose can contain whitespace
 * and an email-like `@`, so a colon that starts a password is the signal.
 *
 * `user:p s s` is userinfo, and `https://example.org is maintained by
 * user@example.com` is prose. A colon that is followed by whitespace starts a
 * label in prose, not a password. A colon followed by digits and then a
 * terminator or punctuation is a port, not a password.
 *
 * @param {String} value - the authority text before the first `@`.
 * @returns {Boolean} true if the text looks like userinfo.
 */
function looksLikeUserinfo(value) {
    const firstTerminator = value.search(URL_AUTHORITY_TERMINATOR_REGEX);

    if (firstTerminator === -1) {
        return true;
    }

    const colonIndex = indexOfPasswordColon(value);

    if (colonIndex === -1 || colonIndex > firstTerminator) {
        return false;
    }

    if (looksLikePort(value)) {
        return false;
    }

    return !/\s/.test(value[colonIndex + 1]);
}

/**
 * Checks whether the text before the first `@` is a URL with userinfo rather
 * than prose. The text must contain a password colon with a non-whitespace
 * value after it. A port, a label that starts with whitespace, and a host-like
 * first word followed by a label are prose. A URL can be followed by prose, so
 * a terminator after the host does not make the text before the `@` prose.
 *
 * This covers `https://o'brien:secret@example.org`,
 * `https://John Smith:secret@example.org`,
 * `https://user: secret@example.org`, and the same values followed by text
 * such as `https://John Smith:secret@example.org by admin@example.com`. A
 * password that starts with a space is userinfo only when the username does
 * not start with a host, so prose such as
 * `https://example.org team: contact@example.com` stays unchanged.
 *
 * @param {String} text - the string being scanned.
 * @param {Number} start - index right after the URL prefix.
 * @param {Number} firstUserinfoEnd - index of the first `@`.
 * @returns {Boolean} true if the text looks like a URL with userinfo.
 */
function looksLikeValueUserinfo(text, start, firstUserinfoEnd) {
    const beforeFirstUserinfoEnd = text.slice(start, firstUserinfoEnd);
    const colonIndex = indexOfPasswordColon(beforeFirstUserinfoEnd);

    if (colonIndex === -1) {
        return false;
    }

    const rawAfterColon = beforeFirstUserinfoEnd.slice(colonIndex + 1);
    const afterColon = rawAfterColon.trimStart();

    if (afterColon.length === 0 || /\s/.test(afterColon)) {
        return false;
    }

    if (looksLikePort(beforeFirstUserinfoEnd)) {
        return false;
    }

    // A password that starts with a space is userinfo only when the text
    // before the colon does not start with a host. Otherwise the value can be
    // prose such as `https://example.org team: contact@example.com` or
    // `Filter list for Corp. Homepage: https://example.org. Contact:
    // admin@example.com`. A username such as `John Smith` does not start with a
    // host, so `https://John Smith: secret@example.org` is userinfo. The host
    // can be followed by punctuation, for example at the end of a sentence. A
    // single-label host such as `fileserver` is prose only when punctuation
    // follows it, because a single label can also be a username.
    const beforeColon = beforeFirstUserinfoEnd.slice(0, colonIndex);
    const firstWordMatch = beforeColon.trim().split(/\s+/, 1)[0];
    // Keep a bracketed IPv6 literal intact: its closing `]` is part of the
    // host, not trailing punctuation.
    const bracketedHostEnd = firstWordMatch.startsWith('[') ? firstWordMatch.indexOf(']') : -1;
    const firstWord = bracketedHostEnd === -1
        ? firstWordMatch.replace(/[.,;!?)\]}]+$/, '')
        : firstWordMatch.slice(0, bracketedHostEnd + 1);
    const firstWordHadPunctuation = firstWord !== firstWordMatch;
    const looksLikeProseHost = looksLikeHost(firstWord)
        || (firstWordHadPunctuation && /^[a-z0-9-]+$/i.test(firstWord));

    if (rawAfterColon !== afterColon
        && /\s/.test(beforeColon)
        && looksLikeProseHost) {
        return false;
    }

    // Prose after the URL starts a terminator after the first `@`. The text
    // between the first `@` and that terminator must not contain another `@`:
    // a second `@` means the first one was not the end of the userinfo. This
    // keeps a rendered document such as
    // `{"homepage":"https://example.org","exclusions":["@@||good.example^"]}`
    // unchanged.
    let terminator = firstUserinfoEnd + 1;
    while (terminator < text.length && !endsUrlAuthorityBeforeUserinfo(text[terminator])) {
        terminator += 1;
    }

    if (terminator < text.length) {
        const host = text.slice(firstUserinfoEnd + 1, terminator);

        if (host.length === 0 || host.includes('@')) {
            return false;
        }
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
 * @returns {{ value: String, rawEnd: Number }} the sanitized authority and the
 * index where it ends.
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
            // prose. The tail counts only when the host after the first `@`
            // runs straight into the path, query, or fragment. Otherwise a
            // slash later in the text would make prose look like userinfo.
            const hostMatch = /^[^\s"'<>]*/.exec(text.slice(firstUserinfoEnd + 1, authorityEnd))[0];
            const hostEnd = firstUserinfoEnd + 1 + hostMatch.length;
            const hasUrlTail = authorityEnd < text.length
                && (hostEnd === authorityEnd
                    || (/["'<>]/.test(text[hostEnd]) && !/[\s"]/.test(beforeFirstUserinfoEnd)));
            const isValueUserinfo = mode === URL_AUTHORITY_MODE.VALUE
                && (hasUrlTail
                    ? !looksLikePort(beforeFirstUserinfoEnd)
                    : looksLikeValueUserinfo(text, start, firstUserinfoEnd));
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

    return { value, rawEnd };
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
        // Resume the scan at the end of the authority, not at the end of the
        // URL. A URL can sit inside the path, query, or fragment of another
        // URL, for example a proxy URL with the target in its query. The rest
        // of the outer URL is copied by the next iteration or by the final
        // slice, so nested credentials are not copied verbatim.
        copiedUntil = authority.rawEnd;
        searchFrom = authority.rawEnd;
    }

    result += url.slice(copiedUntil);
    return result;
}

/**
 * Removes the userinfo component (the `user:password@` part) from every URL in
 * a string. Use this for free text and for values of an unknown shape: the
 * function keeps prose that contains an email address unchanged.
 *
 * Do not scan a rendered document with this function, for example
 * `JSON.stringify(configuration)`. A path-less URL can make the text up to a
 * later `@` look like userinfo and corrupt the document. Use
 * `sanitizeConfigurationForLog()` for a configuration dump or a validation
 * error.
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
        + url.slice(authority.rawEnd);

    // The value can have more text after the first URL, and the first URL can
    // contain another URL in its path, query, or fragment. The scanner covers
    // both.
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
 * Configuration keys allowed at the root level.
 */
const CONFIGURATION_KEYS = new Set([
    'name',
    'description',
    'homepage',
    'license',
    'version',
    'sources',
    'transformations',
    'exclusions',
    'exclusions_sources',
    'inclusions',
    'inclusions_sources',
]);

/**
 * Configuration keys allowed in a source object.
 */
const SOURCE_KEYS = new Set([
    'name',
    'source',
    'type',
    'transformations',
    'exclusions',
    'exclusions_sources',
    'inclusions',
    'inclusions_sources',
]);

/**
 * Sanitizes every string under a value with the strict parser. Unknown
 * configuration keys are rejected by the schema, so their values are more
 * likely misplaced URLs than prose.
 *
 * @param {*} value - value under an unknown key.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 * @returns {*} sanitized value.
 */
function sanitizeUnknownValue(value, seen) {
    if (_.isString(value)) {
        return stripKnownUrlCredentials(value);
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            Object.assign(value, { [index]: sanitizeUnknownValue(item, seen) });
        });
        return value;
    }

    if (_.isObject(value) && !seen.has(value)) {
        seen.add(value);
        Object.entries(value).forEach(([key, child]) => {
            Object.assign(value, { [key]: sanitizeUnknownValue(child, seen) });
        });
    }

    return value;
}

/**
 * Applies the strict parser to strings under keys that the configuration
 * schema does not allow at the current level.
 *
 * @param {*} value - configuration value to walk.
 * @param {Set<String>} allowedKeys - keys allowed at this level.
 * @param {WeakSet<Object>} seen - objects that have already been visited.
 */
function sanitizeUnknownKeyValues(value, allowedKeys, seen) {
    if (Array.isArray(value)) {
        value.forEach((item) => sanitizeUnknownKeyValues(item, allowedKeys, seen));
        return;
    }

    if (!_.isObject(value) || seen.has(value)) {
        return;
    }
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
        if (!allowedKeys.has(key)) {
            Object.assign(value, { [key]: sanitizeUnknownValue(child, seen) });
            return;
        }

        if (key === 'sources') {
            if (Array.isArray(child)) {
                child.forEach((item) => sanitizeUnknownKeyValues(item, SOURCE_KEYS, seen));
            } else if (_.isObject(child)) {
                sanitizeUnknownKeyValues(child, SOURCE_KEYS, seen);
            }
            return;
        }

        if (Array.isArray(child)) {
            child.forEach((item) => sanitizeUnknownKeyValues(item, allowedKeys, seen));
        } else {
            sanitizeUnknownKeyValues(child, allowedKeys, seen);
        }
    });
}

/**
 * Returns a deep copy of a configuration with credentials removed from every
 * string, including strings in malformed configurations and class instances.
 * The copy runs the generic parser on every string, the strict parser on known
 * URL fields and on values under unknown keys, and rewrites URL-like object
 * keys. The original configuration is not modified.
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
    // The schema rejects unknown keys, so a value under such a key is more
    // likely a misplaced URL than prose.
    sanitizeUnknownKeyValues(sanitized, CONFIGURATION_KEYS, new WeakSet());
    sanitizeConfigurationKeys(sanitized, new WeakSet());

    return sanitized;
}

/**
 * Returns a JSON-safe copy of a configuration with credentials removed from
 * every string and object key. Use the copy for the configuration log, the
 * verbose CLI dump, and validation errors that render the configuration.
 *
 * `stripConfigurationCredentials()` works on the object graph, so it cannot see
 * the strings that a `toJSON()` method or a `URL` object renders, and
 * `JSON.stringify()` renders object keys without passing them to a replacer.
 * This function serializes the sanitized copy with a replacer, parses the
 * result back into plain data, and sanitizes the parsed copy too. The output is
 * plain JSON data, so a caller can render it without a second scan of the
 * whole document. A second scan would treat the text between a path-less URL
 * and a later `@` as userinfo and corrupt the document.
 *
 * @param {*} configuration - compilation configuration.
 * @returns {*} JSON-safe sanitized copy of the configuration.
 */
function sanitizeConfigurationForLog(configuration) {
    const sanitized = stripConfigurationCredentials(configuration);
    // A replacer sees each rendered string after `toJSON()`, so it also covers
    // `URL` objects and class instances. Object keys do not reach the replacer.
    const json = JSON.stringify(sanitized, (key, value) => (
        _.isString(value) ? stripUrlValueCredentials(value) : value
    ));

    if (json === undefined) {
        return sanitized;
    }

    // The parsed copy is plain data. Run the sanitizer again to reach keys and
    // known URL fields that `toJSON()` introduced.
    return stripConfigurationCredentials(JSON.parse(json));
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
    sanitizeConfigurationForLog,
    stripErrorCredentials,
    // Exported so a test can pin them to the configuration schema. A key added
    // to the schema without a matching update here would silently change which
    // strings use the strict parser.
    URL_VALUE_FIELDS,
    URL_LIST_FIELDS,
    CONFIGURATION_KEYS,
    SOURCE_KEYS,
};
