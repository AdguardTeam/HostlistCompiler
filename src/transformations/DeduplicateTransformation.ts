import { TransformationType } from '../types/index.ts';
import { RuleUtils, StringUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes duplicate rules while preserving order.
 * Also removes preceding comments when a duplicate rule is removed.
 */
export class DeduplicateTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.Deduplicate;
    /** Human-readable name of the transformation */
    public readonly name = 'Deduplicate';

    /**
     * Executes the deduplication transformation synchronously.
     * @param rules - Array of rules to deduplicate
     * @returns Array with duplicates removed
     */
    public executeSync(rules: string[]): string[] {
        if (rules.length === 0) {
            this.info('Empty rules array, nothing to deduplicate');
            return rules;
        }

        const result: string[] = [];
        const seenRules = new Set<string>();

        for (let i = 0; i < rules.length; i += 1) {
            const ruleText = rules[i];
            const isCommentOrEmpty = RuleUtils.isComment(ruleText) || StringUtils.isEmpty(ruleText);

            if (isCommentOrEmpty) {
                // Check if the next non-comment rule is a duplicate
                let nextRuleIdx = i + 1;
                while (
                    nextRuleIdx < rules.length &&
                    (RuleUtils.isComment(rules[nextRuleIdx]) || StringUtils.isEmpty(rules[nextRuleIdx]))
                ) {
                    nextRuleIdx += 1;
                }

                // If next rule exists and is a duplicate, skip this comment
                if (nextRuleIdx < rules.length && seenRules.has(rules[nextRuleIdx])) {
                    this.debug(`Removing a comment preceding duplicate: ${ruleText}`);
                    continue;
                }

                // Otherwise, keep the comment
                result.push(ruleText);
            } else if (seenRules.has(ruleText)) {
                // Skip duplicate
                this.debug(`Removing duplicate: ${ruleText}`);
            } else {
                // First occurrence - keep it
                seenRules.add(ruleText);
                result.push(ruleText);
            }
        }

        this.info(`Deduplication removed ${rules.length - result.length} rules`);
        return result;
    }
}
