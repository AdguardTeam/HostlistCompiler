const consola = require('consola');
const { MODIFIER_REGEX, classifyIpPattern, parseIpPattern } = require('../utils');

/**
 * Action constants for IP rule processing results.
 * Used by check helpers, processIpRule, and normalizeIpRules.
 */
const ACTION = Object.freeze({
    /** Pattern is valid and already in canonical form — no change needed. */
    KEEP: 'keep',
    /** Pattern needs rewriting to canonical form. */
    NORMALIZE: 'normalize',
    /** Pattern is invalid but normalizer passes it through (validator rejects). */
    REJECT: 'reject',
    /** Pattern is a valid subnet already in canonical form (||prefix present). */
    ALLOW: 'allow',
});

/**
 * Determines if a pattern is a full 4-octet IP address that needs normalization.
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {string|null} The normalized pattern (||ip^) or null if not applicable.
 */
function normalizeFullIp(pattern) {
    const c = classifyIpPattern(pattern);
    if (!c || !c.isFullIp) {
        return null;
    }

    const ip = c.octets.join('.');

    // Already in correct format ||ip^
    if (c.prefix === '||' && c.hasCaret) {
        return null;
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
 *   - action: ACTION.ALLOW, ACTION.NORMALIZE, ACTION.REJECT
 *   - normalized: the normalized pattern (if action is ACTION.NORMALIZE)
 *   - reason: rejection reason (if action is ACTION.REJECT)
 *   - null means the pattern is not a 3-octet IP subnet; caller should try the next check.
 */
function check3OctetSubnet(pattern) {
    const c = classifyIpPattern(pattern);
    if (!c || c.octetCount !== 3) {
        return null;
    }

    const ip = c.octets.join('.');

    // 3 octets with ^ - doesn't work in AdGuard Home
    if (c.hasCaret) {
        return {
            action: ACTION.REJECT,
            reason: '3-octet IP pattern with ^ does not work in AdGuard Home',
        };
    }

    // 3 octets without trailing dot/wildcard - ambiguous
    if (!c.hasTrailingDot && !c.hasTrailingWildcard) {
        return {
            action: ACTION.REJECT,
            reason: '3-octet IP without trailing dot/wildcard is ambiguous (would match 192.168.11, 192.168.111, etc.)',
        };
    }

    // Valid 3-octet subnet pattern - normalize to add || if missing
    if (c.prefix === '||') {
        return {
            action: ACTION.ALLOW,
        };
    }

    // Normalize: add || prefix
    const suffix = c.hasTrailingWildcard ? '.*' : '.';
    return {
        action: ACTION.NORMALIZE,
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
    const c = classifyIpPattern(pattern);
    if (!c || !c.isTooWide) {
        return null;
    }

    return {
        action: ACTION.REJECT,
        reason: `${c.octetCount}-octet IP pattern is too wide, use regex instead`,
    };
}

/**
 * Normalizes an IP rule if needed, or keeps it unchanged.
 * Invalid patterns are passed through for the validator to reject.
 *
 * @param {string} ruleText - The full rule text (may include modifiers and @@ prefix).
 * @returns {object} Result object.
 *   - action: ACTION.KEEP (no change), ACTION.NORMALIZE
 *   - normalized: the normalized rule (if action is ACTION.NORMALIZE)
 */
function processIpRule(ruleText) {
    // Skip comments and empty lines
    if (!ruleText || ruleText.startsWith('!') || ruleText.startsWith('#') || ruleText.trim() === '') {
        return { action: ACTION.KEEP };
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
        if (MODIFIER_REGEX.test(afterDollar)) {
            pattern = ruleWithoutException.slice(0, dollarIdx);
            modifiers = ruleWithoutException.slice(dollarIdx);
        }
    }

    // Check for 3-octet subnet patterns (normalize or keep)
    const subnet = check3OctetSubnet(pattern);
    if (subnet?.action === ACTION.NORMALIZE) {
        return {
            action: ACTION.NORMALIZE,
            normalized: exceptionPrefix + subnet.normalized + modifiers,
        };
    }
    if (subnet?.action === ACTION.ALLOW || subnet?.action === ACTION.REJECT) {
        // ALLOW — already correct; REJECT — pass through, validator will handle
        return { action: ACTION.KEEP };
    }

    // Check for full 4-octet IP normalization
    const normalized = normalizeFullIp(pattern);
    if (normalized) {
        return {
            action: ACTION.NORMALIZE,
            normalized: exceptionPrefix + normalized + modifiers,
        };
    }

    return { action: ACTION.KEEP };
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

        if (processed.action === ACTION.NORMALIZE) {
            consola.info(`Normalized IP rule: ${rule} → ${processed.normalized}`);
            result.push(processed.normalized);
        } else {
            // KEEP — pass through unchanged; validator will reject invalid patterns
            result.push(rule);
        }
    }

    return result;
}

module.exports = {
    ACTION,
    parseIpPattern,
    normalizeFullIp,
    check3OctetSubnet,
    checkTooWidePattern,
    processIpRule,
    normalizeIpRules,
};
