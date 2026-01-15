import { TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that converts non-ASCII domain names to Punycode.
 */
export class ConvertToAsciiTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.ConvertToAscii;
    /** Human-readable name of the transformation */
    public readonly name = 'ConvertToAscii';

    /**
     * Converts non-ASCII domain names to Punycode.
     * @param rules - Array of rules to process
     * @returns Array with ASCII-safe rules
     */
    public executeSync(rules: string[]): string[] {
        return rules.map((rule) => {
            // Skip comments and empty lines
            if (RuleUtils.isComment(rule) || rule.length === 0) {
                return rule;
            }

            // Skip rules without non-ASCII characters
            if (!RuleUtils.containsNonAsciiCharacters(rule)) {
                return rule;
            }

            // Convert to punycode
            const punycodeRule = RuleUtils.convertNonAsciiToPunycode(rule);
            this.debug(`Converting non-ASCII line ${rule} to punycode ${punycodeRule}`);

            return punycodeRule;
        });
    }
}
