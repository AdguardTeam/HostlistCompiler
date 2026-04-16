const consola = require('consola');
const ruleUtils = require('../rule');
const { classifyIpPattern, parseIpPattern } = require('../utils');

// Prefix for canonical IP/domain patterns
const IP_PREFIX = '||';

/**
 * Action constants for IP rule processing results.
 * Used by check helpers, processIpRule, and normalizeIpRules.
 */
const ACTION = Object.freeze({
    /**
     * Pattern is valid and already in canonical form — no change needed.
     */
    KEEP: 'keep',

    /**
     * Pattern needs rewriting to canonical form.
     */
    NORMALIZE: 'normalize',

    /**
     * Pattern is a valid subnet already in canonical form (||prefix present).
     */
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

    // Already in correct format ||ip^ (||ip^| is not a non-canonical variant)
    if (c.prefix === IP_PREFIX && c.hasCaret && !c.hasCaretPipe) {
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
 * Invalid 3-octet patterns (returned as null — caller treats as pass-through):
 *   - 192.168.1 (no trailing dot/wildcard - ambiguous)
 *   - ||192.168.1^ (with caret - doesn't work in AdGuard Home)
 *
 * @param {string} pattern - The adblock pattern.
 * @returns {object|null} Result with action and normalized pattern, or null if not applicable.
 *   - action: ACTION.ALLOW, ACTION.NORMALIZE
 *   - normalized: the normalized pattern (if action is ACTION.NORMALIZE)
 *   - null means the pattern is not a 3-octet IP subnet, or is an invalid 3-octet pattern;
 *     caller should pass it through unchanged.
 */
function check3OctetSubnet(pattern) {
    const c = classifyIpPattern(pattern);
    if (!c || c.octetCount !== 3) {
        return null;
    }

    const ip = c.octets.join('.');

    // 3 octets with ^ - doesn't work in AdGuard Home; pass through for validator
    if (c.hasCaret) {
        return null;
    }

    // 3 octets without trailing dot/wildcard - ambiguous; pass through for validator
    if (!c.hasTrailingDot && !c.hasTrailingWildcard) {
        return null;
    }

    // Valid 3-octet subnet pattern - normalize to add || if missing
    if (c.prefix === IP_PREFIX) {
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

    const ruleProps = ruleUtils.loadAdblockRuleProperties(ruleText);
    const { pattern } = ruleProps;

    // Check for 3-octet subnet patterns (normalize or keep)
    const subnet = check3OctetSubnet(pattern);
    if (subnet?.action === ACTION.NORMALIZE) {
        ruleProps.pattern = subnet.normalized;
        return {
            action: ACTION.NORMALIZE,
            normalized: ruleUtils.adblockRuleToString(ruleProps),
        };
    }
    if (subnet?.action === ACTION.ALLOW) {
        // Already in canonical form — no change needed
        return { action: ACTION.KEEP };
    }

    // Check for full 4-octet IP normalization
    const normalized = normalizeFullIp(pattern);
    if (normalized) {
        ruleProps.pattern = normalized;
        return {
            action: ACTION.NORMALIZE,
            normalized: ruleUtils.adblockRuleToString(ruleProps),
        };
    }

    return { action: ACTION.KEEP };
}

/**
 * Processes a list of rules, normalizing IP rules and passing invalid ones through unchanged.
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
    processIpRule,
    normalizeIpRules,
};
