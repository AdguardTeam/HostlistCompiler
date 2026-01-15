import { TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that inverts blocking rules to allow rules.
 * Adds @@ prefix to non-comment, non-hosts, non-allow rules.
 */
export class InvertAllowTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.InvertAllow;
    /** Human-readable name of the transformation */
    public readonly name = 'InvertAllow';

    /**
     * Inverts blocking rules to allow rules.
     * @param rules - Array of rules to invert
     * @returns Array with inverted rules
     */
    public executeSync(rules: string[]): string[] {
        let inverted = 0;

        const filtered = rules.map((rule) => {
            if (
                rule &&
                !RuleUtils.isComment(rule) &&
                !RuleUtils.isEtcHostsRule(rule) &&
                !RuleUtils.isAllowRule(rule)
            ) {
                inverted += 1;
                return `@@${rule}`;
            }

            return rule;
        });

        this.info(`Inverted to allowlist rules: ${inverted}`);
        return filtered;
    }
}
