const _ = require('lodash');
const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * Extracts hostnames up to TLD.
 * For instance:
 * "example.org" -> ["example.org", "org"]
 * "sub.example.org" -> ["sub.example.org", "example.org", "org"]
 *
 * @param {*} hostname hostname
 * @returns {Array<String>} array of hostnames
 */
function extractHostnames(hostname) {
    const parts = hostname.split('.');
    const domains = [];
    for (let i = 0; i < parts.length; i += 1) {
        const domain = parts.slice(i, parts.length).join('.');
        domains.push(domain);
    }

    return domains;
}

/**
 * Represents a blocklist rule
 *
 * @typedef {Object} BlocklistRule
 * @property {String} ruleText - rule text
 * @property {Boolean} canCompress - whether the rule can be compressed or not
 * @property {String} hostname - hostname this rule blocks
 * @property {String} originalRuleText - rule text of the original rule (makes sense for /etc/hosts)
 */

/**
 * Converts the specified rule to an array of "Rule".
 *
 * @param {String} ruleText rule text
 * @returns {Array<BlocklistRule>} an array of blocklist rules.
 */
function toAdblockRules(ruleText) {
    const adblockRules = [];

    // /etc/hosts rules can be compressed
    if (ruleUtils.isEtcHostsRule(ruleText)) {
        const props = ruleUtils.loadEtcHostsRuleProperties(ruleText);

        // eslint-disable-next-line no-restricted-syntax
        for (const hostname of props.hostnames) {
            adblockRules.push({
                ruleText: `||${hostname}^`,
                canCompress: true,
                hostname,
                originalRuleText: ruleText,
            });
        }

        return adblockRules;
    }

    // simple domain names should also be compressed (and converted)
    if (ruleUtils.isJustDomain(ruleText)) {
        return [{
            ruleText: `||${ruleText}^`,
            canCompress: true,
            hostname: ruleText,
            originalRuleText: ruleText,
        }];
    }

    // try parsing an adblock rule and check if it can be compressed
    try {
        const props = ruleUtils.loadAdblockRuleProperties(ruleText);
        if (props.hostname && !props.whitelist && _.isEmpty(props.options)) {
            adblockRules.push({
                ruleText,
                canCompress: true,
                hostname: props.hostname,
                originalRuleText: ruleText,
            });

            return adblockRules;
        }
    } catch (ex) {
        // Ignore invalid rules
    }

    // Cannot parse or compress
    adblockRules.push({
        ruleText,
        canCompress: false,
        hostname: null,
        originalRuleText: ruleText,
    });
    return adblockRules;
}

/**
 * This transformation compresses the final list by removing redundant rules.
 * Please note, that it also converts /etc/hosts rules into adblock-style rules.
 *
 * 1. It converts all rules to adblock-style rules. For instance,
 * "0.0.0.0 example.org" will be converted to "||example.org^".
 * 2. It discards the rules that are already covered by existing rules.
 * For instance, "||example.org" blocks "example.org" and all it's subdomains,
 * therefore you don't need additional rules for the subdomains.
 *
 * @param {Array<String>} rules - list of rules to compress
 * @returns {Array<String>} compressed list
 */
function compress(rules) {
    const byHostname = {};
    const filtered = [];

    // First loop:
    // 1. Transform /etc/hosts rules to adblock-style rules
    // 2. Fill "byHostname" lookup table
    // 3. Check "byHostname" to eliminate duplicates on the first run
    for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];
        const adblockRules = toAdblockRules(rule);
        adblockRules.forEach((adblockRule) => {
            if (adblockRule.canCompress) {
                if (!byHostname[adblockRule.hostname]) {
                    filtered.push(adblockRule);
                    byHostname[adblockRule.hostname] = true;
                }
            } else {
                filtered.push(adblockRule);
            }
        });
    }

    // Second loop:
    // 1. Extract all hostnames up to TLD+1
    // 2. Check them against "byHostname" and discard the rule
    // if it's already covered by an existing rule.
    for (let i = filtered.length - 1; i >= 0; i -= 1) {
        const rule = filtered[i];
        let discard = false;

        if (rule.canCompress) {
            const hostnames = extractHostnames(rule.hostname);
            // Start iterating from 1 -- don't check the full hostname
            for (let j = 1; j < hostnames.length; j += 1) {
                const hostname = hostnames[j];
                if (byHostname[hostname]) {
                    consola.debug(`The rule blocking ${hostname} (from ${rule.originalRuleText}) is redundant`);
                    discard = true;
                    break;
                }
            }
        }
        if (discard) {
            // Remove the rule
            filtered.splice(i, 1);
        }
    }

    consola.info(`The list was compressed from ${rules.length} to ${filtered.length}`);
    return filtered.map((rule) => rule.ruleText);
}

module.exports = compress;
