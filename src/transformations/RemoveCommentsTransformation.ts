import { TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes all comment lines from the rules.
 * Comments are lines starting with ! or #
 */
export class RemoveCommentsTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.RemoveComments;
    /** Human-readable name of the transformation */
    public readonly name = 'RemoveComments';

    /**
     * Removes all comment lines from the rules.
     * @param rules - Array of rules to process
     * @returns Array with comments removed
     */
    public executeSync(rules: string[]): string[] {
        const filtered = rules.filter((rule) => !RuleUtils.isComment(rule));
        this.info(`Removed ${rules.length - filtered.length} comments`);
        return filtered;
    }
}
