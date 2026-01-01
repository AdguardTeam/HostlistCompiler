import { TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that inverts blocking rules to allow rules.
 * Adds @@ prefix to non-comment, non-hosts, non-allow rules.
 */
export class InvertAllowTransformation extends SyncTransformation {
    public readonly type = TransformationType.InvertAllow;
    public readonly name = 'InvertAllow';

    public executeSync(rules: string[]): string[] {
        let inverted = 0;

        const filtered = rules.map((rule) => {
            if (
                rule
                && !RuleUtils.isComment(rule)
                && !RuleUtils.isEtcHostsRule(rule)
                && !RuleUtils.isAllowRule(rule)
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
