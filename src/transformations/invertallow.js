const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * This transformation forcibly makes inverts blocking rules,
 * makes them "allowlist" rules.
 *
 * Note, that it does nothing to hosts rules unless they were
 * previously transformed into adblock syntax.
 *
 * @param {Array<string>} rules - rules to transform
 * @returns {Array<string>} filtered rules
 */
function invertAllow(rules) {
    let inverted = 0;

    const filtered = rules.map((rule) => {
        if (rule
            && !ruleUtils.isComment(rule)
            && !ruleUtils.isEtcHostsRule(rule)
            && !ruleUtils.isAllowRule(rule)) {
            inverted += 1;
            return `@@${rule}`;
        }

        return rule;
    });

    consola.info(`Inverted to allowlist rules: ${inverted}`);
    return filtered;
}

module.exports = invertAllow;
