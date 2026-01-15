import { TransformationType } from '../types/index.ts';
import { RuleUtils, StringUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Modifiers to remove from adblock-style rules.
 */
const MODIFIERS_TO_REMOVE = [
    'third-party',
    '3p',
    'all',
    'document',
    'doc',
    'popup',
    'network',
];

/**
 * Transformation that removes unsupported modifiers from adblock-style rules.
 */
export class RemoveModifiersTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.RemoveModifiers;
    /** Human-readable name of the transformation */
    public readonly name = 'RemoveModifiers';

    /**
     * Removes unsupported modifiers from rules.
     * @param rules - Array of rules to process
     * @returns Array with modifiers removed
     */
    public executeSync(rules: string[]): string[] {
        const filtered: string[] = [];
        let modifiedCount = 0;

        for (const rawRuleText of rules) {
            const ruleText = rawRuleText.trim();

            // Pass through empty lines and comments
            if (StringUtils.isEmpty(ruleText) || RuleUtils.isComment(ruleText)) {
                filtered.push(ruleText);
                continue;
            }

            try {
                const props = RuleUtils.loadAdblockRuleProperties(ruleText);
                let modified = false;

                for (const modifier of MODIFIERS_TO_REMOVE) {
                    if (RuleUtils.removeModifier(props, modifier)) {
                        modified = true;
                    }
                }

                filtered.push(RuleUtils.adblockRuleToString(props));

                if (modified) {
                    modifiedCount += 1;
                }
            } catch {
                this.debug(`Not an adblock rule, ignoring it: ${ruleText}`);
                filtered.push(ruleText);
            }
        }

        this.info(`Removed modifiers from ${modifiedCount} rules`);
        return filtered;
    }
}
