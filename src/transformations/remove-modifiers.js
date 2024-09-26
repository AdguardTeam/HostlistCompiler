const _ = require('lodash');
const consola = require('consola');
const ruleUtils = require('../rule');

/**
 * This transformation simply removes the following modifiers from the adblock-style rules:
 * $document, $doc, $all, $third-party, $3p, $popup, $network
 *
 * @param {Array<string>} rules - rules to transform
 * @returns {Array<string>} filtered rules
 */
function removeModifiers(rules) {
    const filtered = [];

    let modifiedCount = 0;
    rules.forEach((rawRuleText) => {
        const ruleText = rawRuleText.trim();
        if (_.isEmpty(ruleText) || ruleUtils.isComment(ruleText)) {
            filtered.push(ruleText);
            return;
        }

        let props;
        try {
            props = ruleUtils.loadAdblockRuleProperties(ruleText);
        } catch {
            consola.debug(`Not an adblock rule, ignoring it: ${ruleText}`);
            filtered.push(ruleText);
        }

        let modified = false;
        modified = ruleUtils.removeModifier(props, 'third-party') || modified;
        modified = ruleUtils.removeModifier(props, '3p') || modified;
        modified = ruleUtils.removeModifier(props, 'all') || modified;
        modified = ruleUtils.removeModifier(props, 'document') || modified;
        modified = ruleUtils.removeModifier(props, 'doc') || modified;
        modified = ruleUtils.removeModifier(props, 'popup') || modified;
        modified = ruleUtils.removeModifier(props, 'network') || modified;
        filtered.push(ruleUtils.adblockRuleToString(props));

        if (modified) {
            modifiedCount += 1;
        }
    });

    consola.info(`Removed modifiers from ${modifiedCount} rules`);
    return filtered;
}

module.exports = removeModifiers;
