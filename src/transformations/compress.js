const _ = require('lodash');
const consola = require('consola');
const tldts = require('tldts');
const ruleUtils = require('../rule');

/**
 * Converts array of /etc/hosts rules to a map.
 *
 * @param {Array<string>} rules - rules to convert
 * @returns {*} a map where the key is the eTLD+1 domain, and value
 * is an array of the full hostnames.
 */
function rulesToDomainMap(rules) {
    // Key=registered domain (eTLD+1)
    // Value=array of full hostnames
    const perHostname = {};

    rules.forEach((ruleText) => {
        if (!ruleUtils.isEtcHostsRule(ruleText)) {
            // Ignore the rule
            consola.debug(`Ignoring a non-hosts rule: ${ruleText}`);
            return;
        }

        const props = ruleUtils.loadEtcHostsRuleProperties(ruleText);

        // eslint-disable-next-line no-restricted-syntax
        for (const hostname of props.hostnames) {
            const result = tldts.parse(hostname);
            let fullNames = perHostname[result.domain];
            if (!fullNames) {
                fullNames = [];
                perHostname[result.domain] = fullNames;
            }
            if (!_.includes(fullNames, hostname)) {
                fullNames.push(hostname);
            }
        }
    });

    return perHostname;
}

/**
 * Converts a list of hostnames to adblock-style rules.
 * This method discards subdomains if they were already processed.
 *
 * For example, for ['example.org', 'sub.example.org'] the output
 * will be ['||example.org'].
 *
 * For ['sub1.example.org', 'sub2.example.org'] the output will be
 * ['||sub1.example.org^', '||sub2.example.org^'].
 *
 * @param {Array<String>} hostnames - list of hostnames (with the same eTLD+1)
 * @returns {Array<String>} list of adblock-style rules
 */
function hostnamesToAdblockRules(hostnames) {
    const count = (str, ch) => _.countBy(str)[ch] || 0;
    const compareFn = (a, b) => {
        const aDepth = count(a, '.');
        const bDepth = count(b, '.');
        if (aDepth === bDepth) {
            // Sort alphabetically if the domain level is the same
            return a.localeCompare(b);
        }

        return aDepth - bDepth;
    };

    // Sort array of the hostnames by their length in the ASC order
    // This way it is easier to redundant discard rules
    const sorted = hostnames.sort(compareFn);

    const processedHostnames = [];
    const rules = [];

    sorted.forEach((hostname) => {
        if (processedHostnames.some((h) => hostname.endsWith(`.${h}`) || h === hostname)) {
            // there's already a rule that makes this one redundant
            consola.debug(`Redundant hostname: ${hostname}`);
            return;
        }

        processedHostnames.push(hostname);
        rules.push(`||${hostname}^`);
    });

    return rules;
}

/**
 * This transformation converts /etc/hosts rules into adblock-style rules.
 * All other types of rules and comments will be discarded.
 *
 * 1. It converts all rules to adblock-style rules. For instance,
 * "0.0.0.0 example.org" will be converted to "||example.org^"
 * 2. It discards the rules that are already covered by existing rules.
 * For instance, "||example.org" blocks "example.org" and all it's subdomains,
 * therefore you don't need additional rules for the subdomains.
 *
 * @param {Array<String>} rules - list of rules to compress
 * @returns {Array<String>} compressed list
 */
function compress(rules) {
    // Key=registered domain (eTLD+1)
    // Value=array of full hostnames
    const domainMap = rulesToDomainMap(rules);

    // Sorted array of eTLD+1 domains
    const domains = Object.keys(domainMap).sort();

    // Prepare the list of filtered rules
    let filtered = [];

    // Iterate over eTLD+1 domains
    domains.forEach((domain) => {
        // Sort array of the hostnames by their length in the ASC order
        const hostnames = domainMap[domain];

        // Get the rules and append to the filtered array
        const converted = hostnamesToAdblockRules(hostnames);
        filtered = filtered.concat(converted);
    });

    return filtered;
}

module.exports = compress;
