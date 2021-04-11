const _ = require('lodash');
const consola = require('consola');
const tldts = require('tldts');
const utils = require('../utils');
const ruleUtils = require('../rule');

/**
 * The list of modifiers supported by hosts-level blockers.
 */
const SUPPORTED_MODIFIERS = [
    'important',
    '~important',
    'badfilter',
    'ctag',
];

/**
 * Max length of a blocking pattern
 */
const MAX_PATTERN_LENGTH = 5;

/**
 * Checks if the specified hostname is valid for a blocklist.
 *
 * @param {String} hostname - hostname to check
 * @param {String} ruleText - original rule text (for logging)
 * @returns {Boolean} true if the hostname is okay to be in the blocklist.
 */
function validHostname(hostname, ruleText) {
    const result = tldts.parse(hostname);

    if (!result.hostname || result.isIp) {
        consola.debug(`invalid hostname ${hostname} in the rule: ${ruleText}`);
        return false;
    }

    if (result.hostname === result.publicSuffix) {
        consola.debug(`matching the whole public suffix ${hostname} is not allowed: ${ruleText}`);
        return false;
    }

    return true;
}

/**
 * Validates an /etc/hosts rule.
 *
 * We do one very simple thing:
 * 1. Validate all the hostnames
 * 2. Prohibit rules that block the whole public suffix
 * 3. Prohibit rules that contain invalid domain names
 *
 * @param {String} ruleText - rule text
 * @returns {Boolean} true if the rule is a valid /etc/hosts rule
 */
function validEtcHostsRule(ruleText) {
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

    if (props.hostnames.some((h) => !validHostname(h, ruleText))) {
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
 * @param {String} ruleText - rule text
 * @returns {Boolean} - adblock-style rule
 */
function validAdblockRule(ruleText) {
    let props;
    try {
        props = ruleUtils.loadAdblockRuleProperties(ruleText);
    } catch (ex) {
        consola.debug(`This is not a valid adblock rule: ${ruleText}: ${ex}`);
        return false;
    }

    // 1. It checks if the rule contains only supported modifiers.
    if (props.options) {
        // eslint-disable-next-line no-restricted-syntax
        for (const option of props.options) {
            if (SUPPORTED_MODIFIERS.indexOf(option.name) === -1) {
                consola.debug(`Contains unsupported modifier ${option.name}: ${ruleText}`);
                return false;
            }
        }
    }

    // 2. It checks whether the pattern is not too wide (should be at least 5 characters).
    if (props.pattern.length < MAX_PATTERN_LENGTH) {
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

    // 4. Validate domain name
    // Note that we don't check rules that contain wildcard characters
    const sepIdx = props.pattern.indexOf('^');
    const wildcardIdx = props.pattern.indexOf('*');
    if (sepIdx !== -1 && wildcardIdx !== -1 && wildcardIdx > sepIdx) {
        // Smth like ||example.org^test* -- invalid
        return false;
    }

    if (_.startsWith(props.pattern, '||')
        && sepIdx !== -1
        && wildcardIdx === -1) {
        const hostname = utils.substringBetween(ruleText, '||', '^');
        if (!validHostname(hostname, ruleText)) {
            return false;
        }

        // If there's something after ^ in the pattern - something went wrong
        // unless it's `^|` which is a rather often case
        if (props.pattern.length > (sepIdx + 1)
            && props.pattern[sepIdx + 1] !== '|') {
            return false;
        }
    }

    return true;
}

/**
 * Validates the rule.
 *
 * Emptry strings and comments are considered valid.
 *
 * For /etc/hosts rules: {@see validEtcHostsRule}
 * For adblock-style rules: {@see validAdblockRule}
 *
 * @param {String} ruleText - rule to check
 * @returns {Boolean} true if rule is a comment
 */
function valid(ruleText) {
    if (ruleUtils.isComment(ruleText) || _.isEmpty(_.trim(ruleText))) {
        return true;
    }

    if (ruleUtils.isEtcHostsRule(ruleText)) {
        return validEtcHostsRule(ruleText);
    }
    return validAdblockRule(ruleText);
}

/**
 * Validates a list of rules.
 *
 * @param {Array<string>} rules - an array of rules to validate
 * @returns {Array<string>} an array of rules without invalid
 */
function validate(rules) {
    // Clone the original array before modifying it
    const filtered = [...rules];
    let prevRuleRemoved = false;

    for (let iFiltered = filtered.length - 1; iFiltered >= 0; iFiltered -= 1) {
        const ruleText = filtered[iFiltered];

        if (!valid(ruleText)) {
            prevRuleRemoved = true;
            filtered.splice(iFiltered, 1);
        } else if (prevRuleRemoved && (ruleUtils.isComment(ruleText) || _.isEmpty(ruleText))) {
            // Remove preceding comments and empty lines
            consola.debug(`Removing a comment preceding invalid rule: ${ruleText}`);
            filtered.splice(iFiltered, 1);
        } else {
            // Stop removing comments
            prevRuleRemoved = false;
        }
    }

    return filtered;
}

module.exports = validate;
