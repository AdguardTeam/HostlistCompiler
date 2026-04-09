const consola = require('consola');

/**
 * Regex to match a valid IPv4 octet (0-255).
 */
const OCTET_REGEX = /^\d{1,3}$/;

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
 * Parses an IP-like pattern and extracts its components.
 *
 * @param {string} pattern - The adblock pattern (without modifiers).
 * @returns {object|null} Parsed components or null if not an IP pattern.
 *   - prefix: '', '|', or '||'
 *   - octets: array of octet strings
 *   - hasTrailingDot: boolean
 *   - hasTrailingWildcard: boolean (ends with .*)
 *   - hasCaret: boolean (ends with ^)
 *   - hasCaretPipe: boolean (ends with ^|)
 */
function parseIpPattern(pattern) {
    let remaining = pattern;
    let prefix = '';

    // Extract prefix
    if (remaining.startsWith('||')) {
        prefix = '||';
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
 * Determines if a pattern is a full 4-octet IP address that needs normalization.
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {string|null} The normalized pattern (||ip^) or null if not applicable.
 */
function normalizeFullIp(pattern) {
    const parsed = parseIpPattern(pattern);
    if (!parsed) {
        return null;
    }

    // Must be exactly 4 octets
    if (parsed.octets.length !== 4) {
        return null;
    }

    // Must not have trailing dot or wildcard (those are subnet patterns)
    if (parsed.hasTrailingDot || parsed.hasTrailingWildcard) {
        return null;
    }

    const ip = parsed.octets.join('.');

    // Already in correct format ||ip^
    if (parsed.prefix === '||' && parsed.hasCaret) {
        return null; // No change needed
    }

    // Normalize to ||ip^
    return `||${ip}^`;
}

/**
 * Determines if a pattern is a 3-octet subnet that should be allowed.
 *
 * Valid 3-octet patterns:
 *   - 192.168.1.  (trailing dot)
 *   - 192.168.1.* (trailing wildcard)
 *   - ||192.168.1. (with prefix)
 *   - ||192.168.1.* (with prefix)
 *
 * Invalid 3-octet patterns:
 *   - 192.168.1 (no trailing dot/wildcard - ambiguous)
 *   - ||192.168.1^ (with caret - doesn't work in AdGuard Home)
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {object|null} Result with action and normalized pattern, or null if not applicable.
 *   - action: 'allow', 'normalize', 'reject'
 *   - normalized: the normalized pattern (if action is 'normalize')
 *   - reason: rejection reason (if action is 'reject')
 *   - null means the pattern is not a 3-octet IP subnet; caller should try the next check.
 */
function check3OctetSubnet(pattern) {
    const parsed = parseIpPattern(pattern);
    if (!parsed) {
        return null;
    }

    // Must be exactly 3 octets
    if (parsed.octets.length !== 3) {
        return null;
    }

    const ip = parsed.octets.join('.');

    // 3 octets with ^ - doesn't work in AdGuard Home
    if (parsed.hasCaret) {
        return {
            action: 'reject',
            reason: '3-octet IP pattern with ^ does not work in AdGuard Home',
        };
    }

    // 3 octets without trailing dot/wildcard - ambiguous
    if (!parsed.hasTrailingDot && !parsed.hasTrailingWildcard) {
        return {
            action: 'reject',
            reason: '3-octet IP without trailing dot/wildcard is ambiguous (would match 192.168.11, 192.168.111, etc.)',
        };
    }

    // Valid 3-octet subnet pattern - normalize to add || if missing
    if (parsed.prefix === '||') {
        return { action: 'allow' }; // Already has ||
    }

    // Normalize: add || prefix
    const suffix = parsed.hasTrailingWildcard ? '.*' : '.';
    return {
        action: 'normalize',
        normalized: `||${ip}${suffix}`,
    };
}

/**
 * Checks if a pattern is a 1-2 octet pattern (too wide, should be rejected).
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {{action: string, reason: string}|null} Reject result, or null if not applicable.
 *   - null means the pattern has more than 2 octets; caller should try the next check.
 */
function checkTooWidePattern(pattern) {
    const parsed = parseIpPattern(pattern);
    if (!parsed) {
        return null;
    }

    // 1-2 octets are too wide
    if (parsed.octets.length <= 2) {
        return {
            action: 'reject',
            reason: `${parsed.octets.length}-octet IP pattern is too wide, use regex instead`,
        };
    }

    return null;
}

/**
 * Normalizes an IP rule if needed, or returns null if the rule should be rejected.
 *
 * @param {string} ruleText - The full rule text (may include modifiers and @@ prefix).
 * @returns {object} Result object.
 *   - action: 'keep' (no change), 'normalize', 'reject'
 *   - normalized: the normalized rule (if action is 'normalize')
 *   - reason: rejection reason (if action is 'reject')
 */
function processIpRule(ruleText) {
    // Skip comments and empty lines
    if (!ruleText || ruleText.startsWith('!') || ruleText.startsWith('#') || ruleText.trim() === '') {
        return { action: 'keep' };
    }

    // Check for exception rules (@@) - process them too, but preserve @@ prefix
    let exceptionPrefix = '';
    let ruleWithoutException = ruleText;
    if (ruleText.startsWith('@@')) {
        exceptionPrefix = '@@';
        ruleWithoutException = ruleText.slice(2);
    }

    // Extract pattern and modifiers
    let pattern = ruleWithoutException;
    let modifiers = '';
    const dollarIdx = ruleWithoutException.lastIndexOf('$');
    if (dollarIdx !== -1) {
        // Check if $ is part of a regex or actual modifier separator
        const afterDollar = ruleWithoutException.slice(dollarIdx + 1);
        // Simple heuristic: if it looks like modifiers (alphanumeric, commas, equals, dots for IPs in values)
        if (/^[a-zA-Z0-9,=~_.-]+$/.test(afterDollar)) {
            pattern = ruleWithoutException.slice(0, dollarIdx);
            modifiers = ruleWithoutException.slice(dollarIdx);
        }
    }

    // Check for too wide patterns (1-2 octets) first
    const tooWide = checkTooWidePattern(pattern);
    if (tooWide?.action === 'reject') {
        return tooWide;
    }

    // Check for 3-octet subnet patterns
    const subnet = check3OctetSubnet(pattern);
    if (subnet?.action === 'reject') {
        return subnet;
    }
    if (subnet?.action === 'normalize') {
        return {
            action: 'normalize',
            normalized: exceptionPrefix + subnet.normalized + modifiers,
        };
    }
    if (subnet?.action === 'allow') {
        return { action: 'keep' };
    }

    // Check for full 4-octet IP normalization
    const normalized = normalizeFullIp(pattern);
    if (normalized) {
        return {
            action: 'normalize',
            normalized: exceptionPrefix + normalized + modifiers,
        };
    }

    return { action: 'keep' };
}

/**
 * Processes a list of rules, normalizing IP rules and rejecting invalid ones.
 *
 * @param {string[]} rules - Array of rules.
 * @returns {string[]} Processed rules with normalization applied.
 */
function normalizeIpRules(rules) {
    const result = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const rule of rules) {
        const processed = processIpRule(rule);

        switch (processed.action) {
            case 'normalize':
                consola.info(`Normalized IP rule: ${rule} → ${processed.normalized}`);
                result.push(processed.normalized);
                break;
            case 'reject':
                consola.debug(`Rejected IP rule: ${rule} (${processed.reason})`);
                // Don't add to result - rule is rejected
                break;
            case 'keep':
            default:
                result.push(rule);
                break;
        }
    }

    return result;
}

module.exports = {
    parseIpPattern,
    normalizeFullIp,
    check3OctetSubnet,
    checkTooWidePattern,
    processIpRule,
    normalizeIpRules,
};
