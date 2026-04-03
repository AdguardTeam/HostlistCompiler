/**
 * Checks if a pattern is an IP-like subnet with | or || prefix: 2 or 3 octets.
 * Examples: ||1.1^, ||1.1.2^, |1.1^, ||192.168^
 * These patterns block IP subnets (left-anchored) and should be rejected in Validate,
 * but allowed in ValidateAllowIp.
 * @param {string} s - The pattern string to check
 * @returns {boolean} True if the pattern is an IP subnet pattern, false otherwise
 */
function isIpSubnetPattern(s) {
    // Must have | or || prefix to be a subnet pattern (left-anchored)
    if (!s.startsWith('|')) {
        return false;
    }
    // Remove prefixes (||, |)
    let pattern = s;
    if (pattern.startsWith('||')) {
        pattern = pattern.slice(2);
    } else if (pattern.startsWith('|')) {
        pattern = pattern.slice(1);
    }
    // Remove ^ and | at the end
    pattern = pattern.replace(/\^\|?$/, '');
    // Remove trailing dot if present
    if (pattern.endsWith('.')) {
        pattern = pattern.slice(0, -1);
    }
    // Must have 2 or 3 octets (1.1 or 1.1.2)
    const parts = pattern.split('.');
    if (parts.length !== 2 && parts.length !== 3) {
        return false;
    }
    // All parts must be numbers 0-255
    return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

/**
 * Checks if a pattern is an IP-suffix (no | or || prefix): 2, 3, or 4 octets.
 * Examples: 1.1^, 1.1.1^, 1.1.1.1^, 192.168^
 * These patterns match string endings and block unpredictably (e.g., 1.1^ blocks 1.1.1.1, 1.1.111.1, example1.1).
 * They should ALWAYS be rejected (in both Validate and ValidateAllowIp).
 * @param {string} s - The pattern string to check
 * @returns {boolean} True if the pattern is an IP suffix pattern, false otherwise
 */
function isIpSuffixPattern(s) {
    // Must NOT have | or || prefix (otherwise it's a subnet pattern, not a suffix)
    if (s.startsWith('|')) {
        return false;
    }
    // Remove ^ and | at the end
    let pattern = s.replace(/\^\|?$/, '');
    // Remove trailing dot if present
    if (pattern.endsWith('.')) {
        pattern = pattern.slice(0, -1);
    }
    // Must have 2, 3, or 4 octets
    const parts = pattern.split('.');
    if (parts.length < 2 || parts.length > 4) {
        return false;
    }
    // All parts must be numbers 0-255
    return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}
const _ = require('lodash');
const consola = require('consola');
const tldts = require('tldts');
const utils = require('../utils');
const ruleUtils = require('../rule');

const DOMAIN_PREFIX = '||';
const DOMAIN_SEPARATOR = '^';
const WILDCARD = '*';
const WILDCARD_DOMAIN_PART = '*.';
// Matches exact domain-style adblock patterns: ||example.org^, *.org^, .org^, ||org^
// Each part explained:
const EXACT_DOMAIN_PATTERN = new RegExp(
    // optional || prefix: matches ||example.org^, does not require it for .org^ or *.org^
    '^(?:\\|\\|)?'
    // optional leading *. or .: matches *.org^, .org^; absent for plain ||example.org^
    + '(?:\\*\\.|\\.)?'
    // first label: alnum start/end, hyphens only inside
    //   valid:   example, foo-bar, xn--d1acufc
    //   invalid: -example, example-, (empty)
    + '([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?'
    // additional dot-separated labels with same constraints
    //   valid:   example.org, sub.example.org, foo-bar.baz
    //   invalid: example..org, example.-org, example.org-
    + '(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*'
    // optional trailing dot: FQDN notation, normalized away before tldts
    //   valid:   foo.bar. (treated as foo.bar)
    //   invalid: foo..  (two dots — not matched)
    + '\\.?)'
    // required ^ separator; optional trailing | for exception-end anchors
    //   valid:   ||example.org^, ||example.org^|
    //   invalid: ||example.org, ||example.org^abc
    + '\\^\\|?$',
);

// TODO: Remove lodash from the project if possible

/**
 * The list of modifiers that limit the rule for specific domains.
 */
const ANY_PATTERN_MODIFIER = [
    'denyallow',
    'badfilter',
    // DNS-related modifiers.
    'client',
];

/**
 * The list of modifiers supported by hosts-level blockers.
 */
const SUPPORTED_MODIFIERS = [
    'important',
    '~important',
    // DNS-related modifiers.
    'dnstype',
    'dnsrewrite',
    'ctag',
    // modifiers that limit the rule for specific domains
    ...ANY_PATTERN_MODIFIER,
];

/**
 * Max length of a blocking pattern
 */
const MAX_PATTERN_LENGTH = 5;

/**
 * Checks if the specified hostname is valid for a blocklist.
 *
 * @param {string} hostname - hostname to check
 * @param {string} ruleText - original rule text (for logging)
 * @param {boolean} allowedIP - flag to determine if IP validation is allowed
 * @param {boolean} hasLimitModifier - flag to determine if the rule has a limit modifier, e.g. denyallow
 * @param {boolean} allowPublicSuffix - flag to determine if matching whole public suffixes is allowed
 * @returns {boolean} true if the hostname is okay to be in the blocklist.
 */
function validHostname(hostname, ruleText, allowedIP, hasLimitModifier, allowPublicSuffix) {
    const result = tldts.parse(hostname);

    if (!result.hostname) {
        consola.debug(`invalid hostname ${hostname} in the rule: ${ruleText}`);
        return false;
    }

    if (!allowedIP && result.isIp) {
        consola.debug(`invalid hostname ${hostname} in the rule: ${ruleText}`);
        return false;
    }

    if (result.hostname === result.publicSuffix && !hasLimitModifier) {
        if (!allowPublicSuffix) {
            consola.debug(`matching the whole public suffix ${hostname} is not allowed: ${ruleText}`);
            return false;
        }
        // Even with allowPublicSuffix, reject hostnames that tldts does not recognise
        // as real ICANN or private public suffixes. Without this check, any single-label
        // garbage like "a", "aa", "1" passes because tldts defaults hostname === publicSuffix
        // for unknown labels.
        if (!result.isIcann && !result.isPrivate) {
            consola.debug(`hostname ${hostname} is not a known public suffix: ${ruleText}`);
            return false;
        }
    }

    return true;
}

/**
 * Extracts a domain-like pattern from rules such as ||org^, ||*.org^, .org^ or *.org^.
 *
 * @param {string} pattern - adblock rule pattern without modifiers
 * @returns {string|null} normalized hostname to validate or null if the pattern does not match
 */
function extractDomainPattern(pattern) {
    const match = pattern.match(EXACT_DOMAIN_PATTERN);
    if (!match) {
        return null;
    }

    const hostname = match[1];
    // Allow trailing dot as absolute FQDN marker by normalizing it away for validation.
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

/**
 * Validates an /etc/hosts rule.
 *
 * We do one very simple thing:
 * 1. Validate all the hostnames
 * 2. Prohibit rules that block the whole public suffix
 * 3. Prohibit rules that contain invalid domain names
 *
 * @param {string} ruleText - rule text
 * @param {boolean} allowIP - flag to determine if IP validation is allowed
 * @param {boolean} allowPublicSuffix - flag to determine if matching whole public suffixes is allowed
 * @returns {boolean} true if the rule is a valid /etc/hosts rule
 */
function validEtcHostsRule(ruleText, allowIP, allowPublicSuffix) {
    let props;
    try {
        props = ruleUtils.loadEtcHostsRuleProperties(ruleText);
    } catch (ex) {
        consola.error(`Unexpected incorrect /etc/hosts rule: ${ruleText}: ${ex}`);
        return false;
    }
    if (_.isEmpty(props.hostnames)) {
        consola.info(`The rule has no hostnames: ${ruleText}`);
        return false;
    }

    if (props.hostnames.some((h) => !validHostname(h, ruleText, allowIP, false, allowPublicSuffix))) {
        return false;
    }

    return true;
}

/**
 * Validates an adblock-style rule.
 *
 * 1. It checks if the rule contains only supported modifiers.
 * 2. It checks whether the pattern is not too wide (should be at least 5 characters).
 * 3. If checks if the pattern does not contain characters that cannot be in a domain name.
 * 4. For domain-blocking rules like ||domain^ it checks that the domain is
 * valid and does not block too much.
 *
 * @param {string} ruleText - rule text
 * @param {boolean} allowedIP - flag to determine if IP validation is allowed
 * @param {boolean} allowPublicSuffix - flag to determine if matching whole public suffixes is allowed
 * @returns {boolean} - adblock-style rule
 */
function validAdblockRule(ruleText, allowedIP, allowPublicSuffix) {
    let props;
    try {
        props = ruleUtils.loadAdblockRuleProperties(ruleText);
    } catch (ex) {
        consola.debug(`This is not a valid adblock rule: ${ruleText}: ${ex}`);
        return false;
    }

    // need to check if rules with TLD has limit modifier
    let hasLimitModifier = false;

    // 1. It checks if the rule contains only supported modifiers.
    if (props.options) {
        // eslint-disable-next-line no-restricted-syntax
        for (const option of props.options) {
            if (SUPPORTED_MODIFIERS.indexOf(option.name) === -1) {
                consola.debug(`Contains unsupported modifier ${option.name}: ${ruleText}`);
                return false;
            }
            // if the rule has a limit modifier, TLD as a hostname is allowed
            if (ANY_PATTERN_MODIFIER.includes(option.name)) {
                hasLimitModifier = true;
            }
        }
    }

    // 2. It checks whether the pattern is not too wide (should be at least 5 characters).
    // Exception: exact domain-style patterns (||uk^, .uk^, etc.) bypass this check even if shorter,
    // because they must reach step 4 to be validated as public suffixes by tldts.
    const exactDomainPattern = extractDomainPattern(props.pattern);
    if (props.pattern.length < MAX_PATTERN_LENGTH && !exactDomainPattern) {
        consola.debug(`The rule is too short: ${ruleText}`);
        return false;
    }

    // 3. If checks if the pattern does not contain characters that cannot be in a domain name.

    // 3.1. Special case: regex rules
    // Do nothing with regex rules -- they may contain all kinds of special chars
    if (_.startsWith(props.pattern, '/')
        && _.endsWith(props.pattern, '/')) {
        return true;
    }

    // However, regular adblock-style rules if they match a domain name
    // a-zA-Z0-9- -- permitted in the domain name
    // *|^ -- special characters used by adblock-style rules
    // One more special case is rules starting with ://s
    let toTest = props.pattern;
    if (_.startsWith(toTest, '://')) {
        toTest = _.trimStart(toTest, '://');
    }

    const checkChars = /^[a-zA-Z0-9-.*|^]+$/.test(toTest);
    if (!checkChars) {
        consola.debug(`The rule contains characters that cannot be in a domain name: ${ruleText}`);
        return false;
    }

    // 3.5. Check if the base pattern is an IP address or IP-like pattern.

    // Reject IP-suffix patterns (1.1^, 1.1.1^, 1.1.1.1^) ALWAYS — they match string endings unpredictably
    // Must check BEFORE tldts.isIp because 4-octet suffixes would be recognized as valid IPs
    if (isIpSuffixPattern(props.pattern)) {
        consola.debug(`IP-suffix pattern is not allowed (blocks unpredictably): ${ruleText}`);
        return false;
    }

    // Reject IP-subnet patterns (||1.1^, ||1.1.2^) only in Validate, allow in ValidateAllowIp
    if (!allowedIP && isIpSubnetPattern(props.pattern)) {
        consola.debug(`IP-like subnet is not allowed: ${ruleText}`);
        return false;
    }

    // Check for full 4-octet IP addresses (||1.1.1.1^, |1.1.1.1^)
    let ipCandidate = props.pattern;
    if (_.startsWith(ipCandidate, DOMAIN_PREFIX)) {
        ipCandidate = ipCandidate.slice(DOMAIN_PREFIX.length);
    } else if (_.startsWith(ipCandidate, '|')) {
        ipCandidate = ipCandidate.slice(1);
    }
    ipCandidate = ipCandidate.replace(/\^\|?$/, '');

    if (tldts.parse(ipCandidate).isIp) {
        if (!allowedIP) {
            consola.debug(`IP address is not allowed: ${ruleText}`);
            return false;
        }
        // IP is allowed — no further domain validation needed
        return true;
    }

    // 4. Validate domain name
    // Note that we don't check rules that contain wildcard characters
    const sepIdx = props.pattern.indexOf(DOMAIN_SEPARATOR);
    const wildcardIdx = props.pattern.indexOf(WILDCARD);
    if (sepIdx !== -1 && wildcardIdx !== -1 && wildcardIdx > sepIdx) {
        // Smth like ||example.org^test* -- invalid
        return false;
    }

    if (exactDomainPattern) {
        return validHostname(exactDomainPattern, ruleText, allowedIP, hasLimitModifier, allowPublicSuffix);
    }

    // Check if the pattern does not start with the domain prefix and does not contain a domain separator
    if (!_.startsWith(props.pattern, DOMAIN_PREFIX) || sepIdx === -1) {
        return true;
    }

    // Extract the domain to check from the parsed pattern (not ruleText) to stay consistent
    // with sepIdx/wildcardIdx which are also computed from props.pattern.
    const domainToCheck = utils.substringBetween(props.pattern, DOMAIN_PREFIX, DOMAIN_SEPARATOR);

    // If there are wildcard characters in the pattern
    if (wildcardIdx !== -1) {
        // Check if the rule has wildcard characters but includes only TLD (e.g., ||*.org^ or ||*.co.uk^)
        const startsWithWildcard = domainToCheck.startsWith(WILDCARD_DOMAIN_PART);
        // Get the TLD pattern to check (e.g. ||*.org^ --> org)
        const TLDPattern = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
        // Compare the TLD pattern with the public suffix
        const isOnlyTLD = tldts.getPublicSuffix(TLDPattern) === TLDPattern;
        // If it's a wildcard with TLD, validate the cleaned TLD
        if (startsWithWildcard && isOnlyTLD) {
            const cleanedDomain = domainToCheck.replace(WILDCARD_DOMAIN_PART, '');
            return validHostname(cleanedDomain, ruleText, allowedIP, hasLimitModifier, allowPublicSuffix);
        }
        // If the rule has wildcard characters but is not a TLD (e.g., ||*.example.org^)
        return true;
    }

    // Validate the domain
    if (!validHostname(domainToCheck, ruleText, allowedIP, hasLimitModifier, allowPublicSuffix)) {
        return false;
    }

    // Ensure there's nothing after the domain separator unless it's `^|`
    // If there's something after ^ in the pattern - something went wrong
    // unless it's `^|` which is a rather often case
    // ||example.org^| -- valid
    // @@||example.org^|$important -- invalid
    return !(props.pattern.length > (sepIdx + 1) && props.pattern[sepIdx + 1] !== '|');
}

/**
 * Validates the rule.
 *
 * Empty strings and comments are considered valid.
 *
 * For /etc/hosts rules: @see {@link validEtcHostsRule}
 * For adblock-style rules: @see {@link validAdblockRule}
 *
 * @param {string} ruleText - rule to check
 * @param {boolean} allowedIP - flag to determine if IP validation is allowed
 * @param {boolean} allowPublicSuffix - flag to determine if matching whole public suffixes is allowed
 * @returns {boolean} - true if the rule is valid, false otherwise
 */
function valid(ruleText, allowedIP, allowPublicSuffix) {
    if (ruleUtils.isComment(ruleText) || _.isEmpty(_.trim(ruleText))) {
        return true;
    }

    if (ruleUtils.isEtcHostsRule(ruleText)) {
        return validEtcHostsRule(ruleText, allowedIP, allowPublicSuffix);
    }

    return validAdblockRule(ruleText, allowedIP, allowPublicSuffix);
}

/**
 * Class representing a validator for a list of rules.
 */
class Validator {
    /**
     * Creates a new rule validator.
     * @param {boolean} allowedIP - Flag indicating whether IP addresses should be considered valid.
     * @param {boolean} allowPublicSuffix - Flag indicating whether rules matching whole public suffix are allowed.
     */
    constructor(allowedIP, allowPublicSuffix) {
        /**
       * Indicates that a rule was previously removed (the iteration processed an invalid rule).
       * Used to remove preceding comments or empty lines.
       * @type {boolean}
       */
        this.previousRuleRemoved = false;

        /**
       * Flag to allow or disallow IP addresses during validation.
       * @type {boolean}
       */
        this.allowedIP = allowedIP;

        /**
       * Flag to allow or disallow validation when hostname equals public suffix.
       * @type {boolean}
       */
        this.allowPublicSuffix = allowPublicSuffix;
    }

    /**
     * Validates a list of rules and removes invalid rules.
     * If a rule is invalid, any preceding comments or empty lines are also removed.
     *
     * @param {string[]} rules - An array of strings (rules) to validate.
     * @returns {string[]} A filtered list of valid rules.
     */
    validate(rules) {
        const filtered = [...rules];
        // Iterate from the end to the beginning so we can remove
        // preceding comments/empty lines if needed
        for (let i = filtered.length - 1; i >= 0; i -= 1) {
            const isValidRule = valid(filtered[i], this.allowedIP, this.allowPublicSuffix);
            const isCommentOrEmptyLine = ruleUtils.isComment(filtered[i]) || _.isEmpty(filtered[i]);

            if (!isValidRule) {
                // If the rule is invalid, remove it and set the flag to remove preceding lines
                this.previousRuleRemoved = true;
                filtered.splice(i, 1);
            } else if (this.previousRuleRemoved && isCommentOrEmptyLine) {
                // If a previous invalid rule was removed, remove this comment or empty line as well
                consola.debug(`Removing a comment or empty line preceding an invalid rule: ${filtered[i]}`);
                filtered.splice(i, 1);
            } else {
                // If it's valid and doesn't match the "remove preceding" scenario, reset the removal flag
                this.previousRuleRemoved = false;
            }
        }

        return filtered;
    }
}

/**
 * Validates a list of rules.
 *
 * @param {Array<string>} rules - The array of rules to validate.
 * @returns {Array<string>} The filtered list of valid rules.
 */
function validate(rules) {
    const validator = new Validator(false, false);
    // ip is not allowed for default validation
    // public suffix matching is not allowed for default validation
    return validator.validate(rules);
}

module.exports = {
    validate,
    Validator,
};
