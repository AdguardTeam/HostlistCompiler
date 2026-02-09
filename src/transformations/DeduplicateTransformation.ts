import { TransformationType } from '../types/index.ts';
import { RuleUtils, StringUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes duplicate rules while preserving order.
 * Also removes preceding comments when a duplicate rule is removed.
 *
 * Uses a two-pass approach for clarity and performance:
 * 1. First pass: Build a Set of all actual rules (non-comments)
 * 2. Second pass: Filter rules, skipping duplicates and their preceding comments
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
    public executeSync(rules: readonly string[]): readonly string[] {
        if (rules.length === 0) {
            this.info('Empty rules array, nothing to deduplicate');
            return rules;
        }

        // Pass 1: Build a map of rule -> first occurrence index
        // This allows O(1) duplicate detection
        const firstOccurrence = new Map<string, number>();

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            // Skip comments and empty lines
            if (!RuleUtils.isComment(rule) && !StringUtils.isEmpty(rule)) {
                if (!firstOccurrence.has(rule)) {
                    firstOccurrence.set(rule, i);
                }
            }
        }

        // Pass 2: Build result, skipping duplicates and comments preceding duplicates
        const result: string[] = [];
        // Pending comments are accumulated and flushed when we see a non-comment rule
        let pendingComments: string[] = [];

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const isCommentOrEmpty = RuleUtils.isComment(rule) || StringUtils.isEmpty(rule);

            if (isCommentOrEmpty) {
                // Buffer comments until we know if they precede a duplicate
                pendingComments.push(rule);
                continue;
            }

            // This is an actual rule
            const isFirstOccurrence = firstOccurrence.get(rule) === i;

            if (isFirstOccurrence) {
                // Keep buffered comments and this rule
                result.push(...pendingComments);
                result.push(rule);
            } else {
                // Duplicate - skip buffered comments too
                this.debug(`Removing duplicate: ${rule}`);
                if (pendingComments.length > 0) {
                    this.debug(`Skipping ${pendingComments.length} comments preceding duplicate`);
                }
            }

            // Clear pending comments
            pendingComments = [];
        }

        // Add any trailing comments
        result.push(...pendingComments);

        this.info(`Deduplication removed ${rules.length - result.length} rules`);
        return result;
    }
}
